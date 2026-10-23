import "server-only";
import { db } from "@/lib/db";
import { birthYearMismatch } from "@/lib/utils";
import { hasPermission, type SessionUser } from "@/lib/permissions";
import { getAccountBalances } from "@/lib/finance/treasury-service";
import { calculateClubDebtSummary, type ClubDebtSummary } from "@/lib/finance/debt-service";
import {
  classifyBudgetUtilization,
  budgetUtilizationPercent,
  draftExpenseSeverity,
  draftExpenseAgeDays,
  expenseDisagreesWithBudget,
  expensePaymentIssue
} from "./finance-rules";

// ============================================================================
// DETERMINISTIC INSIGHTS ENGINE
// ----------------------------------------------------------------------------
// Every rule here is plain application logic against real Prisma data — NO
// AI, by explicit requirement ("Do not use AI for simple deterministic
// notifications" / "Do NOT use AI for deterministic checks"). This is the
// ONE place these rules are computed; the Dashboard's Attention Center,
// syncNotifications(), and the Data Quality Center all read from this same
// function rather than each re-implementing their own version of "which
// contracts are expiring" — so the three surfaces can never silently
// disagree with each other.
//
// `category` marks which surface(s) an insight type is intended for:
//  - "attention": operational, time-sensitive — surfaced on the dashboard
//    and as notifications (contract expiring, match report missing...)
//  - "dataQuality": data-integrity issues — surfaced on the Data Quality
//    Center only (missing team assignment, birth-year/category mismatch...)
// Some types are useful in both places, hence a plain string union rather
// than a strict partition.
// ============================================================================

export const CONTRACT_EXPIRY_WINDOW_DAYS = 60; // matches the Contracts module's own "expiring soon" banner

export type InsightType =
  | "CONTRACT_EXPIRING"
  | "CONTRACT_EXPIRED"
  | "PLAYER_MISSING_DOCUMENTS"
  | "PLAYER_MEDICAL_DOCUMENTS_MISSING"
  | "MEDICAL_DOCUMENT_AI_REVIEW"
  | "PLAYER_MISSING_TEAM"
  | "PLAYER_BIRTH_YEAR_MISMATCH"
  | "MATCH_REPORT_MISSING"
  | "MATCH_MISSING_INFO"
  | "TRAINING_ATTENDANCE_MISSING"
  | "DOCUMENT_PENDING_REVIEW"
  | "BUDGET_NEARING_EXHAUSTION"
  | "BUDGET_EXCEEDED"
  | "EXPENSE_DRAFT_PENDING"
  | "EXPENSE_BUDGET_MISMATCH"
  | "EXPENSE_PAYMENT_INCONSISTENT"
  | "TREASURY_NEGATIVE_BALANCE"
  | "FINANCE_DEBT_UNSETTLED"
  | "FINANCE_DEBT_CRITICAL";

export type InsightSeverity = "info" | "warning" | "critical";
export type InsightCategory = "attention" | "dataQuality";

export interface Insight {
  /** Stable key for dedup — used both to avoid duplicate Notification rows and as a React key. */
  id: string;
  type: InsightType;
  category: InsightCategory;
  severity: InsightSeverity;
  entityType: string;
  entityId: string;
  teamId: string | null;
  /** Interpolation values for the "insights.<type>" i18n message — consumers translate, this engine never does. */
  params: Record<string, string | number>;
  /** Locale-relative path (no /{locale} prefix) to the workflow that resolves this insight. */
  link: string;
  /**
   * When set, only users holding this permission may SEE the insight (its
   * params can carry sensitive figures). computeInsights() still returns it —
   * every consumer (dashboard, data-quality, notifications) applies the same
   * filter via filterInsightsForUser()/its own permission map, so the rule
   * stays defined once, here, at the point the insight is created.
   */
  requiredPermission?: string;
}

/** Drops insights the given user is not permitted to see. Insights without a requiredPermission are unchanged (visible to any authenticated user, as before). */
export function filterInsightsForUser(insights: Insight[], user: Pick<SessionUser, "permissions">): Insight[] {
  return insights.filter((insight) => !insight.requiredPermission || hasPermission(user as SessionUser, insight.requiredPermission));
}

export async function computeInsights(options?: {
  teamId?: string;
  permissions?: string[];
  includeDataQuality?: boolean;
  clubDebtSummary?: Promise<ClubDebtSummary>;
}): Promise<Insight[]> {
  const teamWhere = options?.teamId ? { teamId: options.teamId } : {};
  const permissions = options?.permissions;
  const includeDataQuality = options?.includeDataQuality ?? true;
  // Background generation omits `permissions` and evaluates all domains.
  // Interactive dashboards pass the current user's grants so the engine can
  // avoid querying domains the user cannot see at all.
  const can = (permission: string) => !permissions || permissions.includes("*") || permissions.includes(permission);
  const now = new Date();
  const expiryWindow = new Date(now.getTime() + CONTRACT_EXPIRY_WINDOW_DAYS * 24 * 3600 * 1000);
  const soon = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

  const insights: Insight[] = [];

  // --- Contracts -----------------------------------------------------------
  const [expiringContracts, expiredContracts] = can("contracts.view") || can("contracts.manage") ? await Promise.all([
    can("contracts.view") ? db.contract.findMany({
      where: { ...teamWhere, status: { in: ["ACTIVE", "PENDING", "EXPIRING_SOON"] }, endDate: { gte: now, lte: expiryWindow } },
      select: {
        id: true, teamId: true, endDate: true,
        player: { select: { firstName: true, lastName: true } },
        staff: { select: { firstName: true, lastName: true } }
      }
    }) : Promise.resolve([]),
    can("contracts.view") || can("contracts.manage") ? db.contract.findMany({
      where: { ...teamWhere, endDate: { lt: now }, status: { not: "EXPIRED" } },
      select: {
        id: true, teamId: true, endDate: true,
        player: { select: { firstName: true, lastName: true } },
        staff: { select: { firstName: true, lastName: true } }
      }
    }) : Promise.resolve([])
  ]) : [[], []];
  for (const c of expiringContracts) {
    const name = c.player ? `${c.player.firstName} ${c.player.lastName}` : c.staff ? `${c.staff.firstName} ${c.staff.lastName}` : c.id;
    const days = Math.ceil((c.endDate.getTime() - now.getTime()) / (24 * 3600 * 1000));
    insights.push({
      id: `contract:${c.id}:expiring`,
      type: "CONTRACT_EXPIRING",
      category: "attention",
      severity: days <= 14 ? "critical" : "warning",
      entityType: "Contract",
      entityId: c.id,
      teamId: c.teamId,
      params: { name, days },
      link: `/dashboard/contracts`
    });
  }
  for (const c of expiredContracts) {
    const name = c.player ? `${c.player.firstName} ${c.player.lastName}` : c.staff ? `${c.staff.firstName} ${c.staff.lastName}` : c.id;
    insights.push({
      id: `contract:${c.id}:expired`,
      type: "CONTRACT_EXPIRED",
      category: "attention",
      severity: "critical",
      entityType: "Contract",
      entityId: c.id,
      teamId: c.teamId,
      params: { name },
      link: `/dashboard/contracts`
    });
  }

  // --- Players ---------------------------------------------------------------
  const players = can("players.view") || can("players.update") ? await db.player.findMany({
    where: { ...teamWhere, status: { not: "ARCHIVED" } },
    select: {
      id: true, firstName: true, lastName: true, teamId: true, dateOfBirth: true,
      documents: { select: { id: true, name: true, description: true, documentDate: true, createdAt: true, category: { select: { name: true, key: true } } } },
      medicalRecords: { select: { type: true, status: true, documentId: true, expiresAt: true, document: { select: { status: true } } } },
      team: { select: { category: true, birthYearFrom: true, birthYearTo: true } }
    }
  }) : [];
  for (const p of players) {
    const name = `${p.firstName} ${p.lastName}`;
    if (p.documents.length === 0) {
      insights.push({
        id: `player:${p.id}:missing-documents`,
        type: "PLAYER_MISSING_DOCUMENTS",
        category: "attention",
        severity: "warning",
        entityType: "Player",
        entityId: p.id,
        teamId: p.teamId,
        params: { name },
        link: `/dashboard/players/${p.id}`
      });
    }

    const requiredMedicalTypes = ["MEDICAL_CLEARANCE", "DRUG_TEST_RESULT", "LAB_ANALYSIS"];
    const missingMedicalDocument = requiredMedicalTypes.some((type) => !p.medicalRecords.some((record) => record.type === type && !!record.documentId));
    if (missingMedicalDocument) {
      insights.push({
        id: `player:${p.id}:missing-medical-documents`,
        type: "PLAYER_MEDICAL_DOCUMENTS_MISSING",
        category: "attention",
        severity: "warning",
        entityType: "Player",
        entityId: p.id,
        teamId: p.teamId,
        params: { name },
        link: `/dashboard/medical-records/${p.id}`,
        requiredPermission: "medical.records.view"
      });
    }

    if (includeDataQuality && !p.teamId) {
      insights.push({
        id: `player:${p.id}:missing-team`,
        type: "PLAYER_MISSING_TEAM",
        category: "dataQuality",
        severity: "warning",
        entityType: "Player",
        entityId: p.id,
        teamId: null,
        params: { name },
        link: `/dashboard/players/${p.id}`
      });
    }
    // Advisory only — never blocks anything, matches spec exactly (Player
    // module section 7): a mismatch is surfaced for a human to decide.
    if (includeDataQuality && birthYearMismatch(p.dateOfBirth, p.team)) {
      insights.push({
        id: `player:${p.id}:birth-year-mismatch`,
        type: "PLAYER_BIRTH_YEAR_MISMATCH",
        category: "dataQuality",
        severity: "info",
        entityType: "Player",
        entityId: p.id,
        teamId: p.teamId,
        params: { name },
        link: `/dashboard/players/${p.id}`
      });
    }
  }

  // --- Matches ---------------------------------------------------------------
  const [finishedWithoutReport, upcomingMissingInfo] = can("matches.view") || can("matches.report") || can("matches.update") ? await Promise.all([
    db.match.findMany({ where: { ...teamWhere, status: "FINISHED", OR: [{ matchReport: null }, { matchReport: "" }] }, select: { id: true, teamId: true, homeTeamName: true, awayTeamName: true, isHomeFixture: true } }),
    db.match.findMany({
      where: { ...teamWhere, status: "SCHEDULED", matchDate: { gte: now, lte: soon }, OR: [{ stadium: null }, { refereeName: null }] },
      select: { id: true, teamId: true, homeTeamName: true, awayTeamName: true, isHomeFixture: true }
    })
  ]) : [[], []];
  for (const m of finishedWithoutReport) {
    insights.push({
      id: `match:${m.id}:report-missing`,
      type: "MATCH_REPORT_MISSING",
      category: "attention",
      severity: "warning",
      entityType: "Match",
      entityId: m.id,
      teamId: m.teamId,
      params: { opponent: m.isHomeFixture ? m.awayTeamName : m.homeTeamName },
      link: `/dashboard/matches/${m.id}`
    });
  }
  for (const m of upcomingMissingInfo) {
    insights.push({
      id: `match:${m.id}:missing-info`,
      type: "MATCH_MISSING_INFO",
      category: "attention",
      severity: "info",
      entityType: "Match",
      entityId: m.id,
      teamId: m.teamId,
      params: { opponent: m.isHomeFixture ? m.awayTeamName : m.homeTeamName },
      link: `/dashboard/matches/${m.id}`
    });
  }

  // --- Training ----------------------------------------------------------
  const pastSessionsNoAttendance = can("training.manage") ? await db.trainingSession.findMany({
    where: { ...teamWhere, date: { lt: now }, status: { not: "CANCELLED" }, attendances: { none: {} } },
    select: { id: true, teamId: true, date: true }
  }) : [];
  for (const s of pastSessionsNoAttendance) {
    insights.push({
      id: `training:${s.id}:attendance-missing`,
      type: "TRAINING_ATTENDANCE_MISSING",
      category: "attention",
      severity: "info",
      entityType: "TrainingSession",
      entityId: s.id,
      teamId: s.teamId,
      params: { date: new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(s.date) },
      link: `/dashboard/training/${s.id}`
    });
  }

  // --- Documents -----------------------------------------------------------
  const pendingDocuments = can("documents.update")
    ? await db.document.findMany({ where: { ...teamWhere, status: "PENDING_REVIEW" }, select: { id: true, name: true, teamId: true } })
    : [];
  for (const d of pendingDocuments) {
    insights.push({
      id: `document:${d.id}:pending-review`,
      type: "DOCUMENT_PENDING_REVIEW",
      category: "attention",
      severity: "info",
      entityType: "Document",
      entityId: d.id,
      teamId: d.teamId,
      params: { name: d.name },
      link: `/dashboard/documents`
    });
  }

  // --- Finance ---------------------------------------------------------------
  // Only rules the current domain model can decide objectively (see
  // finance-rules.ts for the predicates and thresholds). Budgets/expenses
  // honour the Team Switcher filter exactly like every rule above; a club-wide
  // record (teamId null) is not part of a specific team's view, matching the
  // Budgets and Expenses list pages. Every finance insight is gated on
  // finance.view — its params can carry references and percentages.
  const [activeBudgets, draftExpenses, linkedExpenses] = can("finance.view") ? await Promise.all([
    db.budget.findMany({ where: { ...teamWhere, status: "ACTIVE" }, include: { season: true, team: true } }),
    db.expense.findMany({ where: { ...teamWhere, status: "DRAFT" } }),
    includeDataQuality ? db.expense.findMany({
      where: { ...teamWhere, status: { not: "CANCELLED" }, OR: [{ budgetId: { not: null } }, { treasuryTransaction: { isNot: null } }] },
      include: { budget: true, treasuryTransaction: { include: { reversedBy: { select: { id: true } } } } }
    }) : Promise.resolve([])
  ]) : [[], [], []];

  // Also covers CANCELLED expenses that still hold a live (unreversed) payment.
  const cancelledWithPayment = can("finance.view") && includeDataQuality ? await db.expense.findMany({
    where: { ...teamWhere, status: "CANCELLED", treasuryTransaction: { isNot: null } },
    include: { treasuryTransaction: { include: { reversedBy: { select: { id: true } } } } }
  }) : [];

  // Budget consumption: ONLY posted expenses count (same rule as the
  // Budgets pages — a DRAFT never silently reduces the official budget).
  const postedByBudget = can("finance.view") && activeBudgets.length > 0 ? await db.expense.groupBy({
    by: ["budgetId"],
    where: { budgetId: { in: activeBudgets.map((b) => b.id) }, status: "POSTED" },
    _sum: { amount: true }
  }) : [];
  const spentByBudget = new Map<string | null, number>(postedByBudget.map((row) => [row.budgetId, row._sum.amount ?? 0] as const));

  for (const b of activeBudgets) {
    const spent = spentByBudget.get(b.id) ?? 0;
    const utilization = classifyBudgetUtilization(b.allocatedAmount, spent);
    if (!utilization) continue;
    insights.push({
      id: `budget:${b.id}:${utilization === "EXCEEDED" ? "exceeded" : "nearing-exhaustion"}`,
      type: utilization === "EXCEEDED" ? "BUDGET_EXCEEDED" : "BUDGET_NEARING_EXHAUSTION",
      category: "attention",
      severity: utilization === "EXCEEDED" ? "critical" : "warning",
      entityType: "Budget",
      entityId: b.id,
      teamId: b.teamId,
      params: { season: b.season.label, scopeKind: b.team ? "team" : "club", scope: b.team?.name ?? "", percent: budgetUtilizationPercent(b.allocatedAmount, spent) },
      link: `/dashboard/finance/budgets/${b.id}`,
      requiredPermission: "finance.view"
    });
  }

  for (const e of draftExpenses) {
    insights.push({
      id: `expense:${e.id}:draft-pending`,
      type: "EXPENSE_DRAFT_PENDING",
      category: "attention",
      severity: draftExpenseSeverity(e.createdAt, now),
      entityType: "Expense",
      entityId: e.id,
      teamId: e.teamId,
      params: { reference: e.referenceNumber, days: draftExpenseAgeDays(e.createdAt, now) },
      link: `/dashboard/finance/expenses/${e.id}`,
      requiredPermission: "finance.view"
    });
  }

  for (const e of linkedExpenses) {
    if (e.budget && expenseDisagreesWithBudget(e, e.budget)) {
      insights.push({
        id: `expense:${e.id}:budget-mismatch`,
        type: "EXPENSE_BUDGET_MISMATCH",
        category: "dataQuality",
        severity: "warning",
        entityType: "Expense",
        entityId: e.id,
        teamId: e.teamId,
        params: { reference: e.referenceNumber },
        link: `/dashboard/finance/expenses/${e.id}`,
        requiredPermission: "finance.view"
      });
    }
  }

  for (const e of [...linkedExpenses, ...cancelledWithPayment]) {
    const tx = e.treasuryTransaction;
    const issue = expensePaymentIssue(e, tx ? { amount: tx.amount, isReversed: tx.reversedBy !== null } : null);
    if (!issue) continue;
    insights.push({
      id: `expense:${e.id}:payment-inconsistent`,
      type: "EXPENSE_PAYMENT_INCONSISTENT",
      category: "dataQuality",
      severity: "critical",
      entityType: "Expense",
      entityId: e.id,
      teamId: e.teamId,
      params: { reference: e.referenceNumber, issue },
      link: `/dashboard/finance/expenses/${e.id}`,
      requiredPermission: "finance.view"
    });
  }

  // Treasury accounts are club-level (no team), so they are only evaluated
  // when no specific team is selected. A negative derived balance cannot
  // happen through treasury-service.ts (it forbids overdraft) — seeing one
  // means the ledger was changed outside the service.
  if (can("finance.view") && !options?.teamId) {
    if (includeDataQuality) {
      const accounts = await db.treasuryAccount.findMany({ select: { id: true, name: true } });
      const balances = await getAccountBalances(accounts.map((a) => a.id));
      for (const account of accounts) {
        if ((balances.get(account.id) ?? 0) < 0) {
          insights.push({
            id: `treasury-account:${account.id}:negative-balance`,
            type: "TREASURY_NEGATIVE_BALANCE",
            category: "dataQuality",
            severity: "critical",
            entityType: "TreasuryAccount",
            entityId: account.id,
            teamId: null,
            params: { name: account.name },
            link: `/dashboard/finance/treasury/${account.id}`,
            requiredPermission: "finance.view"
          });
        }
      }
    }

    // --- Club Debt & Liabilities Evaluation (Operational Solvency & Aging) ---
    // Evaluates outstanding unpaid expenses (debts). Compares total debt to total
    // available treasury liquidity and calculates aging.
    const debtSummary = await (options?.clubDebtSummary ?? calculateClubDebtSummary());
    if (debtSummary.hasDebt) {
      const isCritical =
        debtSummary.solvencyRisk === "DEFICIT" || debtSummary.criticalOverdueCount > 0;

      insights.push({
        id: `finance:debt:${isCritical ? "critical" : "unsettled"}`,
        type: isCritical ? "FINANCE_DEBT_CRITICAL" : "FINANCE_DEBT_UNSETTLED",
        category: "attention",
        severity: isCritical ? "critical" : "warning",
        entityType: "Expense",
        entityId: "club-debt",
        teamId: null,
        params: {
          amount: debtSummary.debtAmount.toLocaleString(),
          count: debtSummary.unsettledExpensesCount,
          days: debtSummary.oldestDebtDays,
          coverage: debtSummary.coverageRatioPercent
        },
        link: "/dashboard/finance/expenses",
        requiredPermission: isCritical ? "finance.approve" : "finance.view"
      });
    }
  }

  return insights;
}
