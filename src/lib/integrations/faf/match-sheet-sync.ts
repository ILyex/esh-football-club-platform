import "server-only";

import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

export interface FafMatchSyncResult {
  success: boolean;
  matchId: string;
  message: string;
  refereeName?: string;
  matchSheetDocId?: string;
  refereeReportDocId?: string;
}

/**
 * The public FAF Connect/EMS pages currently have no verified, documented data
 * API configured for this app. Do not manufacture official-looking documents
 * or copy local match data into records presented as federation data.
 */
export async function syncFafMatchDocuments(
  matchId: string,
  userId: string = "system"
): Promise<FafMatchSyncResult> {
  const match = await db.match.findUnique({
    where: { id: matchId },
    select: { id: true }
  });

  if (!match) throw new Error("Match not found");

  const message =
    "FAF EMS data could not be imported: a verified, documented FAF data endpoint is not configured. No platform records were changed.";

  await writeAuditLog({
    userId,
    action: "FAF_MATCH_SYNC_BLOCKED",
    entityType: "Match",
    entityId: match.id,
    changes: { reason: "NO_VERIFIED_DATA_ENDPOINT" }
  });

  return { success: false, matchId: match.id, message };
}
