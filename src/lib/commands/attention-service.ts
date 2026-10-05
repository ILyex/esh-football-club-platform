import "server-only";

import { db } from "@/lib/db";
import { hasPermission, type SessionUser } from "@/lib/permissions";
import { resolveTeamScope, type TeamScope } from "@/lib/authz/policy";

// ============================================================================
// PHASE 9B — OPERATIONAL ATTENTION SIGNALS SERVICE
// ----------------------------------------------------------------------------
// Aggregates pending actionable operational signals across club domains:
//  1. Expiring contracts (<= 30 days) — gated by contracts.view & TeamScope
//  2. Draft expenses awaiting posting — gated by finance.view & TeamScope
//  3. Failed background jobs — gated by settings.manage
//  4. Unread notifications for current user
//
// Invariant: An unauthorized or team-restricted user NEVER receives signals
// for records belonging to unauthorized domains or teams.
// ============================================================================

export interface AttentionItem {
  id: string;
  title: string;
  description: string;
  href: string;
  severity: "info" | "warning" | "danger";
  count: number;
}

export async function getAttentionItems(
  user: SessionUser,
  locale: string = "ar",
  explicitScope?: TeamScope
): Promise<AttentionItem[]> {
  const isArabic = locale === "ar";
  const items: AttentionItem[] = [];

  // Resolve user's team scope
  const scope = explicitScope ?? (await resolveTeamScope(db, user));
  const isRestricted = scope.restricted;
  const authorizedTeamIds: string[] = isRestricted ? [...scope.teamIds] : [];
  const teamScopedFilter = isRestricted ? { teamId: { in: authorizedTeamIds } } : {};

  // 1. EXPIRING CONTRACTS (within next 30 days)
  if (hasPermission(user, "contracts.view") || hasPermission(user, "contracts.manage")) {
    const now = new Date();
    const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const expiringCount = await db.contract.count({
      where: {
        AND: [
          teamScopedFilter,
          {
            status: "ACTIVE",
            endDate: {
              gte: now,
              lte: thirtyDaysAhead
            }
          }
        ]
      }
    });

    if (expiringCount > 0) {
      items.push({
        id: "att-expiring-contracts",
        title: isArabic
          ? `عقود تنتهي قريباً (${expiringCount})`
          : `Contrats expirant sous peu (${expiringCount})`,
        description: isArabic
          ? `يوجد ${expiringCount} عقد رياضي نشط سينتهي خلال الـ 30 يوماً القادمة`
          : `${expiringCount} contrat(s) actif(s) arrivent à échéance dans les 30 prochains jours`,
        href: `/${locale}/dashboard/contracts`,
        severity: "warning",
        count: expiringCount
      });
    }
  }

  // 2. DRAFT EXPENSES (pending review / posting)
  if (hasPermission(user, "finance.view") || hasPermission(user, "finance.manage")) {
    const draftExpensesCount = await db.expense.count({
      where: {
        AND: [
          teamScopedFilter,
          {
            status: "DRAFT"
          }
        ]
      }
    });

    if (draftExpensesCount > 0) {
      items.push({
        id: "att-draft-expenses",
        title: isArabic
          ? `مصاريف قيد الانتظار لم تُرحّل (${draftExpensesCount})`
          : `Dépenses en brouillon non validées (${draftExpensesCount})`,
        description: isArabic
          ? `يوجد ${draftExpensesCount} سند صرف بحالة مسودة بحاجة إلى مراجعة وترحيل`
          : `${draftExpensesCount} dépense(s) en attente de validation ou comptabilisation`,
        href: `/${locale}/dashboard/finance/expenses?status=DRAFT`,
        severity: "warning",
        count: draftExpensesCount
      });
    }
  }

  // 3. FAILED BACKGROUND JOBS
  if (hasPermission(user, "settings.manage")) {
    const failedJobsCount = await db.backgroundJob.count({
      where: {
        status: "FAILED"
      }
    });

    if (failedJobsCount > 0) {
      items.push({
        id: "att-failed-jobs",
        title: isArabic
          ? `مهام خلفية متوقفة بحاجة للمراجعة (${failedJobsCount})`
          : `Tâches en échec à examiner (${failedJobsCount})`,
        description: isArabic
          ? `تعثرت ${failedJobsCount} مهمة غير متزامنة في قائمة الانتظار`
          : `${failedJobsCount} tâche(s) d'arrière-plan en état d'échec`,
        href: `/${locale}/dashboard/jobs`,
        severity: "danger",
        count: failedJobsCount
      });
    }
  }

  // 4. UNREAD NOTIFICATIONS
  const unreadCount = await db.notification.count({
    where: {
      userId: user.id,
      isRead: false
    }
  });

  if (unreadCount > 0) {
    items.push({
      id: "att-unread-notifications",
      title: isArabic
        ? `إشعارات غير مقروءة (${unreadCount})`
        : `Notifications non lues (${unreadCount})`,
      description: isArabic
        ? `لديك ${unreadCount} تنبيه جديد في صندوق الإشعارات`
        : `Vous avez ${unreadCount} nouvelle(s) notification(s)`,
      href: `/${locale}/dashboard/notifications`,
      severity: "info",
      count: unreadCount
    });
  }

  return items;
}
