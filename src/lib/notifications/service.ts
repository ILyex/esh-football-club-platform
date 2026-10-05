import "server-only";
import { db } from "@/lib/db";
import type { Prisma, NotificationType } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";

// ============================================================================
// P5 — AUTHORITATIVE TEAM-SCOPED NOTIFICATION SERVICE
// ----------------------------------------------------------------------------
// Dispatches notifications with strict three-fold verification:
//   1. Functional RBAC Permission check (e.g. "contracts.view").
//   2. Live UserTeam scope check:
//      - If notification.teamId is specified, restricted users receive it ONLY
//        if teamId is present in their live UserTeam assignments.
//      - StaffTeam is operational only and is NEVER used for authorization.
//      - Restricted users never receive cross-team notifications.
//   3. Deterministic DB-level deduplication:
//      - Uses unique dedupKey to prevent notification spam across job retries
//        and concurrent scheduler runs.
//   4. Safe internal-only links (prevents open redirects).
// ============================================================================

export interface DispatchNotificationOptions {
  type: NotificationType;
  title: string;
  message?: string | null;
  params?: Record<string, string | number> | null;
  link?: string | null;
  teamId?: string | null;
  requiredPermission: string;
  dedupKey: string;
  targetUserIds?: string[];
}

export interface DispatchNotificationResult {
  eligibleCount: number;
  createdCount: number;
}

/**
 * Sanitizes link to ensure it is strictly an internal dashboard path.
 */
export function sanitizeNotificationLink(link?: string | null): string | null {
  if (!link) return null;
  const trimmed = link.trim();
  // Must begin with "/" and must NOT begin with "//" (protocol-relative) or contain ":" (scheme)
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.includes("://")) {
    return trimmed;
  }
  return null;
}

/**
 * Dispatches notifications transactionally to all authorized recipients.
 */
export async function dispatchNotification(
  client: Prisma.TransactionClient | typeof db,
  options: DispatchNotificationOptions
): Promise<DispatchNotificationResult> {
  const {
    type,
    title,
    message,
    params,
    link,
    teamId,
    requiredPermission,
    dedupKey,
    targetUserIds
  } = options;

  const safeLink = sanitizeNotificationLink(link);

  // 1. Fetch active users with their role permissions and authoritative UserTeam assignments
  const users = await client.user.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      ...(targetUserIds && targetUserIds.length > 0 ? { id: { in: targetUserIds } } : {})
    },
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } }
        }
      },
      teamAssignments: { select: { teamId: true } }
    }
  });

  // 2. Authoritative eligibility filtering
  const eligibleUserIds: string[] = [];

  for (const user of users) {
    const userPermissions = user.role.permissions.map((rp) => rp.permission.key);

    // Functional permission check
    if (!hasPermission({
      id: user.id,
      name: user.name,
      email: user.email,
      roleKey: user.role.key,
      roleName: user.role.name,
      permissions: userPermissions
    }, requiredPermission)) {
      continue;
    }

    const isSuperAdmin = user.role.key === "super_admin" && userPermissions.includes("*");
    const isUnrestricted = isSuperAdmin || !user.role.teamScoped;

    // Team-scoping check
    if (teamId) {
      if (isUnrestricted) {
        // Unrestricted users see all teams
        eligibleUserIds.push(user.id);
      } else {
        // Restricted users ONLY see teams in their UserTeam assignments
        const authorizedTeamIds = user.teamAssignments.map((ta) => ta.teamId);
        if (authorizedTeamIds.includes(teamId)) {
          eligibleUserIds.push(user.id);
        }
      }
    } else {
      // Club-wide notification (teamId === null)
      if (isUnrestricted) {
        eligibleUserIds.push(user.id);
      }
      // Restricted users do not receive club-wide operational alerts unless unrestricted
    }
  }

  if (eligibleUserIds.length === 0) {
    return { eligibleCount: 0, createdCount: 0 };
  }

  // 3. Deterministic creation with DB-level deduplication
  let createdCount = 0;

  for (const userId of eligibleUserIds) {
    const recipientDedupKey = `${type}:${dedupKey}:${userId}`;

    try {
      // Upsert ensures idempotency even under concurrent job execution
      await client.notification.upsert({
        where: { dedupKey: recipientDedupKey },
        update: { title, params: params as any }, // keeps isRead; refreshes stale text/params
        create: {
          userId,
          type,
          title,
          message: message ?? null,
          params: params as any,
          link: safeLink,
          teamId: teamId ?? null,
          dedupKey: recipientDedupKey,
          isRead: false
        }
      });
      createdCount++;
    } catch (e: any) {
      // Unique constraint race is harmless; treat as already notified
      if (e?.code === "P2002" || e?.message?.includes("Unique constraint")) {
        continue;
      }
      throw e;
    }
  }

  return { eligibleCount: eligibleUserIds.length, createdCount };
}
