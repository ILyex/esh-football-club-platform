import "server-only";

import { db } from "@/lib/db";
import { createMatchPushOutbox, enqueueMatchPushOutbox } from "@/lib/push/match-push";
/** Start scheduled matches at kickoff. A match is finished only by an operator. */
export async function promoteDueMatchesToLive(now = new Date()): Promise<number> {
  const due = await db.match.findMany({
    where: { status: "SCHEDULED", matchDate: { lte: now }, teamId: { not: null } },
    select: {
      id: true,
      matchDate: true,
      homeTeamName: true,
      awayTeamName: true,
      homeScore: true,
      awayScore: true,
      team: { select: { category: true } }
    }
  });
  if (due.length === 0) return 0;

  const outboxIds = await db.$transaction(async (tx) => {
    const createdOutboxIds: string[] = [];
    for (const match of due) {
      const promoted = await tx.match.updateMany({
        where: { id: match.id, status: "SCHEDULED" },
        data: { status: "LIVE" }
      });
      if (!promoted.count) continue;

      const outbox = await createMatchPushOutbox(tx, {
        dedupKey: `MATCH_STARTED:${match.id}:${match.matchDate.getTime()}`,
        matchId: match.id,
        kind: "MATCH_STARTED",
        payload: {
          matchId: match.id,
          category: match.team?.category ?? null,
          homeTeamName: match.homeTeamName,
          awayTeamName: match.awayTeamName,
          homeScore: match.homeScore,
          awayScore: match.awayScore
        }
      });
      createdOutboxIds.push(outbox.id);
    }
    return createdOutboxIds;
  });

  await Promise.all(outboxIds.map((id) => enqueueMatchPushOutbox(id)));
  return outboxIds.length;
}
