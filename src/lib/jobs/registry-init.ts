import { z } from "zod";
import { registerJobHandler, hasJobHandler } from "./registry";
import { syncNotifications } from "@/lib/insights/notifications";
import { dispatchNotification } from "@/lib/notifications/service";
import { db } from "@/lib/db";
import { registerFAFJobHandlers } from "@/lib/integrations/faf/job-handler";

// ============================================================================
// P5 — BUILT-IN JOB HANDLERS REGISTRATION
// ----------------------------------------------------------------------------
// Idempotently initializes the system's registered job handlers:
//   1. "insights.sync": Computes insights and dispatches scoped notifications.
//   2. "notification.dispatch": Directly dispatches a notification payload.
// ============================================================================

import { registerGmailJobHandlers } from "@/lib/integrations/gmail/job-handler";

export function initializeJobRegistry(): void {
  registerGmailJobHandlers();
  registerFAFJobHandlers();

  if (!hasJobHandler("insights.sync")) {
    registerJobHandler({
      type: "insights.sync",
      schema: z.object({
        triggerSource: z.string().optional()
      }),
      defaultPriority: "DEFAULT",
      defaultMaxAttempts: 3,
      handler: async () => {
        const result = await syncNotifications();
        return result;
      }
    });
  }

  if (!hasJobHandler("notification.dispatch")) {
    registerJobHandler({
      type: "notification.dispatch",
      schema: z.object({
        type: z.string(),
        title: z.string(),
        message: z.string().nullable().optional(),
        params: z.record(z.union([z.string(), z.number()])).nullable().optional(),
        link: z.string().nullable().optional(),
        teamId: z.string().nullable().optional(),
        requiredPermission: z.string(),
        dedupKey: z.string(),
        targetUserIds: z.array(z.string()).optional()
      }),
      defaultPriority: "HIGH",
      defaultMaxAttempts: 3,
      handler: async (payload) => {
        return await dispatchNotification(db, payload as any);
      }
    });
  }

  if (!hasJobHandler("faf.match_sync")) {
    registerJobHandler({
      type: "faf.match_sync",
      schema: z.object({
        matchId: z.string(),
        userId: z.string().optional()
      }),
      defaultPriority: "HIGH",
      defaultMaxAttempts: 3,
      handler: async (payload) => {
        const { syncFafMatchDocuments } = await import("@/lib/integrations/faf/match-sheet-sync");
        const { matchId, userId } = payload as { matchId: string; userId?: string };
        return await syncFafMatchDocuments(matchId, userId);
      }
    });
  }
}

// Auto-initialize on module load
initializeJobRegistry();
