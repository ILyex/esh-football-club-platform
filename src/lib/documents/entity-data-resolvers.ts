import "server-only";
import { db } from "@/lib/db";
import { ForbiddenError, hasPermission, type SessionUser } from "@/lib/permissions";
import { getPlayerDisplayName } from "@/lib/utils";
// Financial documents print enum-backed values (category, payment method,
// account type...) in the TEMPLATE's own language, using the same finance/teams
// message catalogs the UI uses — one source of wording, no second dictionary.
import arMessages from "@/i18n/messages/ar.json";
import frMessages from "@/i18n/messages/fr.json";

// ============================================================================
// ENTITY DATA RESOLVERS (spec sections 45, 50: "the system retrieves match
// information... auto-fill")
// ----------------------------------------------------------------------------
// Each resolver is the SINGLE place that turns a real database record into
// the values a DocumentFieldMapping's sourcePath can point at (e.g.
// "match.homeTeamName"). This is deliberately separate from
// DocumentAIService — AI never sees this bundle, so it structurally cannot
// be the source of a fabricated fact; only these resolvers, reading
// directly from Prisma, ever populate a DATABASE_FIELD placeholder.
//
// RESOLVER_REGISTRY below is the ONE place a new document type is added —
// the generation pages and generateDocumentAction all read from it
// generically, so adding a fourth type never means touching the engine
// itself, only adding one more entry here.
// ============================================================================

function getByPath(obj: unknown, path: string): string {
  const value = path.split(".").reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), obj);
  if (value == null) return "";
  if (value instanceof Date) return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(value);
  return String(value);
}

export type EntityBundle = Record<string, unknown>;
export type EntityOption = { id: string; label: string };

export type DocumentLanguage = "ar" | "fr";

/** Extra context every resolver receives: the template file's own language (DocumentTemplate.language). */
export interface ResolverContext {
  language: DocumentLanguage;
}

export interface DocumentTypeResolver {
  /** Stored in GeneratedDocument.relatedEntityType so history stays legible. */
  entityType: string;
  /** Dot-paths offered in the field-mapping UI's DATABASE_FIELD dropdown. */
  availablePaths: string[];
  /** Turns one entity id into the flat bundle applyMappings() reads from. */
  resolveBundle: (entityId: string, context: ResolverContext) => Promise<EntityBundle>;
  /** Populates the "select related entity" dropdown in the generation flow — narrowed to the active team context when one is set. */
  listEntities: (teamId?: string) => Promise<EntityOption[]>;
  /**
   * Additional permission required (ON TOP OF documents.generate) to list,
   * resolve or generate for this entity type. Omitted for the sporting/
   * administrative types, which keep their existing behaviour. Financial
   * types set it so that holding documents.generate alone (Coach, Team
   * Manager...) can never be used to read an expense or a ledger entry.
   */
  generatePermission?: string;
  /** Permission required to see/download an ALREADY generated document of this entity type. */
  readPermission?: string;
  /** false = the "improve with AI" affordance is unavailable for this document type. Defaults to true. */
  aiAssistAllowed?: boolean;
  /** true = additionally write an audit entry on the originating entity itself when a document is generated from it. */
  auditOnEntity?: boolean;
}

// ----------------------------------------------------------------------------
// MATCH_REPORT
// ----------------------------------------------------------------------------
async function resolveMatchReportBundle(matchId: string, context?: ResolverContext): Promise<EntityBundle> {
  const [match, clubSettings] = await Promise.all([
    db.match.findUniqueOrThrow({
      where: { id: matchId },
      include: {
        competition: { include: { season: true } },
        team: true,
        events: { include: { player: true }, orderBy: { minute: "asc" } },
        lineups: { include: { player: true } }
      }
    }),
    db.clubSettings.findUnique({ where: { id: "singleton" } })
  ]);

  const opponent = match.isHomeFixture ? match.awayTeamName : match.homeTeamName;
  const goals = match.events.filter((e) => e.type === "GOAL");
  const lang = context?.language ?? "ar";

  return {
    match: {
      date: match.matchDate,
      homeTeamName: match.homeTeamName,
      awayTeamName: match.awayTeamName,
      opponent,
      score: match.homeScore != null && match.awayScore != null ? `${match.homeScore} - ${match.awayScore}` : "",
      stadium: match.stadium ?? "",
      referee: match.refereeName ?? "",
      status: match.status,
      report: match.matchReport ?? "",
      scorers: goals.map((g) => (g.player ? `${getPlayerDisplayName(g.player, lang)} (${g.minute}')` : `(${g.minute}')`)).join(", ")
    },
    competition: { name: match.competition.name, season: match.competition.season.label },
    team: { category: match.team?.category ?? "", name: match.team?.name ?? "" },
    club: { name: clubSettings?.name ?? "", shortName: clubSettings?.shortName ?? "" }
  };
}

async function listMatchesForSelection(teamId?: string): Promise<EntityOption[]> {
  const matches = await db.match.findMany({
    where: teamId ? { teamId } : {},
    orderBy: { matchDate: "desc" },
    take: 30,
    include: { competition: true }
  });
  return matches.map((m) => ({
    id: m.id,
    label: `${m.homeTeamName} \u2013 ${m.awayTeamName} (${m.competition.name}, ${new Intl.DateTimeFormat("fr-FR").format(m.matchDate)})`
  }));
}

const MATCH_REPORT_AVAILABLE_PATHS = [
  "match.date",
  "match.homeTeamName",
  "match.awayTeamName",
  "match.opponent",
  "match.score",
  "match.stadium",
  "match.referee",
  "match.status",
  "match.scorers",
  "competition.name",
  "competition.season",
  "team.category",
  "team.name",
  "club.name",
  "club.shortName"
];

// ----------------------------------------------------------------------------
// MEETING_MINUTES
// ----------------------------------------------------------------------------
async function resolveMeetingMinutesBundle(meetingId: string): Promise<EntityBundle> {
  const [meeting, clubSettings] = await Promise.all([
    db.meetingMinute.findUniqueOrThrow({ where: { id: meetingId }, include: { team: true, responsiblePerson: true } }),
    db.clubSettings.findUnique({ where: { id: "singleton" } })
  ]);

  return {
    meeting: {
      title: meeting.title,
      date: meeting.date,
      location: meeting.location ?? "",
      attendees: meeting.attendees.join("\u060c "),
      agenda: meeting.agenda ?? "",
      content: meeting.content,
      decisions: meeting.decisions ?? "",
      responsiblePerson: meeting.responsiblePerson.name
    },
    team: { category: meeting.team?.category ?? "", name: meeting.team?.name ?? "" },
    club: { name: clubSettings?.name ?? "", shortName: clubSettings?.shortName ?? "" }
  };
}

async function listMeetingsForSelection(teamId?: string): Promise<EntityOption[]> {
  const meetings = await db.meetingMinute.findMany({ where: teamId ? { teamId } : {}, orderBy: { date: "desc" }, take: 30 });
  return meetings.map((m) => ({ id: m.id, label: `${m.title} (${new Intl.DateTimeFormat("fr-FR").format(m.date)})` }));
}

const MEETING_MINUTES_AVAILABLE_PATHS = [
  "meeting.title",
  "meeting.date",
  "meeting.location",
  "meeting.attendees",
  "meeting.agenda",
  "meeting.content",
  "meeting.decisions",
  "meeting.responsiblePerson",
  "team.category",
  "team.name",
  "club.name",
  "club.shortName"
];

// ----------------------------------------------------------------------------
// CORRESPONDENCE
// ----------------------------------------------------------------------------
async function resolveCorrespondenceBundle(correspondenceId: string): Promise<EntityBundle> {
  const [item, clubSettings] = await Promise.all([
    db.correspondence.findUniqueOrThrow({ where: { id: correspondenceId }, include: { team: true } }),
    db.clubSettings.findUnique({ where: { id: "singleton" } })
  ]);

  return {
    correspondence: {
      referenceNumber: item.referenceNumber,
      subject: item.subject,
      sender: item.sender,
      recipient: item.recipient,
      date: item.date,
      type: item.type,
      priority: item.priority,
      notes: item.notes ?? ""
    },
    team: { category: item.team?.category ?? "", name: item.team?.name ?? "" },
    club: { name: clubSettings?.name ?? "", shortName: clubSettings?.shortName ?? "" }
  };
}

async function listCorrespondenceForSelection(teamId?: string): Promise<EntityOption[]> {
  const items = await db.correspondence.findMany({ where: teamId ? { teamId } : {}, orderBy: { date: "desc" }, take: 30 });
  return items.map((c) => ({ id: c.id, label: `${c.referenceNumber} \u2014 ${c.subject}` }));
}

const CORRESPONDENCE_AVAILABLE_PATHS = [
  "correspondence.referenceNumber",
  "correspondence.subject",
  "correspondence.sender",
  "correspondence.recipient",
  "correspondence.date",
  "correspondence.type",
  "correspondence.priority",
  "correspondence.notes",
  "team.category",
  "team.name",
  "club.name",
  "club.shortName"
];

// ----------------------------------------------------------------------------
// FINANCIAL DOCUMENTS (EXPENSE_STATEMENT, DEPOSIT_RECEIPT, WITHDRAWAL_RECEIPT)
// ----------------------------------------------------------------------------
// Everything below is read straight from Prisma. The administrator is never
// asked to retype an amount, reference, date or account: those placeholders
// are DATABASE_FIELD mappings resolved here, and only genuinely absent
// information stays a manual field. Money is formatted from whole-DZD
// integers with string grouping — no floating-point arithmetic anywhere.
// ----------------------------------------------------------------------------
type LabelMap = Record<string, string>;
const FINANCE_MESSAGES = { ar: arMessages.finance, fr: frMessages.finance } as unknown as Record<DocumentLanguage, Record<string, LabelMap | string>>;
const TEAM_CATEGORY_MESSAGES = { ar: arMessages.teams.categories, fr: frMessages.teams.categories } as Record<DocumentLanguage, LabelMap>;
const CURRENCY_LABEL: Record<DocumentLanguage, string> = { ar: "د.ج", fr: "DA" };

function financeLabel(language: DocumentLanguage, group: string, key: string | null | undefined): string {
  if (!key) return "";
  const map = FINANCE_MESSAGES[language][group];
  return typeof map === "object" && map !== null ? (map[key] ?? "") : "";
}

function teamCategoryLabel(language: DocumentLanguage, category: string | null | undefined): string {
  return category ? (TEAM_CATEGORY_MESSAGES[language][category] ?? "") : "";
}

/** Whole-DZD integer -> "12 500" (non-breaking spaces), pure string work. */
export function formatWholeAmount(amount: number): string {
  return String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
}

function formatAmountWithCurrency(amount: number, language: DocumentLanguage): string {
  return `${formatWholeAmount(amount)} ${CURRENCY_LABEL[language]}`;
}

// Date-only values are stored as UTC midnight (they come from <input type="date">),
// so they are formatted in UTC — formatting in the server's zone could print the previous day.
function formatFinanceDate(date: Date, language: DocumentLanguage): string {
  return new Intl.DateTimeFormat(language === "ar" ? "ar-DZ" : "fr-FR", { dateStyle: "long", timeZone: "UTC" }).format(date);
}

export class FinancialDocumentError extends Error {
  constructor(public code: "expenseNotPosted" | "transactionNotEligible" | "wrongTransactionType") {
    super(code);
    this.name = "FinancialDocumentError";
  }
}

// A financial entity that exists but is not eligible for an official document
// (e.g. a DRAFT expense, or a reversed deposit) is a normal, expected outcome —
// reported back on the selection page as a localized notice, not a crash.
export const FINANCIAL_DOCUMENT_NOTICES: Record<FinancialDocumentError["code"], string> = {
  expenseNotPosted: "finance.errors.DOCUMENT_EXPENSE_NOT_POSTED",
  transactionNotEligible: "finance.errors.DOCUMENT_TRANSACTION_NOT_ELIGIBLE",
  wrongTransactionType: "finance.errors.DOCUMENT_WRONG_TRANSACTION_TYPE"
};

export type ResolvedBundle = { bundle: EntityBundle } | { notice: string };

/** Resolves an entity bundle; an ineligible financial entity becomes a notice key instead of an exception. Every other error propagates. */
export async function resolveBundleOrNotice(resolver: DocumentTypeResolver, entityId: string, language: DocumentLanguage): Promise<ResolvedBundle> {
  try {
    return { bundle: await resolver.resolveBundle(entityId, { language }) };
  } catch (error) {
    if (error instanceof FinancialDocumentError) return { notice: FINANCIAL_DOCUMENT_NOTICES[error.code] };
    throw error;
  }
}

/** Only a POSTED expense is authoritative; an official statement is never issued from a DRAFT or CANCELLED one. */
export function isExpenseStatementEligible(expense: { status: string }): boolean {
  return expense.status === "POSTED";
}

/**
 * A receipt certifies that money really moved in one direction. It is never
 * issued for a reversal entry (a correction, not a real deposit/withdrawal)
 * nor for a movement that has since been reversed (the money came back).
 */
export function isReceiptEligible(transaction: { reversalOfTransactionId: string | null; reversedBy: { id: string } | null }): boolean {
  return !transaction.reversalOfTransactionId && !transaction.reversedBy;
}

async function resolveClubIdentity() {
  const clubSettings = await db.clubSettings.findUnique({ where: { id: "singleton" } });
  return { name: clubSettings?.name ?? "", shortName: clubSettings?.shortName ?? "" };
}

async function resolveExpenseStatementBundle(expenseId: string, { language }: ResolverContext): Promise<EntityBundle> {
  const [expense, club] = await Promise.all([
    db.expense.findUniqueOrThrow({
      where: { id: expenseId },
      include: {
        team: true,
        season: true,
        budget: { include: { season: true, team: true } },
        relatedMatch: true,
        relatedTraining: true,
        treasuryTransaction: { include: { treasuryAccount: true } }
      }
    }),
    resolveClubIdentity()
  ]);
  if (!isExpenseStatementEligible(expense)) throw new FinancialDocumentError("expenseNotPosted");

  const budgetScope = expense.budget ? (expense.budget.team ? teamCategoryLabel(language, expense.budget.team.category) : String(FINANCE_MESSAGES[language].clubWide)) : "";

  return {
    expense: {
      referenceNumber: expense.referenceNumber,
      amount: expense.amount,
      amountFormatted: formatWholeAmount(expense.amount),
      amountWithCurrency: formatAmountWithCurrency(expense.amount, language),
      currency: CURRENCY_LABEL[language],
      category: financeLabel(language, "categories", expense.category),
      date: formatFinanceDate(expense.date, language),
      description: expense.description,
      payeeName: expense.payeeName ?? "",
      paymentMethod: financeLabel(language, "paymentMethods", expense.paymentMethod),
      status: financeLabel(language, "expenseStatuses", expense.status),
      notes: expense.notes ?? ""
    },
    team: { name: expense.team?.name ?? "", category: teamCategoryLabel(language, expense.team?.category) },
    season: { label: expense.season.label },
    budget: expense.budget
      ? { label: `${expense.budget.season.label} — ${budgetScope}`, allocatedAmountFormatted: formatWholeAmount(expense.budget.allocatedAmount) }
      : { label: "", allocatedAmountFormatted: "" },
    relatedMatch: expense.relatedMatch
      ? { label: `${expense.relatedMatch.homeTeamName} – ${expense.relatedMatch.awayTeamName}`, date: formatFinanceDate(expense.relatedMatch.matchDate, language) }
      : { label: "", date: "" },
    relatedTraining: { date: expense.relatedTraining ? formatFinanceDate(expense.relatedTraining.date, language) : "" },
    payment: expense.treasuryTransaction
      ? {
          referenceNumber: expense.treasuryTransaction.referenceNumber,
          date: formatFinanceDate(expense.treasuryTransaction.transactionDate, language),
          accountName: expense.treasuryTransaction.treasuryAccount.name
        }
      : { referenceNumber: "", date: "", accountName: "" },
    club
  };
}

async function listExpensesForSelection(teamId?: string): Promise<EntityOption[]> {
  const expenses = await db.expense.findMany({
    where: { status: "POSTED", ...(teamId ? { teamId } : {}) },
    orderBy: { date: "desc" },
    take: 30
  });
  return expenses.map((e) => ({ id: e.id, label: `${e.referenceNumber} \u2014 ${e.description} (${formatWholeAmount(e.amount)})` }));
}

const EXPENSE_STATEMENT_AVAILABLE_PATHS = [
  "expense.referenceNumber",
  "expense.amount",
  "expense.amountFormatted",
  "expense.amountWithCurrency",
  "expense.currency",
  "expense.category",
  "expense.date",
  "expense.description",
  "expense.payeeName",
  "expense.paymentMethod",
  "expense.status",
  "expense.notes",
  "team.name",
  "team.category",
  "season.label",
  "budget.label",
  "budget.allocatedAmountFormatted",
  "relatedMatch.label",
  "relatedMatch.date",
  "relatedTraining.date",
  "payment.referenceNumber",
  "payment.date",
  "payment.accountName",
  "club.name",
  "club.shortName"
];

/** Shared by DEPOSIT_RECEIPT and WITHDRAWAL_RECEIPT — the only difference is which ledger direction is accepted. */
function makeTreasuryReceiptResolver(direction: "DEPOSIT" | "WITHDRAWAL") {
  async function resolveBundle(transactionId: string, { language }: ResolverContext): Promise<EntityBundle> {
    const club = await resolveClubIdentity();

    if (transactionId === "manual") {
      const today = new Date();
      return {
        transaction: {
          referenceNumber: `${direction === "WITHDRAWAL" ? "WITH" : "DEP"}-${today.getFullYear()}-001-ESH`,
          type: direction === "WITHDRAWAL" ? (language === "ar" ? "سحب بنكي" : "Retrait bancaire") : (language === "ar" ? "إيداع" : "Dépôt bancaire"),
          amount: 0,
          amountFormatted: "0",
          amountWithCurrency: `0 ${CURRENCY_LABEL[language]}`,
          currency: CURRENCY_LABEL[language],
          date: formatFinanceDate(today, language),
          description: direction === "WITHDRAWAL" ? (language === "ar" ? "إذن سحب بنكي لتغطية مصاريف النادي" : "Ordre de retrait pour dépenses du club") : (language === "ar" ? "إيداع في رصيد النادي" : "Dépôt financier sur le compte du club"),
          balanceBeforeFormatted: "—",
          balanceAfterFormatted: "—"
        },
        account: {
          name: language === "ar" ? "الحساب البنكي الرسمي للنادي" : "Compte bancaire officiel du club",
          type: language === "ar" ? "حساب بنكي" : "Compte bancaire"
        },
        expense: {
          referenceNumber: "",
          description: "",
          payeeName: ""
        },
        club
      };
    }

    const [transaction] = await Promise.all([
      db.treasuryTransaction.findUniqueOrThrow({
        where: { id: transactionId },
        include: { treasuryAccount: true, relatedExpense: true, reversedBy: { select: { id: true } } }
      })
    ]);
    if (transaction.type !== direction) throw new FinancialDocumentError("wrongTransactionType");
    if (!isReceiptEligible(transaction)) throw new FinancialDocumentError("transactionNotEligible");

    return {
      transaction: {
        referenceNumber: transaction.referenceNumber,
        type: financeLabel(language, "transactionTypes", transaction.type),
        amount: transaction.amount,
        amountFormatted: formatWholeAmount(transaction.amount),
        amountWithCurrency: formatAmountWithCurrency(transaction.amount, language),
        currency: CURRENCY_LABEL[language],
        date: formatFinanceDate(transaction.transactionDate, language),
        description: transaction.description ?? "",
        balanceBeforeFormatted: formatWholeAmount(transaction.balanceBefore),
        balanceAfterFormatted: formatWholeAmount(transaction.balanceAfter)
      },
      account: { name: transaction.treasuryAccount.name, type: financeLabel(language, "accountTypes", transaction.treasuryAccount.type) },
      expense: {
        referenceNumber: transaction.relatedExpense?.referenceNumber ?? "",
        description: transaction.relatedExpense?.description ?? "",
        payeeName: transaction.relatedExpense?.payeeName ?? ""
      },
      club
    };
  }

  async function listEntities(): Promise<EntityOption[]> {
    // Treasury accounts are club-level (no team), so the Team Switcher context does not narrow this list.
    const transactions = await db.treasuryTransaction.findMany({
      where: { type: direction, reversalOfTransactionId: null, reversedBy: { is: null } },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { treasuryAccount: true }
    });

    const manualOption: EntityOption = {
      id: "manual",
      label: direction === "WITHDRAWAL"
        ? "تحديد المبلغ يدويًا (إذن سحب بنكي بمبلغ مخصص)"
        : "تحديد المبلغ يدويًا (وصل إيداع / إعانة بمبلغ مخصص)"
    };

    const recordedOptions = transactions.map((t) => ({
      id: t.id,
      label: `${t.referenceNumber} — ${t.treasuryAccount.name} (${formatWholeAmount(t.amount)}, ${new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC" }).format(t.transactionDate)})`
    }));

    return [manualOption, ...recordedOptions];
  }

  return { resolveBundle, listEntities };
}

const TREASURY_RECEIPT_AVAILABLE_PATHS = [
  "transaction.referenceNumber",
  "transaction.type",
  "transaction.amount",
  "transaction.amountFormatted",
  "transaction.amountWithCurrency",
  "transaction.currency",
  "transaction.date",
  "transaction.description",
  "transaction.balanceBeforeFormatted",
  "transaction.balanceAfterFormatted",
  "account.name",
  "account.type",
  "expense.referenceNumber",
  "expense.description",
  "expense.payeeName",
  "club.name",
  "club.shortName"
];

const depositReceipt = makeTreasuryReceiptResolver("DEPOSIT");
const withdrawalReceipt = makeTreasuryReceiptResolver("WITHDRAWAL");

// ----------------------------------------------------------------------------
// REGISTRY -- the one place a new TemplateType gets wired up
// ----------------------------------------------------------------------------
export const RESOLVER_REGISTRY: Partial<Record<string, DocumentTypeResolver>> = {
  MATCH_REPORT: { entityType: "Match", availablePaths: MATCH_REPORT_AVAILABLE_PATHS, resolveBundle: resolveMatchReportBundle, listEntities: listMatchesForSelection },
  MEETING_MINUTES: {
    entityType: "MeetingMinute",
    availablePaths: MEETING_MINUTES_AVAILABLE_PATHS,
    resolveBundle: resolveMeetingMinutesBundle,
    listEntities: listMeetingsForSelection
  },
  CORRESPONDENCE: {
    entityType: "Correspondence",
    availablePaths: CORRESPONDENCE_AVAILABLE_PATHS,
    resolveBundle: resolveCorrespondenceBundle,
    listEntities: listCorrespondenceForSelection
  },
  EXPENSE_STATEMENT: {
    entityType: "Expense",
    availablePaths: EXPENSE_STATEMENT_AVAILABLE_PATHS,
    resolveBundle: resolveExpenseStatementBundle,
    listEntities: listExpensesForSelection,
    generatePermission: "finance.approve",
    readPermission: "finance.view",
    aiAssistAllowed: false,
    auditOnEntity: true
  },
  DEPOSIT_RECEIPT: {
    entityType: "TreasuryTransaction",
    availablePaths: TREASURY_RECEIPT_AVAILABLE_PATHS,
    resolveBundle: depositReceipt.resolveBundle,
    listEntities: depositReceipt.listEntities,
    generatePermission: "finance.approve",
    readPermission: "finance.view",
    aiAssistAllowed: false,
    auditOnEntity: true
  },
  WITHDRAWAL_RECEIPT: {
    entityType: "TreasuryTransaction",
    availablePaths: TREASURY_RECEIPT_AVAILABLE_PATHS,
    resolveBundle: withdrawalReceipt.resolveBundle,
    listEntities: withdrawalReceipt.listEntities,
    generatePermission: "finance.approve",
    readPermission: "finance.view",
    aiAssistAllowed: false,
    auditOnEntity: true
  }
};

/** relatedEntityType values that have a label under generatedDocuments.entityTypes (both locales). */
export const LABELLED_ENTITY_TYPES: string[] = ["Match", "MeetingMinute", "Correspondence", "Expense", "TreasuryTransaction"];

/** Throws ForbiddenError unless the user holds the resolver's extra permission for this mode (no-op for resolvers that declare none). */
export function requireResolverPermission(user: SessionUser, resolver: DocumentTypeResolver, mode: "generate" | "read"): void {
  const required = mode === "generate" ? resolver.generatePermission : resolver.readPermission;
  if (required && !hasPermission(user, required)) throw new ForbiddenError(required);
}

/**
 * Read permission needed to see an already-generated document, derived from
 * the entity type it was generated for. `null` = only the base
 * documents.generate gate applies (sporting/administrative documents).
 * Looked up by entityType — not by template type — because that is what
 * GeneratedDocument.relatedEntityType stores.
 */
export function readPermissionForEntityType(entityType: string | null | undefined): string | null {
  if (!entityType) return null;
  for (const resolver of Object.values(RESOLVER_REGISTRY)) {
    if (resolver && resolver.entityType === entityType && resolver.readPermission) return resolver.readPermission;
  }
  return null;
}

/** Entity types whose generated documents the user may NOT read — used to filter list queries. */
export function forbiddenGeneratedEntityTypes(user: SessionUser): string[] {
  const forbidden = new Set<string>();
  for (const resolver of Object.values(RESOLVER_REGISTRY)) {
    if (resolver?.readPermission && !hasPermission(user, resolver.readPermission)) forbidden.add(resolver.entityType);
  }
  return [...forbidden];
}

/** Flattens a bundle into PLACEHOLDER -> value using the field mappings' sourcePaths. Prioritizes explicit user overrides. */
export function applyMappings(
  bundle: EntityBundle,
  mappings: { placeholder: string; sourceType: string; sourcePath: string | null }[],
  manualValues: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const m of mappings) {
    const userOverride = manualValues[`override_${m.placeholder}`] ?? manualValues[`field_${m.placeholder}`] ?? manualValues[m.placeholder];
    if (userOverride !== undefined && userOverride.trim() !== "") {
      result[m.placeholder] = userOverride.trim();
    } else if (m.sourceType === "DATABASE_FIELD" && m.sourcePath) {
      result[m.placeholder] = getByPath(bundle, m.sourcePath);
    } else {
      result[m.placeholder] = manualValues[m.placeholder] ?? "";
    }
  }
  return result;
}

export interface SourceEntityScope {
  exists: boolean;
  teamId: string | null;
}

/**
 * Resolves the existence and authoritative team ownership of a source entity
 * for GeneratedDocument access and generation scoping.
 */
export async function resolveSourceEntityScope(
  entityType: string | null | undefined,
  entityId: string | null | undefined
): Promise<SourceEntityScope> {
  if (!entityType || !entityId) {
    return { exists: false, teamId: null };
  }

  // Ad-hoc manual generation (e.g. custom-amount withdrawal/deposit vouchers)
  if (entityId === "manual") {
    return { exists: true, teamId: null };
  }

  switch (entityType) {
    case "Match": {
      const match = await (db as any).match?.findUnique({ where: { id: entityId }, select: { teamId: true } });
      return match ? { exists: true, teamId: match.teamId } : { exists: false, teamId: null };
    }
    case "MeetingMinute": {
      const meeting = await (db as any).meetingMinute?.findUnique({ where: { id: entityId }, select: { teamId: true } });
      return meeting ? { exists: true, teamId: meeting.teamId } : { exists: false, teamId: null };
    }
    case "Correspondence": {
      const corr = await (db as any).correspondence?.findUnique({ where: { id: entityId }, select: { teamId: true } });
      return corr ? { exists: true, teamId: corr.teamId } : { exists: false, teamId: null };
    }
    case "Expense": {
      const expense = await (db as any).expense?.findUnique({ where: { id: entityId }, select: { teamId: true } });
      return expense ? { exists: true, teamId: expense.teamId } : { exists: false, teamId: null };
    }
    case "TreasuryTransaction": {
      const tx = await (db as any).treasuryTransaction?.findUnique({ where: { id: entityId }, select: { id: true } });
      return tx ? { exists: true, teamId: null } : { exists: false, teamId: null };
    }
    default:
      return { exists: false, teamId: null };
  }
}

