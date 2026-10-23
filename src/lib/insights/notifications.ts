import "server-only";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { computeInsights, type Insight, type InsightType } from "./rules";

// ============================================================================
// NOTIFICATION GENERATION (spec Phase 4) — deterministic only, no AI.
// ----------------------------------------------------------------------------
// Only "attention"-category insights become notifications (data-quality
// insights like a birth-year mismatch are advisory-only and surfaced solely
// on the Data Quality Center, never pushed as a notification — spec is
// explicit that birth-year mismatch "must remain advisory").
//
// This runs in the background `insights.sync` job (hourly scheduler), not in
// a page request. Keeping it off the dashboard render avoids repeating its
// full-club insight scans for each navigation.
// ============================================================================

const NOTIFIABLE_TYPES: Partial<Record<InsightType, { notificationType: string; requiredPermission: string }>> = {
  CONTRACT_EXPIRING: { notificationType: "CONTRACT_EXPIRING", requiredPermission: "contracts.view" },
  CONTRACT_EXPIRED: { notificationType: "CONTRACT_EXPIRED", requiredPermission: "contracts.manage" },
  PLAYER_MISSING_DOCUMENTS: { notificationType: "PLAYER_MISSING_DOCUMENTS", requiredPermission: "players.update" },
  PLAYER_MEDICAL_DOCUMENTS_MISSING: { notificationType: "PLAYER_MISSING_DOCUMENTS", requiredPermission: "medical.records.view" },
  MEDICAL_DOCUMENT_AI_REVIEW: { notificationType: "DOCUMENT_PENDING_REVIEW", requiredPermission: "medical.records.manage" },
  MATCH_REPORT_MISSING: { notificationType: "MATCH_REPORT_MISSING", requiredPermission: "matches.report" },
  MATCH_MISSING_INFO: { notificationType: "MATCH_MISSING_INFO", requiredPermission: "matches.update" },
  TRAINING_ATTENDANCE_MISSING: { notificationType: "TRAINING_ATTENDANCE_MISSING", requiredPermission: "training.manage" },
  DOCUMENT_PENDING_REVIEW: { notificationType: "DOCUMENT_PENDING_REVIEW", requiredPermission: "documents.update" },
  // Finance: the budget alerts are informational for anyone who can see
  // finance; a draft expense is a call to ACT (post or cancel it), so only
  // users who can actually do that (finance.approve) are notified.
  BUDGET_NEARING_EXHAUSTION: { notificationType: "BUDGET_NEARING_EXHAUSTION", requiredPermission: "finance.view" },
  BUDGET_EXCEEDED: { notificationType: "BUDGET_EXCEEDED", requiredPermission: "finance.view" },
  EXPENSE_DRAFT_PENDING: { notificationType: "EXPENSE_DRAFT_PENDING", requiredPermission: "finance.approve" },
  // Debt: unsettled liabilities are a call to ACT for those who can settle them.
  FINANCE_DEBT_UNSETTLED: { notificationType: "EXPENSE_DRAFT_PENDING", requiredPermission: "finance.view" },
  FINANCE_DEBT_CRITICAL: { notificationType: "BUDGET_EXCEEDED", requiredPermission: "finance.approve" }
};

/** Notification types whose text can be rendered from insights.types.<type> + stored params. */
export const NOTIFIABLE_TYPE_KEYS: string[] = Object.keys(NOTIFIABLE_TYPES);

function formatTitle(insight: Insight): string {
  // FALLBACK text only, in the club's default locale (User has no stored
  // locale preference). The notifications page does NOT show this when the row
  // carries `params`: it renders insights.types.<type> in the viewer's own
  // locale, so Arabic and French users each read their language.
  const p = insight.params;
  switch (insight.type) {
    case "CONTRACT_EXPIRING":
      return `Contrat de ${p.name} — expire dans ${p.days} jours`;
    case "CONTRACT_EXPIRED":
      return `Contrat de ${p.name} — expiré`;
    case "PLAYER_MISSING_DOCUMENTS":
      return `Aucun document pour ${p.name}`;
    case "PLAYER_MEDICAL_DOCUMENTS_MISSING":
      return `Dossier médical incomplet — ${p.name}`;
    case "MATCH_REPORT_MISSING":
      return `Rapport de match manquant — vs ${p.opponent}`;
    case "MATCH_MISSING_INFO":
      return `Informations manquantes — match vs ${p.opponent}`;
    case "TRAINING_ATTENDANCE_MISSING":
      return `Présence non enregistrée — ${p.date}`;
    case "DOCUMENT_PENDING_REVIEW":
      return `Document en attente : ${p.name}`;
    case "BUDGET_NEARING_EXHAUSTION":
      return `Budget ${p.season} bientôt épuisé (${p.percent} % consommé)`;
    case "BUDGET_EXCEEDED":
      return `Budget ${p.season} dépassé (${p.percent} % consommé)`;
    case "EXPENSE_DRAFT_PENDING":
      return `Dépense ${p.reference} en brouillon — validation requise`;
    case "FINANCE_DEBT_UNSETTLED":
      return `Dettes en attente de règlement : ${p.amount} DZD (${p.count})`;
    case "FINANCE_DEBT_CRITICAL":
      return `Dette critique : ${p.amount} DZD — couverture ${p.coverage} %`;
    default:
      return insight.type;
  }
}

import { dispatchNotification } from "@/lib/notifications/service";

/**
 * Computes current insights and creates any Notification rows that don't
 * already exist, enforcing strict UserTeam authorization and database-level
 * deduplication.
 */
export async function syncNotifications(): Promise<{ processedInsights: number }> {
  const insights = await computeInsights();
  const notifiable = insights.filter((i) => i.category === "attention" && NOTIFIABLE_TYPES[i.type]);
  if (notifiable.length === 0) return { processedInsights: 0 };

  for (const insight of notifiable) {
    const rule = NOTIFIABLE_TYPES[insight.type]!;
    const requiredPermission = insight.requiredPermission ?? rule.requiredPermission;
    const link = insight.link.startsWith("/dashboard")
      ? insight.link
      : `/dashboard${insight.link.startsWith("/") ? "" : "/"}${insight.link}`;
    const dedupKey = `insight:${insight.id}`;

    await dispatchNotification(db, {
      type: rule.notificationType as any,
      title: formatTitle(insight),
      params: { ...insight.params, _t: insight.type },
      link,
      teamId: insight.teamId,
      requiredPermission,
      dedupKey
    });
  }

  return { processedInsights: notifiable.length };
}
