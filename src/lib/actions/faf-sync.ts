"use server";

import { getSessionOrThrow, requirePermission, hasPermission } from "@/lib/permissions";
import { resolveUserTeamContext } from "@/lib/team-context";
import { enqueueFAFSyncJob } from "@/lib/integrations/faf/job-handler";
import { getFAFIntegrationStatus, syncFAFPlayers } from "@/lib/integrations/faf/sync-service";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

// ============================================================================
// PHASE 10B — FAF INTEGRATION SERVER ACTIONS
// ----------------------------------------------------------------------------
// Strictly permission-gated Server Actions for administrative FAF sync trigger
// and health inspection.
// ============================================================================

export async function getFAFStatusAction() {
  const user = await getSessionOrThrow();
  if (!hasPermission(user, "players.view") && !hasPermission(user, "settings.manage")) {
    throw new Error("Unauthorized to view FAF integration status");
  }

  return getFAFIntegrationStatus();
}

export async function triggerFAFSyncAction(formData: FormData) {
  const user = await requirePermission("settings.manage");
  const category = (formData.get("category") as string) || undefined;
  const isDryRun = formData.get("dryRun") === "true";

  // Enqueue background sync via P5 queue
  const job = await enqueueFAFSyncJob(db, {
    userId: user.id,
    category,
    dryRun: isDryRun
  });

  await writeAuditLog({
    userId: user.id,
    action: "FAF_SYNC_QUEUED",
    entityType: "BackgroundJob",
    entityId: job.id,
    changes: { category, dryRun: isDryRun }
  });

  return { success: true, jobId: job.id };
}

export async function updateFAFSessionAction(formData: FormData) {
  const user = await requirePermission("settings.manage");
  const cookie = (formData.get("sessionCookie") as string) || "";
  if (!cookie.trim()) {
    throw new Error("Session cookie is required");
  }

  const { FAFSessionManager } = await import("@/lib/integrations/faf/session-manager");
  const dto = await FAFSessionManager.updateSession(cookie);

  await writeAuditLog({
    userId: user.id,
    action: "FAF_SESSION_UPDATED",
    entityType: "Integration",
    changes: { status: dto.status, clubCode: dto.clubCode }
  });

  return { success: true, session: dto };
}

export async function keepAliveFAFSessionAction() {
  await requirePermission("settings.manage");
  const { FAFSessionManager } = await import("@/lib/integrations/faf/session-manager");
  const result = await FAFSessionManager.keepAlive();
  return result;
}

export async function syncFafMatchDocumentsAction(matchId: string) {
  const user = await getSessionOrThrow();
  if (!hasPermission(user, "matches.view") && !hasPermission(user, "news.view") && !hasPermission(user, "settings.manage")) {
    throw new Error("Unauthorized to sync FAF match documents");
  }

  const { syncFafMatchDocuments } = await import("@/lib/integrations/faf/match-sheet-sync");
  return syncFafMatchDocuments(matchId, user.id);
}

