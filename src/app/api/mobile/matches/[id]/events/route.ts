import { z } from "zod";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getNativePrincipal } from "@/lib/native-session";
import { hasPermission } from "@/lib/permissions";
import { resolveTeamScope, scopeIncludesTeam } from "@/lib/authz/policy";
import { writeAuditLog } from "@/lib/audit";
import { createMatchPushOutbox, enqueueMatchPushOutbox } from "@/lib/push/match-push";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const eventSchema = z.object({
  type: z.enum(["GOAL", "YELLOW_CARD", "RED_CARD"]),
  side: z.enum(["HOME", "AWAY"]),
  minute: z.number().int().min(0).max(150),
  playerId: z.string().min(1).max(64).optional(),
  playerName: z.string().trim().max(120).optional(),
  bodyPart: z.enum(["FOOT", "HEAD", "OTHER"]).optional()
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getNativePrincipal(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasPermission(user, "matches.report")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id: matchId } = await context.params;
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_event" }, { status: 400 });
  const match = await db.match.findUnique({ where: { id: matchId }, include: { team: { select: { category: true } } } });
  if (!match) return NextResponse.json({ error: "match_not_found" }, { status: 404 });
  const scope = await resolveTeamScope(db, user);
  if (!scopeIncludesTeam(scope, match.teamId)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (match.status !== "LIVE" && match.status !== "FINISHED") return NextResponse.json({ error: "match_not_live" }, { status: 409 });

  const input = parsed.data;
  const clubSide = match.isHomeFixture ? "HOME" : "AWAY";
  const isClubEvent = input.side === clubSide;
  let playerId: string | null = null;
  let playerName: string | null = null;
  let playerNameFr: string | null = null;
  if (isClubEvent) {
    if (!input.playerId || !match.teamId) return NextResponse.json({ error: "club_player_required" }, { status: 400 });
    const player = await db.player.findUnique({ where: { id: input.playerId }, include: { team: { select: { category: true } } } });
    if (!player) return NextResponse.json({ error: "player_not_found" }, { status: 404 });
    const sameTeam = player.teamId === match.teamId;
    const eligibleYouth = match.team?.category === "SENIOR" && player.team?.category === "U20";
    const selectedForMatch = await db.matchLineup.findUnique({ where: { matchId_playerId: { matchId, playerId: player.id } }, select: { playerId: true } });
    if ((!sameTeam && !eligibleYouth) || (!sameTeam && !selectedForMatch) || input.side !== clubSide) return NextResponse.json({ error: "player_not_in_match" }, { status: 400 });
    playerId = player.id;
    playerName = `${player.firstName} ${player.lastName}`;
    playerNameFr = [player.firstNameFr, player.lastNameFr].filter(Boolean).join(" ").trim() || null;
    if (input.type === "GOAL" && !input.bodyPart) return NextResponse.json({ error: "goal_body_part_required" }, { status: 400 });
  } else {
    playerName = input.playerName?.trim() || null;
    if (!playerName) return NextResponse.json({ error: "opponent_player_name_required" }, { status: 400 });
  }

  const result = await db.$transaction(async (tx) => {
    const event = await tx.matchEvent.create({ data: {
      matchId, playerId, playerName, playerNameFr, type: input.type, side: input.side,
      source: "MANUAL", minute: input.minute
    } });
    if (input.type === "GOAL") {
      await tx.match.update({ where: { id: matchId }, data: input.side === "HOME" ? { homeScore: { increment: 1 } } : { awayScore: { increment: 1 } } });
      if (playerId) await tx.playerShot.create({
        data: { matchId, matchEventId: event.id, playerId, side: input.side, minute: input.minute, bodyPart: input.bodyPart!, situation: "OPEN_PLAY", outcome: "GOAL", xgModelVersion: "esh-xg-v2" }
      });
    }
    const homeScore = (match.homeScore ?? 0) + (input.type === "GOAL" && input.side === "HOME" ? 1 : 0);
    const awayScore = (match.awayScore ?? 0) + (input.type === "GOAL" && input.side === "AWAY" ? 1 : 0);
    const outbox = input.type === "GOAL" && match.status === "LIVE" && match.team?.category
      ? await createMatchPushOutbox(tx, {
          dedupKey: `GOAL:${event.id}`, matchId, matchEventId: event.id, kind: "GOAL",
          payload: { matchId, category: match.team.category, homeTeamName: match.homeTeamName, awayTeamName: match.awayTeamName, homeScore, awayScore, minute: input.minute, side: input.side }
        })
      : null;
    await writeAuditLog({ userId: user.id, action: "match.mobile_event.create", entityType: "MatchEvent", entityId: event.id, changes: { after: input } }, tx);
    return { event, outbox };
  });
  if (result.outbox) await enqueueMatchPushOutbox(result.outbox.id);
  revalidatePath("/[locale]/dashboard/matches", "page");
  revalidatePath(`/[locale]/dashboard/matches/${matchId}`, "page");
  revalidatePath("/[locale]/field/matches", "page");
  revalidatePath(`/[locale]/matches/${matchId}`, "page");
  return NextResponse.json({ id: result.event.id, type: result.event.type, minute: result.event.minute, side: result.event.side }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
