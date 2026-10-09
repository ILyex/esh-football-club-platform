import "server-only";

import { db } from "@/lib/db";
/** Start scheduled matches at kickoff. A match is finished only by an operator. */
export async function promoteDueMatchesToLive(now = new Date()): Promise<number> {
  const result = await db.match.updateMany({
    where: { status: "SCHEDULED", matchDate: { lte: now } },
    data: { status: "LIVE" }
  });
  return result.count;
}
