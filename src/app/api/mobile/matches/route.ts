import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getNativePrincipal } from "@/lib/native-session";
import { hasPermission } from "@/lib/permissions";
import { resolveTeamScope, scopeIncludesTeam } from "@/lib/authz/policy";
import { matchSchema } from "@/lib/validations/match";
import { writeAuditLog } from "@/lib/audit";
import { matchStadium } from "@/lib/matches/stadium";
import { ensureCompetitionStandingsBaseline } from "@/lib/competitions/live-standings";
import { revalidatePath } from "next/cache";
import { getOpponentLogo, saveOpponentClub } from "@/lib/opponents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getNativePrincipal(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasPermission(user, "matches.create")) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = matchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_match", issues: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), code: issue.code })) }, { status: 400 });

  const scope = await resolveTeamScope(db, user);
  if (!scopeIncludesTeam(scope, parsed.data.teamId)) return NextResponse.json({ error: "team_scope_forbidden" }, { status: 403 });
  const [team, competition] = await Promise.all([
    db.team.findFirst({ where: { id: parsed.data.teamId, active: true }, select: { id: true } }),
    db.competition.findUnique({ where: { id: parsed.data.competitionId }, select: { id: true, teamId: true } })
  ]);
  if (!team) return NextResponse.json({ error: "team_not_found" }, { status: 400 });
  if (!competition) return NextResponse.json({ error: "competition_not_found" }, { status: 400 });
  if (competition.teamId && competition.teamId !== team.id) return NextResponse.json({ error: "competition_team_mismatch" }, { status: 400 });

  const stadium = matchStadium(parsed.data.isHomeFixture, parsed.data.stadium);
  const opponent = parsed.data.opponent.trim();
  const opponentName = parsed.data.opponentNameFr?.trim() ? `${opponent} (${parsed.data.opponentNameFr.trim()})` : opponent;
  const clubName = "نادي أمل سيدي حسني";
  const homeTeamName = parsed.data.isHomeFixture ? clubName : opponentName;
  const awayTeamName = parsed.data.isHomeFixture ? opponentName : clubName;
  const opponentLogoUrl = await getOpponentLogo(opponent).catch(() => null);

  const match = await db.$transaction(async (tx) => {
    const created = await tx.match.create({
      data: {
        competitionId: parsed.data.competitionId,
        teamId: parsed.data.teamId,
        homeTeamName,
        awayTeamName,
        isHomeFixture: parsed.data.isHomeFixture,
        matchDate: parsed.data.matchDate,
        stadium,
        status: "SCHEDULED",
        hasExtraTime: false,
        hasPenaltyShootout: false
      }
    });
    await tx.calendarEvent.upsert({
      where: { relatedMatchId: created.id },
      update: { title: `${homeTeamName} vs ${awayTeamName}`, startDateTime: parsed.data.matchDate, endDateTime: new Date(parsed.data.matchDate.getTime() + 2 * 60 * 60 * 1000), teamId: team.id, location: stadium || null },
      create: { title: `${homeTeamName} vs ${awayTeamName}`, type: "MATCH", startDateTime: parsed.data.matchDate, endDateTime: new Date(parsed.data.matchDate.getTime() + 2 * 60 * 60 * 1000), teamId: team.id, location: stadium || null, relatedMatchId: created.id }
    });
    await writeAuditLog({ userId: user.id, action: "match.create", entityType: "Match", entityId: created.id, changes: { after: parsed.data, opponentLogoUrl, source: "mobile" } }, tx);
    return created;
  });

  if (opponentLogoUrl) {
    await saveOpponentClub(opponent, opponentLogoUrl, stadium, parsed.data.opponentNameFr ? [parsed.data.opponentNameFr] : []).catch((error) => {
      console.error("Could not update the saved opponent club from a mobile match:", error instanceof Error ? error.message : "unknown error");
    });
  }
  try {
    await ensureCompetitionStandingsBaseline(parsed.data.competitionId);
  } catch (error) {
    console.error("Could not initialize standings after creating a mobile match:", error instanceof Error ? error.message : "unknown error");
  }
  for (const path of ["/[locale]/dashboard/matches", "/[locale]/dashboard/calendar", "/[locale]/dashboard/competitions", "/[locale]/competitions", "/[locale]/matches", "/[locale]"]) {
    try { revalidatePath(path, "page"); } catch { /* The saved match remains authoritative. */ }
  }
  return NextResponse.json({ id: match.id }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
