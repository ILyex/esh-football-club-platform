import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getNativePrincipal } from "@/lib/native-session";
import { estimateShotXg } from "@/lib/matches/xg";
import { hasPermission } from "@/lib/permissions";
import type { TeamCategory } from "@prisma/client";
import { normalizePublicMediaUrl } from "@/lib/media-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live player performance for coaching accounts, scoped to their assigned categories. */
export async function GET(request: Request) {
  const user = await getNativePrincipal(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const mediaUrl = (value: string | null | undefined): string | null => {
    const normalized = normalizePublicMediaUrl(value);
    if (!normalized) return null;
    if (normalized.startsWith("/")) return new URL(normalized, request.url).toString();
    return normalized;
  };
  const privilegedRole = user.roleKey === "developer" || user.roleKey === "super_admin";
  const canViewPlayerStats = hasPermission(user, "player.stats.view") || privilegedRole;
  if (!canViewPlayerStats) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const [assignments, currentSeason] = await Promise.all([
    db.userTeam.findMany({ where: { userId: user.id }, select: { team: { select: { category: true } } } }),
    db.season.findFirst({ where: { isCurrent: true }, select: { id: true } }),
  ]);
  const categories = new Set(assignments.map(({ team }) => team.category));
  // Senior coaches also follow U20, matching the platform player-statistics rule.
  if (categories.has("SENIOR")) categories.add("U20");
  // Administrative and developer accounts may inspect all active categories.
  // They usually have no userTeam assignment, so an empty scope must not turn
  // an authorized request into a misleading empty or failed synchronization.
  if (privilegedRole && categories.size === 0) {
    (["SENIOR", "U20", "U17", "U15"] as TeamCategory[]).forEach((category) => categories.add(category));
  }
  const teams = await db.team.findMany({ where: { active: true, category: { in: [...categories] } }, select: { id: true, name: true, category: true } });
  const teamIds = teams.map(({ id }) => id);
  if (!teamIds.length) return NextResponse.json({ season: null, players: [] }, { headers: { "Cache-Control": "no-store" } });

  const seasons = await db.season.findMany({
    where: { competitions: { some: { matches: { some: { teamId: { in: teamIds }, status: { in: ["LIVE", "FINISHED"] } } } } } },
    select: { id: true, label: true, startDate: true }, orderBy: { startDate: "desc" }
  });
  const seasonId = seasons.some((season) => season.id === currentSeason?.id) ? currentSeason!.id : seasons[0]?.id;
  const players = await db.player.findMany({
    where: { teamId: { in: teamIds }, status: "ACTIVE" },
    select: { id: true, firstName: true, lastName: true, firstNameFr: true, lastNameFr: true, shirtNumber: true, position: true, photoUrl: true, teamId: true, team: { select: { name: true, category: true } } },
    orderBy: [{ team: { category: "asc" } }, { shirtNumber: "asc" }, { firstName: "asc" }, { lastName: "asc" }]
  });
  const playerIds = players.map(({ id }) => id);
  const matchFilter = { teamId: { in: teamIds }, status: { in: ["LIVE", "FINISHED"] as ("LIVE" | "FINISHED")[] }, ...(seasonId ? { competition: { seasonId } } : {}) };
  const [events, shots, lineups, matches] = playerIds.length ? await Promise.all([
    db.matchEvent.findMany({ where: { playerId: { in: playerIds }, match: matchFilter }, select: { playerId: true, matchId: true, minute: true, type: true } }),
    db.playerShot.findMany({ where: { playerId: { in: playerIds }, match: matchFilter }, select: { playerId: true, assistPlayerId: true, matchId: true, minute: true, outcome: true, xG: true, bodyPart: true, situation: true, x: true, y: true } }),
    db.matchLineup.findMany({ where: { playerId: { in: playerIds }, match: matchFilter }, select: { playerId: true, matchId: true, isStarting: true } }),
    db.match.findMany({ where: matchFilter, select: { id: true, matchDate: true, homeTeamName: true, awayTeamName: true }, orderBy: { matchDate: "desc" } })
  ]) : [[], [], [], []];

  const stats = new Map(players.map((player) => [player.id, {
    appearances: 0, starts: 0, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, xg: 0, xgShots: 0, yellowCards: 0, redCards: 0,
    rightFootShots: 0, leftFootShots: 0, headShots: 0, rightFootGoals: 0, leftFootGoals: 0, headGoals: 0, otherGoals: 0
  }]));
  for (const lineup of lineups) { const row = stats.get(lineup.playerId); if (row) { row.appearances++; if (lineup.isStarting) row.starts++; } }
  const linkedAssistKeys = new Set(shots.filter((shot) => shot.assistPlayerId && shot.outcome === "GOAL").map((shot) => `${shot.matchId}:${shot.assistPlayerId}:${shot.minute}`));
  for (const event of events) {
    if (!event.playerId) continue;
    const row = stats.get(event.playerId); if (!row) continue;
    if (event.type === "GOAL" || event.type === "PENALTY_GOAL") row.goals++;
    if (event.type === "ASSIST" && !linkedAssistKeys.has(`${event.matchId}:${event.playerId}:${event.minute}`)) row.assists++;
    if (event.type === "YELLOW_CARD") row.yellowCards++;
    if (event.type === "RED_CARD") row.redCards++;
  }
  for (const shot of shots) {
    const shooter = shot.playerId ? stats.get(shot.playerId) : null;
    if (shooter) {
      shooter.shots++;
      if (shot.outcome === "GOAL" || shot.outcome === "SAVED") shooter.shotsOnTarget++;
      const xg = estimateShotXg({ x: shot.x, y: shot.y, bodyPart: shot.bodyPart, situation: shot.situation });
      if (xg !== null) { shooter.xg += xg; shooter.xgShots++; }
      if (shot.bodyPart === "RIGHT_FOOT") shooter.rightFootShots++;
      if (shot.bodyPart === "LEFT_FOOT") shooter.leftFootShots++;
      if (shot.bodyPart === "HEAD") shooter.headShots++;
    }
    if (shot.assistPlayerId && shot.outcome === "GOAL") { const assister = stats.get(shot.assistPlayerId); if (assister) assister.assists++; }
    if (shot.outcome === "GOAL") {
      const scorer = shot.playerId ? stats.get(shot.playerId) : null;
      if (scorer) {
        if (shot.bodyPart === "RIGHT_FOOT") scorer.rightFootGoals++;
        else if (shot.bodyPart === "LEFT_FOOT") scorer.leftFootGoals++;
        else if (shot.bodyPart === "HEAD") scorer.headGoals++;
        else scorer.otherGoals++;
      }
    }
  }
  const matchesById = new Map(matches.map((match) => [match.id, match]));
  // Build the five most recent appearances in one pass. Filtering and sorting
  // the full lineup array once per player made this endpoint do O(players ×
  // lineups log lineups) work on every app refresh.
  const recentMatchesByPlayer = new Map<string, { date: string; opponent: string; isStarting: boolean }[]>();
  const recentLineups = [...lineups].sort((a, b) =>
    (matchesById.get(b.matchId)?.matchDate.getTime() ?? 0) - (matchesById.get(a.matchId)?.matchDate.getTime() ?? 0)
  );
  for (const lineup of recentLineups) {
    const match = matchesById.get(lineup.matchId);
    if (!match) continue;
    const recent = recentMatchesByPlayer.get(lineup.playerId) ?? [];
    if (recent.length >= 5) continue;
    recent.push({
      date: match.matchDate.toISOString(),
      opponent: `${match.homeTeamName} – ${match.awayTeamName}`,
      isStarting: lineup.isStarting,
    });
    recentMatchesByPlayer.set(lineup.playerId, recent);
  }
  const result = players.map((player) => ({
    id: player.id, firstName: player.firstName, lastName: player.lastName, firstNameFr: player.firstNameFr, lastNameFr: player.lastNameFr,
    number: player.shirtNumber, position: player.position, photoUrl: mediaUrl(player.photoUrl), team: player.team,
    ...(stats.get(player.id) ?? {}),
    recentMatches: recentMatchesByPlayer.get(player.id) ?? []
  }));
  return NextResponse.json({ season: seasons.find((season) => season.id === seasonId)?.label ?? null, players: result }, { headers: { "Cache-Control": "no-store" } });
}
