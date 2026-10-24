import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCompetitionDisplayData } from "@/lib/competitions";
import { getLiveCompetitionStandings } from "@/lib/competitions/live-standings";
import { frenchCompetitionName, frenchPublicText } from "@/lib/public/locale-text";
import { normalizePublicMediaUrl } from "@/lib/media-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale") === "fr" ? "fr" : "ar";
  const records = await db.competition.findMany({
    select: {
      id: true, name: true, organization: true, standingsData: true, bracketData: true,
      season: { select: { label: true } }, team: { select: { category: true } }
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
      category: competition.team?.category ?? "SENIOR",
      standings: standings.map((row) => ({
        ...row,
        teamLogo: normalizePublicMediaUrl(row.teamLogo) ?? row.teamLogo ?? null,
        teamName: locale === "fr" ? frenchPublicText(row.teamName, row.isOurClub ? "Club Espoir Sidi Hosni" : "Adversaire") : row.teamName
      }))
    };
  }));
  return NextResponse.json({ competitions }, { headers: { "Cache-Control": "no-store" } });
}
