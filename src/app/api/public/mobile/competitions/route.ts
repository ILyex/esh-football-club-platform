import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCompetitionDisplayData } from "@/lib/competitions";
import { getLiveCompetitionStandings } from "@/lib/competitions/live-standings";
import { frenchCompetitionName, frenchPublicClubName, frenchPublicText } from "@/lib/public/locale-text";
import { normalizePublicMediaUrl } from "@/lib/media-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale") === "fr" ? "fr" : "ar";
  const records = await db.competition.findMany({
    select: {
      id: true, name: true, organization: true, standingsData: true, bracketData: true,
      type: true, logoUrl: true, status: true,
      seasonId: true, season: { select: { label: true, isCurrent: true } }, team: { select: { category: true } }
    },
    orderBy: { name: "asc" }
  });
  const competitions = await Promise.all(records.map(async (competition) => {
    const display = getCompetitionDisplayData(competition.standingsData, competition.bracketData);
    const standings = await getLiveCompetitionStandings(competition.id, display.standings);
    return {
      id: competition.id,
      name: locale === "fr" ? frenchCompetitionName(competition.name) : competition.name,
      organization: locale === "fr" ? frenchPublicText(competition.organization, "") : competition.organization,
      seasonLabel: locale === "fr" ? frenchPublicText(competition.season.label, "Saison") : competition.season.label,
      seasonId: competition.seasonId,
      isCurrentSeason: competition.season.isCurrent,
      type: competition.type,
      status: competition.status,
      logoUrl: normalizePublicMediaUrl(competition.logoUrl),
      category: competition.team?.category ?? "SENIOR",
      standings: standings.map((row) => ({
        ...row,
        teamLogo: normalizePublicMediaUrl(row.teamLogo) ?? row.teamLogo ?? null,
        teamName: locale === "fr" ? frenchPublicClubName(row.teamName, row.isOurClub ? "Club Espoir Sidi Hosni" : "Club adverse") : row.teamName
      })),
      bracket: display.bracket.rounds.map((round) => ({
        ...round,
        label: locale === "fr" ? frenchPublicText(round.labelFr, "Tour") : round.labelAr,
        matches: round.matches.map((match) => ({
          ...match,
          homeTeam: {
            ...match.homeTeam,
            name: locale === "fr" ? frenchPublicClubName(match.homeTeam.name, match.homeTeam.isOurClub ? "Club Espoir Sidi Hosni" : "Club adverse") : match.homeTeam.name,
            logo: normalizePublicMediaUrl(match.homeTeam.logo)
          },
          awayTeam: {
            ...match.awayTeam,
            name: locale === "fr" ? frenchPublicClubName(match.awayTeam.name, match.awayTeam.isOurClub ? "Club Espoir Sidi Hosni" : "Club adverse") : match.awayTeam.name,
            logo: normalizePublicMediaUrl(match.awayTeam.logo)
          }
        }))
      }))
    };
  }));
  return NextResponse.json({ competitions }, { headers: { "Cache-Control": "no-store" } });
}
