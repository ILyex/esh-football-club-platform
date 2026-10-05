import "server-only";

import { z } from "zod";
import { registerJobHandler } from "@/lib/jobs/registry";
import { enqueueJob, type DbOrTx } from "@/lib/jobs/queue";
import { syncFAFPlayers } from "./sync-service";
import { db } from "@/lib/db";
import { resolveTeamScope } from "@/lib/authz/policy";
import type { JobContext } from "@/lib/jobs/types";

// ============================================================================
// PHASE 10B — BACKGROUND SYNC ORCHESTRATION VIA P5 QUEUE
// ----------------------------------------------------------------------------
// Registers background job handlers for asynchronous, non-blocking FAF sync.
// Enforces idempotency keys, backoff retry limits, and audit tracking.
// ============================================================================

export const fafSyncPayloadSchema = z.object({
  userId: z.string(),
  category: z.string().optional(),
  seasonLabel: z.string().optional(),
  dryRun: z.boolean().optional()
});

export type FAFSyncJobPayload = z.infer<typeof fafSyncPayloadSchema>;

export async function enqueueFAFSyncJob(
  client: DbOrTx,
  input: {
    userId: string;
    category?: string;
    seasonLabel?: string;
    dryRun?: boolean;
  }
) {
  const dateKey = new Date().toISOString().slice(0, 13); // Bounded to 1 sync per hour per category
  const idempotencyKey = `faf-sync-${input.category || "ALL"}-${dateKey}`;

  return enqueueJob(client, {
    type: "faf.sync",
    payload: input,
    idempotencyKey,
    createdById: input.userId,
    priority: "DEFAULT",
    maxAttempts: 3
  });
}

import { FAFSessionManager } from "./session-manager";
import { dispatchNotification } from "@/lib/notifications/service";

export const fafKeepAlivePayloadSchema = z.object({
  source: z.string().optional()
});

export type FAFKeepAlivePayload = z.infer<typeof fafKeepAlivePayloadSchema>;

export async function enqueueFAFKeepAliveJob(client: DbOrTx) {
  const dateKey = new Date().toISOString().slice(0, 15); // max once per 10 minutes
  return enqueueJob(client, {
    type: "faf.keepalive",
    payload: { source: "scheduler" },
    idempotencyKey: `faf-keepalive-${dateKey}`,
    priority: "LOW",
    maxAttempts: 1
  });
}

/**
 * Registers the FAF background sync job handler with the P5 worker registry.
 */
export function registerFAFJobHandlers(): void {
  try {
    registerJobHandler<FAFSyncJobPayload, any>({
      type: "faf.sync",
      schema: fafSyncPayloadSchema,
      defaultPriority: "DEFAULT",
      defaultMaxAttempts: 3,
      handler: async (payload: FAFSyncJobPayload, context: JobContext) => {
        // Resolve initiating user for audit and scoping
        const userRow = await db.user.findUnique({
          where: { id: payload.userId },
          include: { role: { include: { permissions: { include: { permission: true } } } } }
        });

        if (!userRow) {
          throw new Error(`Sync job aborted: initiating user ${payload.userId} not found`);
        }

        const sessionUser = {
          id: userRow.id,
          name: userRow.name,
          email: userRow.email,
          roleKey: userRow.role.key,
          roleName: userRow.role.name,
          permissions: userRow.role.permissions.map((rp) => rp.permission.key)
        };

        const scope = await resolveTeamScope(db, sessionUser);

        // Execute synchronization
        const result = await syncFAFPlayers(sessionUser, scope, {
          category: payload.category,
          seasonLabel: payload.seasonLabel,
          dryRun: payload.dryRun
        });

        if (result.status === "AUTH_REQUIRED") {
          // Send notification to admin without triggering aggressive retry storm
          try {
            await dispatchNotification(db, {
              type: "NEW_ANNOUNCEMENT",
              title: "FAF Authentication Required",
              message: "FAF authentication has expired and requires re-authentication.",
              link: "/dashboard/settings",
              requiredPermission: "settings.manage",
              dedupKey: `faf-reauth-required-${new Date().toISOString().slice(0, 10)}`,
              targetUserIds: [userRow.id]
            });
          } catch {}

          return {
            status: "AUTH_REQUIRED",
            message: "FAF authentication has expired and requires re-authentication"
          };
        }

        if (result.status === "FAILED") {
          throw new Error(`FAF sync failed: ${result.errors.join("; ")}`);
        }

        if (result.status === "BLOCKED") {
          return {
            status: "BLOCKED",
            message: result.errors[0] || "FAF sync is blocked because no verified data endpoint is configured."
          };
        }

        return {
          inspected: result.recordsInspected,
          created: result.recordsCreated,
          updated: result.recordsUpdated,
          conflicts: result.conflictsDetected
        };
      }
    });

    registerJobHandler<FAFKeepAlivePayload, any>({
      type: "faf.keepalive",
      schema: fafKeepAlivePayloadSchema,
      defaultPriority: "LOW",
      defaultMaxAttempts: 1,
      handler: async () => {
        const result = await FAFSessionManager.keepAlive();
        return result;
      }
    });
  } catch {
    // Prevent duplicate registration in hot-reload
  }
}
