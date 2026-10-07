import "server-only";
import { db } from "@/lib/db";
import { z } from "zod";
import { getActiveAIProvider, isAIConfigured } from "@/lib/ai/provider";

export type ThreatLevel = "NORMAL" | "LOW" | "HIGH" | "CRITICAL" | "INSUFFICIENT_DATA";

export interface AnomalyReport {
  threatLevel: ThreatLevel;
  threatLevelLabelAr: string;
  threatLevelLabelFr: string;
  primaryReasonAr: string;
  primaryReasonFr: string;
  hasSufficientData: boolean;
  aiInsight?: {
    evidence: ("FAILED_LOGIN_BURST" | "REPEATED_AUTH_DENIAL" | "SINGLE_AUTH_DENIAL")[];
  };
  detectedAnomalies: {
    id: string;
    severity: "info" | "warning" | "danger";
    titleAr: string;
    titleFr: string;
    descriptionAr: string;
    descriptionFr: string;
    timestamp: Date;
    actor?: string;
    ipAddress?: string;
    entityId?: string;
  }[];
  stats: {
    recentActions24h: number;
    enabledAccountsCount: number;
    failedAttemptsCount: number;
    unauthorizedAttemptsCount: number;
    roleChangesCount: number;
    sensitiveOperationsCount: number;
  };
  charts: {
    activityByHour: { hour: string; count: number; sensitiveCount: number }[];
    actionsByType: { type: string; labelAr: string; labelFr: string; count: number; percentage: number }[];
  };
}

/**
 * Real Institutional Security & Threat Analysis Engine.
 * Evaluates real security indicators:
 * - Failed login attempts & rapid burst rate
 * - Unauthorized 403 access attempts & privilege escalation
 * - Audited sensitive administrative and financial actions
 * This is a rule-based review of application audit events, not a SIEM or
 * calibrated security score. IP changes alone are deliberately not treated
 * as suspicious because NAT, mobile networks and VPNs create false positives.
 */
export async function detectSecurityAnomalies(): Promise<AnomalyReport> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since2h = new Date(Date.now() - 2 * 60 * 60 * 1000);

  const [recentLogs, enabledAccountsCount, totalRecentAuditEvents, failedLogins24h, failedLoginsRecent, unauthorizedAttemptsCount] = await Promise.all([
    db.auditLog.findMany({
      where: { createdAt: { gte: since24h } },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 1000
    }),
    db.user.count({ where: { isActive: true } }),
    db.auditLog.count({ where: { createdAt: { gte: since24h } } }),
    db.auditLog.count({ where: { action: "auth.login_failed", createdAt: { gte: since24h } } }),
    db.auditLog.count({ where: { action: "auth.login_failed", createdAt: { gte: since2h } } }),
    db.auditLog.count({ where: { action: "authorization.denied", createdAt: { gte: since24h } } })
  ]);

  // A single denied request is a normal authorization outcome.  Keep a
  // separate short-window count so repeated denials can be distinguished from
  // an isolated permissions mistake.
  const unauthorizedAttemptsRecent = recentLogs.filter(
    (log) => log.action.toLowerCase() === "authorization.denied" && log.createdAt >= since2h
  ).length;

  const anomalies: AnomalyReport["detectedAnomalies"] = [];

  // Track real security metrics
  let roleChangesCount = 0;
  let sensitiveOperationsCount = 0;


  for (const log of recentLogs) {
    const actionLower = log.action.toLowerCase();

    // 2. Unauthorized Access & 403 Forbidden attempts
    if (actionLower === "authorization.denied") {
      anomalies.push({
        id: `unauth-${log.id}`,
        severity: "warning",
        titleAr: "رفض إجراء لغياب الصلاحية",
        titleFr: "Action refusée faute de permission",
        descriptionAr: `رُفض إجراء يتطلب صلاحية إضافية (${log.entityType ?? "صلاحية"}) للمستخدم ${log.user?.name ?? "مستخدم غير معروف"}.`,
        descriptionFr: `Une action nécessitant une permission supplémentaire (${log.entityType ?? "permission"}) a été refusée à ${log.user?.name ?? "un utilisateur inconnu"}.`,
        timestamp: log.createdAt,
        actor: log.user?.name ?? log.userId ?? undefined,
        ipAddress: log.ipAddress ?? undefined
      });
    }

    // 3. Role / Permission Changes
    if (actionLower.includes("role") || actionLower.includes("permission") || actionLower.includes("user.manage")) {
      roleChangesCount++;
    }

    // 4. Sensitive Operations
    if (
      actionLower.includes("finance") ||
      actionLower.includes("security") ||
      actionLower.includes("contract") ||
      actionLower.includes("delete")
    ) {
      sensitiveOperationsCount++;
    }

  }

  // Failed login burst anomaly
  if (failedLoginsRecent >= 5) {
    anomalies.push({
      id: "burst-failed-logins",
      severity: "danger",
      titleAr: "تكرار محاولات الدخول الفاشلة",
      titleFr: "Échecs de connexion répétés",
      descriptionAr: `${failedLoginsRecent} محاولات دخول فاشلة مسجلة خلال الساعتين الأخيرتين. يلزم التحقق من السياق قبل الاستنتاج.`,
      descriptionFr: `${failedLoginsRecent} échecs de connexion enregistrés au cours des 2 dernières heures.`,
      timestamp: new Date()
    });
  }

  // Determine institutional threat level and explicit reason
  const hasSufficientData = totalRecentAuditEvents >= 5;
  let threatLevel: ThreatLevel = hasSufficientData ? "NORMAL" : "INSUFFICIENT_DATA";
  let threatLevelLabelAr = "لا تنبيهات مرصودة";
  let threatLevelLabelFr = "Aucune alerte observée";
  let primaryReasonAr = "لم تُطلق قواعد التنبيه على أحداث سجل التدقيق المتاحة؛ هذا لا يثبت سلامة النظام بالكامل.";
  let primaryReasonFr = "Aucune règle d'alerte ne s'est déclenchée dans les journaux disponibles ; cela ne certifie pas la sécurité du système.";
  if (!hasSufficientData) {
    threatLevel = "INSUFFICIENT_DATA";
    threatLevelLabelAr = "بيانات غير كافية";
    threatLevelLabelFr = "Données insuffisantes";
    primaryReasonAr = `سُجلت ${totalRecentAuditEvents} أحداث تدقيق فقط خلال 24 ساعة؛ لا يمكن اعتبار غياب التنبيهات دليلاً على سلامة النظام.`;
    primaryReasonFr = `${totalRecentAuditEvents} événements d'audit observés en 24h ; l'absence d'alerte ne prouve pas que le système est sûr.`;
  } else if (failedLoginsRecent >= 8 && (unauthorizedAttemptsRecent >= 3 || unauthorizedAttemptsCount >= 5)) {
    threatLevel = "CRITICAL";
    threatLevelLabelAr = "حرج";
    threatLevelLabelFr = "Critique";
    primaryReasonAr = `${failedLoginsRecent} محاولات دخول فاشلة خلال ساعتين، و${unauthorizedAttemptsCount} حالات رفض صلاحية خلال 24 ساعة (منها ${unauthorizedAttemptsRecent} خلال ساعتين).`;
    primaryReasonFr = `${failedLoginsRecent} échecs de connexion en 2h et ${unauthorizedAttemptsCount} refus d'autorisation en 24h (dont ${unauthorizedAttemptsRecent} en 2h).`;
  } else if (failedLoginsRecent >= 5 || unauthorizedAttemptsRecent >= 5 || unauthorizedAttemptsCount >= 10) {
    threatLevel = "HIGH";
    threatLevelLabelAr = "مرتفع";
    threatLevelLabelFr = "Élevé";
    const reasons: string[] = [];
    if (failedLoginsRecent >= 5) reasons.push(`${failedLoginsRecent} محاولات دخول فاشلة خلال ساعتين`);
    if (unauthorizedAttemptsRecent >= 5 || unauthorizedAttemptsCount >= 10) reasons.push(`${unauthorizedAttemptsCount} حالات رفض صلاحية خلال 24 ساعة`);
    primaryReasonAr = `${reasons.join(" + ")}. التصنيف مرتفع بسبب التكرار، وليس بسبب رفض منفرد.`;
    primaryReasonFr = `${reasons.join(" + ")}. Le niveau est élevé à cause de la répétition, pas d'un refus isolé.`;
  } else if (unauthorizedAttemptsCount > 0) {
    threatLevel = "LOW";
    threatLevelLabelAr = "مراقبة (رفض صلاحية)";
    threatLevelLabelFr = "Surveillance (permission refusée)";
    primaryReasonAr = `سُجلت ${unauthorizedAttemptsCount} حالة رفض صلاحية خلال 24 ساعة، منها ${unauthorizedAttemptsRecent} خلال ساعتين. هذا مؤشر متابعة فقط ولا يثبت اختراقاً.`;
    primaryReasonFr = `${unauthorizedAttemptsCount} refus d'autorisation en 24h, dont ${unauthorizedAttemptsRecent} en 2h. Indicateur de suivi uniquement ; cela ne prouve pas une intrusion.`;
  } else if (failedLogins24h > 0) {
    threatLevel = "LOW";
    threatLevelLabelAr = "منخفض";
    threatLevelLabelFr = "Faible";
    primaryReasonAr = `سُجلت ${failedLogins24h} محاولة دخول غير ناجحة خلال 24 ساعة. راجع السياق؛ هذا العدد وحده لا يثبت هجوماً أو سلامة النظام.`;
    primaryReasonFr = `${failedLogins24h} échec(s) de connexion en 24h. Examiner le contexte ; ce nombre seul ne prouve ni attaque ni sécurité.`;
  }

  // Optional local AI assistance is strictly advisory. The model receives
  // aggregate counts only and can select existing evidence keys; it cannot
  // change threatLevel, query the database, or invent an event.
  let aiInsight: AnomalyReport["aiInsight"];
  if (isAIConfigured()) {
    try {
      const insight = await getActiveAIProvider().generateStructured({
        system:
          "أنت مساعد أمني محلي. اختر فقط مؤشرات موجودة في البيانات المرفقة. " +
          "لا تستنتج اختراقاً ولا تضف أرقاماً أو أحداثاً. أعد JSON مطابقاً للمخطط فقط.",
        prompt: JSON.stringify({
          failedLogins24h,
          failedLoginsRecent,
          unauthorizedAttemptsCount,
          unauthorizedAttemptsRecent,
          allowedEvidence: ["FAILED_LOGIN_BURST", "REPEATED_AUTH_DENIAL", "SINGLE_AUTH_DENIAL"]
        }),
        schema: z.object({
          evidence: z.array(
            z.enum(["FAILED_LOGIN_BURST", "REPEATED_AUTH_DENIAL", "SINGLE_AUTH_DENIAL"])
          ).max(3)
        }),
        timeoutMs: 4000,
        temperature: 0
      });
      const evidence = insight.evidence.filter((key) =>
        key === "FAILED_LOGIN_BURST"
          ? failedLoginsRecent >= 5
          : key === "REPEATED_AUTH_DENIAL"
            ? unauthorizedAttemptsCount >= 2
            : unauthorizedAttemptsCount === 1
      );
      if (evidence.length > 0) aiInsight = { evidence };
    } catch {
      // Local AI is optional; deterministic analysis remains authoritative.
    }
  }

  // Activity over 4-hour time windows in last 24h
  const timeBuckets: { [bucketKey: string]: { count: number; sensitiveCount: number; label: string } } = {
    b0: { count: 0, sensitiveCount: 0, label: "00:00 - 04:00 UTC" },
    b1: { count: 0, sensitiveCount: 0, label: "04:00 - 08:00 UTC" },
    b2: { count: 0, sensitiveCount: 0, label: "08:00 - 12:00 UTC" },
    b3: { count: 0, sensitiveCount: 0, label: "12:00 - 16:00 UTC" },
    b4: { count: 0, sensitiveCount: 0, label: "16:00 - 20:00 UTC" },
    b5: { count: 0, sensitiveCount: 0, label: "20:00 - 24:00 UTC" }
  };

  const entityCategoryCounts = {
    AUTH_USER: 0,
    SPORTING: 0,
    FINANCE: 0,
    DOCUMENTS: 0,
    SYSTEM: 0
  };

  for (const log of recentLogs) {
    const hours = log.createdAt.getUTCHours();
    const bucketIdx = Math.floor(hours / 4);
    const key = `b${bucketIdx}`;
    if (timeBuckets[key]) {
      timeBuckets[key].count++;
      if (
        log.action.includes("delete") ||
        log.action.includes("permission") ||
        log.action.includes("finance") ||
        log.action.includes("role")
      ) {
        timeBuckets[key].sensitiveCount++;
      }
    }

    if (log.entityType === "User" || log.entityType === "Role" || log.entityType === "UserTeam") {
      entityCategoryCounts.AUTH_USER++;
    } else if (log.entityType === "Player" || log.entityType === "Match" || log.entityType === "TrainingSession") {
      entityCategoryCounts.SPORTING++;
    } else if (
      log.entityType.includes("Expense") ||
      log.entityType.includes("Budget") ||
      log.entityType.includes("Transaction")
    ) {
      entityCategoryCounts.FINANCE++;
    } else if (log.entityType.includes("Document")) {
      entityCategoryCounts.DOCUMENTS++;
    } else {
      entityCategoryCounts.SYSTEM++;
    }
  }

  const activityByHour = Object.values(timeBuckets).map((b) => ({
    hour: b.label,
    count: b.count,
    sensitiveCount: b.sensitiveCount
  }));

  const safeLogsLength = Math.max(1, recentLogs.length);
  const actionsByType = [
    {
      type: "AUTH_USER",
      labelAr: "المستخدمون والأذونات",
      labelFr: "Comptes & Permissions",
      count: entityCategoryCounts.AUTH_USER,
      percentage: Math.round((entityCategoryCounts.AUTH_USER / safeLogsLength) * 100)
    },
    {
      type: "SPORTING",
      labelAr: "الرياضيون والمباريات",
      labelFr: "Sportif & Matchs",
      count: entityCategoryCounts.SPORTING,
      percentage: Math.round((entityCategoryCounts.SPORTING / safeLogsLength) * 100)
    },
    {
      type: "FINANCE",
      labelAr: "المالية والخزينة",
      labelFr: "Finances & Trésorerie",
      count: entityCategoryCounts.FINANCE,
      percentage: Math.round((entityCategoryCounts.FINANCE / safeLogsLength) * 100)
    },
    {
      type: "DOCUMENTS",
      labelAr: "الوثائق والأرشيف",
      labelFr: "Documents & Archives",
      count: entityCategoryCounts.DOCUMENTS,
      percentage: Math.round((entityCategoryCounts.DOCUMENTS / safeLogsLength) * 100)
    },
    {
      type: "SYSTEM",
      labelAr: "النظام والرقابة",
      labelFr: "Système & Audit",
      count: entityCategoryCounts.SYSTEM,
      percentage: Math.round((entityCategoryCounts.SYSTEM / safeLogsLength) * 100)
    }
  ];

  return {
    threatLevel,
    threatLevelLabelAr,
    threatLevelLabelFr,
    primaryReasonAr,
    primaryReasonFr,
    hasSufficientData,
    aiInsight,
    detectedAnomalies: anomalies,
    stats: {
      recentActions24h: totalRecentAuditEvents,
      enabledAccountsCount,
      failedAttemptsCount: failedLogins24h,
      unauthorizedAttemptsCount,
      roleChangesCount,
      sensitiveOperationsCount,
    },
    charts: {
      activityByHour,
      actionsByType
    }
  };
}
