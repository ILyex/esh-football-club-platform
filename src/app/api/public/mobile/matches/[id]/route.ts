import { NextResponse } from "next/server";
import { getPublicMatchDetail } from "@/lib/public/matches";
import { frenchCompetitionName, frenchPublicCategory, frenchPublicText, localizedClubName } from "@/lib/public/locale-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = await getPublicMatchDetail(id);
  if (!match) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const locale = new URL(request.url).searchParams.get("locale") === "fr" ? "fr" : "ar";
  const localized = locale === "fr" ? {
    ...match,
    homeTeamName: match.isHomeFixture ? "Club Espoir Sidi Hosni" : localizedClubName(match.homeTeamName, locale, "Club adverse"),
    awayTeamName: !match.isHomeFixture ? "Club Espoir Sidi Hosni" : localizedClubName(match.awayTeamName, locale, "Club adverse"),
    competitionName: frenchCompetitionName(match.competitionName),
    teamCategory: match.teamCategory ? frenchPublicCategory(match.teamCategory) : null,
    stadium: frenchPublicText(match.stadium, "Stade communal Taheri Hosni – Sidi Hosni"),
    refereeName: match.refereeNameFr || frenchPublicText(match.refereeNameAr || match.refereeName, "Arbitre à confirmer"),
    matchReport: match.matchReport ? frenchPublicText(match.matchReport, "Compte rendu du match") : null,
    events: match.events.map((event) => ({
      ...event,
      playerName: event.playerNameFr || frenchPublicText(event.playerName, "Joueur"),
      staffName: event.staffNameFr || (event.staffName ? frenchPublicText(event.staffName, "Staff") : null)
    })),
    startingLineup: match.startingLineup.map((player) => ({ ...player, playerName: player.playerNameFr || player.playerName })),
    substitutes: match.substitutes.map((player) => ({ ...player, playerName: player.playerNameFr || player.playerName })),
    shootoutKicks: match.shootoutKicks.map((kick) => ({ ...kick, playerName: kick.playerNameFr || kick.playerName }))
  } : match;
  return NextResponse.json(localized, { headers: { "Cache-Control": "no-store" } });
}
