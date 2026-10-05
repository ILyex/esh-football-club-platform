import "server-only";
import { db } from "@/lib/db";
import { TeamCategory, CompetitionStatus } from "@prisma/client";

// ============================================================================
// PUBLIC COMPETITIONS DATA ACCESS
// ----------------------------------------------------------------------------
// Strictly projects verified competition records and matches.
// Does NOT fabricate unverified league standings or fake points tables.
// ============================================================================

export interface PublicCompetitionItem {
  id: string;
  name: string;
  organization: string | null;
  status: CompetitionStatus;
  seasonLabel: string;
  teamCategory: TeamCategory | null;
  matchCount: number;
  recentMatches: {
    id: string;
    matchDate: Date;
    homeTeamName: string;
    awayTeamName: string;
    homeScore: number | null;
    awayScore: number | null;
    status: string;
  }[];
}

export async function getPublicCompetitions(): Promise<PublicCompetitionItem[]> {
  const competitions = await db.competition.findMany({
    select: {
      id: true,
      name: true,
      organization: true,
      status: true,
      season: {
        select: { label: true }
      },
      team: {
        select: { category: true }
      },
      matches: {
        select: {
          id: true,
          matchDate: true,
          homeTeamName: true,
          awayTeamName: true,
          homeScore: true,
          awayScore: true,
          status: true
        },
        orderBy: { matchDate: "desc" },
        take: 5
      },
      _count: {
        select: { matches: true }
      }
    },
    orderBy: { name: "asc" }
  });

  return competitions.map((c) => ({
    id: c.id,
    name: c.name,
    organization: c.organization,
    status: c.status,
    seasonLabel: c.season.label,
    teamCategory: c.team?.category ?? null,
    matchCount: c._count.matches,
    recentMatches: c.matches
  }));
}
