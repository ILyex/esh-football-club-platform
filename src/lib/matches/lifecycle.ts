import "server-only";

import { db } from "@/lib/db";

/** Promote scheduled matches as soon as their kickoff time is reached. */
export async function promoteDueMatchesToLive(now = new Date()): Promise<number> {
  const result = await db.match.updateMany({
    where: { status: "SCHEDULED", matchDate: { lte: now } },
    data: { status: "LIVE" }
  });
  return result.count;
}
