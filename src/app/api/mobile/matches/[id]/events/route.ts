import { z } from "zod";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getNativePrincipal } from "@/lib/native-session";
import { hasPermission } from "@/lib/permissions";
import { resolveTeamScope, scopeIncludesTeam } from "@/lib/authz/policy";
import { writeAuditLog } from "@/lib/audit";
import { createMatchPushOutbox, enqueueMatchPushOutbox } from "@/lib/push/match-push";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { estimateShotXg } from "@/lib/matches/xg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const eventSchema = z.object({
  type: z.enum(["GOAL", "SHOT", "PENALTY_GOAL", "PENALTY_MISSED", "OWN_GOAL", "YELLOW_CARD", "RED_CARD", "SUBSTITUTION_IN"]),
  side: z.enum(["HOME", "AWAY"]),
  minute: z.number().int().min(0).max(150),
  playerId: z.string().min(1).max(64).optional(),
  outPlayerId: z.string().min(1).max(64).optional(),
  playerName: z.string().trim().max(120).optional(),
  outPlayerName: z.string().trim().max(120).optional(),
  assistPlayerId: z.string().min(1).max(64).optional(),
  bodyPart: z.enum(["RIGHT_FOOT", "LEFT_FOOT", "HEAD", "OTHER", "UNKNOWN"]).optional(),
  situation: z.enum(["OPEN_PLAY", "PENALTY", "FREE_KICK", "CORNER", "OTHER"]).optional(),
  outcome: z.enum(["SAVED", "OFF_TARGET", "BLOCKED", "WOODWORK"]).optional(),
  x: z.number().min(0).max(100).optional(),
  y: z.number().min(0).max(100).optional()
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
  let outPlayer: { id: string; firstName: string; lastName: string; firstNameFr: string | null; lastNameFr: string | null } | null = null;
  if (isClubEvent) {
    const requiresPlayer = ["GOAL", "SHOT", "PENALTY_GOAL", "PENALTY_MISSED", "OWN_GOAL", "YELLOW_CARD", "RED_CARD", "SUBSTITUTION_IN"].includes(input.type);
    if (requiresPlayer && (!input.playerId || !match.teamId)) return NextResponse.json({ error: "club_player_required" }, { status: 400 });
    if (!input.playerId) return NextResponse.json({ error: "club_player_required" }, { status: 400 });
    const player = await db.player.findUnique({ where: { id: input.playerId }, include: { team: { select: { category: true } } } });
    if (!player) return NextResponse.json({ error: "player_not_found" }, { status: 404 });
    const sameTeam = player.teamId === match.teamId;
    const eligibleYouth = match.team?.category === "SENIOR" && player.team?.category === "U20";
    const selectedForMatch = await db.matchLineup.findUnique({ where: { matchId_playerId: { matchId, playerId: player.id } }, select: { playerId: true } });
    if ((!sameTeam && !eligibleYouth) || (!sameTeam && !selectedForMatch) || input.side !== clubSide) return NextResponse.json({ error: "player_not_in_match" }, { status: 400 });
    playerId = player.id;
    playerName = `${player.firstName} ${player.lastName}`;
    playerNameFr = [player.firstNameFr, player.lastNameFr].filter(Boolean).join(" ").trim() || null;
    if (["GOAL", "PENALTY_GOAL"].includes(input.type) && (!input.bodyPart || input.bodyPart === "UNKNOWN")) return NextResponse.json({ error: "goal_body_part_required" }, { status: 400 });
    if (input.type === "SUBSTITUTION_IN") {
      if (!input.outPlayerId || input.outPlayerId === player.id) return NextResponse.json({ error: "substitution_requires_two_players" }, { status: 400 });
      outPlayer = await db.player.findUnique({ where: { id: input.outPlayerId }, select: { id: true, firstName: true, lastName: true, firstNameFr: true, lastNameFr: true } });
      if (!outPlayer) return NextResponse.json({ error: "player_not_found" }, { status: 404 });
      const outgoingLineup = await db.matchLineup.findUnique({ where: { matchId_playerId: { matchId, playerId: outPlayer.id } }, select: { selectionStatus: true, isStarting: true } });
      const incomingLineup = await db.matchLineup.findUnique({ where: { matchId_playerId: { matchId, playerId: player.id } }, select: { selectionStatus: true, isStarting: true } });
      if (outgoingLineup?.selectionStatus !== "STARTING" || incomingLineup?.selectionStatus !== "SUBSTITUTE") return NextResponse.json({ error: "invalid_substitution_roster" }, { status: 400 });
    }
    if (input.assistPlayerId) {
      if (!["GOAL", "PENALTY_GOAL"].includes(input.type) || input.assistPlayerId === player.id) return NextResponse.json({ error: "invalid_goal_assist" }, { status: 400 });
      const assist = await db.player.findFirst({ where: { id: input.assistPlayerId, teamId: match.teamId, status: "ACTIVE" }, select: { id: true } });
      if (!assist) return NextResponse.json({ error: "invalid_goal_assist" }, { status: 400 });
    }
  } else {
    playerName = input.playerName?.trim() || null;
    if (!playerName) return NextResponse.json({ error: "opponent_player_name_required" }, { status: 400 });
    if (input.type === "SUBSTITUTION_IN" && !input.outPlayerName?.trim()) return NextResponse.json({ error: "substitution_requires_two_players" }, { status: 400 });
  }

  const isShot = ["GOAL", "SHOT", "PENALTY_GOAL", "PENALTY_MISSED"].includes(input.type);
  if (isShot && isClubEvent && input.type === "SHOT" && !input.outcome) return NextResponse.json({ error: "shot_outcome_required" }, { status: 400 });
  if (isShot && isClubEvent && !["PENALTY_GOAL", "PENALTY_MISSED"].includes(input.type) && ((input.x == null) !== (input.y == null))) return NextResponse.json({ error: "shot_location_incomplete" }, { status: 400 });
  if (isShot && isClubEvent && ["GOAL", "SHOT"].includes(input.type) && (input.x == null || input.y == null)) return NextResponse.json({ error: "shot_location_required" }, { status: 400 });

  const result = await db.$transaction(async (tx) => {
    const pairKey = input.type === "SUBSTITUTION_IN" ? `__SUBSTITUTION_PAIR__:${randomUUID()}` : null;
    const event = await tx.matchEvent.create({ data: {
      matchId, playerId, playerName, playerNameFr, type: input.type, side: input.side,
      source: "MANUAL", minute: input.minute, notes: pairKey
    } });
    if (input.type === "SUBSTITUTION_IN") {
      await tx.matchEvent.create({ data: {
        matchId, playerId: outPlayer?.id ?? null,
        playerName: isClubEvent ? `${outPlayer!.firstName} ${outPlayer!.lastName}` : input.outPlayerName?.trim(),
        playerNameFr: isClubEvent ? [outPlayer!.firstNameFr, outPlayer!.lastNameFr].filter(Boolean).join(" ").trim() || null : null,
        type: "SUBSTITUTION_OUT", side: input.side, source: "MANUAL", minute: input.minute, notes: pairKey
      } });
    }
    if (["GOAL", "PENALTY_GOAL", "OWN_GOAL"].includes(input.type)) {
      await tx.match.update({ where: { id: matchId }, data: input.side === "HOME" ? { homeScore: { increment: 1 } } : { awayScore: { increment: 1 } } });
    }
    if (isShot && isClubEvent) {
      const situation = ["PENALTY_GOAL", "PENALTY_MISSED"].includes(input.type) ? "PENALTY" : (input.situation ?? "OPEN_PLAY");
      const outcome = input.type === "PENALTY_MISSED" ? "PENALTY_MISSED" : ["GOAL", "PENALTY_GOAL"].includes(input.type) ? "GOAL" : input.outcome!;
      await tx.playerShot.create({ data: {
        matchId, matchEventId: event.id, playerId, assistPlayerId: input.assistPlayerId ?? null,
        side: input.side, minute: input.minute, bodyPart: input.bodyPart ?? "UNKNOWN", situation, outcome,
        x: input.x ?? null, y: input.y ?? null,
        xG: estimateShotXg({ x: input.x, y: input.y, bodyPart: input.bodyPart, situation }), xgModelVersion: "esh-xg-v2"
      } });
    }
    const isGoal = ["GOAL", "PENALTY_GOAL", "OWN_GOAL"].includes(input.type);
    const homeScore = (match.homeScore ?? 0) + (isGoal && input.side === "HOME" ? 1 : 0);
    const awayScore = (match.awayScore ?? 0) + (isGoal && input.side === "AWAY" ? 1 : 0);
    const outbox = ["GOAL", "PENALTY_GOAL", "OWN_GOAL"].includes(input.type) && match.status === "LIVE" && match.team?.category
      ? await createMatchPushOutbox(tx, {
          dedupKey: `GOAL:${event.id}`, matchId, matchEventId: event.id, kind: "GOAL",
          payload: { matchId, teamId: match.teamId, category: match.team.category, homeTeamName: match.homeTeamName, awayTeamName: match.awayTeamName, homeScore, awayScore, minute: input.minute, side: input.side, playerName, playerNameFr }
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
