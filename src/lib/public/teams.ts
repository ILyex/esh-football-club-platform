import "server-only";
import { db } from "@/lib/db";
import { TeamCategory, PlayerPosition } from "@prisma/client";
import { ROSTER_PLAYER_STATUSES } from "@/lib/teams/roster";

// ============================================================================
// PUBLIC TEAMS & ROSTERS DATA ACCESS
// ----------------------------------------------------------------------------
// Strictly projects public-safe roster and player data.
// Excludes internal notes, contracts, wage details, documents, and private IDs.
// ============================================================================

export interface PublicTeamSummary {
  id: string;
  category: TeamCategory;
  name: string;
  shortName: string | null;
  description: string | null;
  birthYearFrom: number | null;
  birthYearTo: number | null;
  playerCount: number;
}

export interface PublicPlayerItem {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  firstNameFr?: string | null;
  lastNameFr?: string | null;
  shirtNumber: number | null;
  position: PlayerPosition;
  nationality: string;
  photoUrl: string | null;
  dateOfBirth: Date;
  age: number;
  teamCategory: TeamCategory;
}

export interface PublicStaffItem {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  photoUrl: string | null;
  biography: string | null;
}

export interface PublicTeamDetail {
  id: string;
  category: TeamCategory;
  name: string;
  shortName: string | null;
  description: string | null;
  birthYearFrom: number | null;
  birthYearTo: number | null;
  staff: PublicStaffItem[];
  playersByPosition: {
    goalkeepers: PublicPlayerItem[];
    defenders: PublicPlayerItem[];
    midfielders: PublicPlayerItem[];
    forwards: PublicPlayerItem[];
  };
  totalPlayers: number;
}

export interface PublicPlayerProfile {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  firstNameFr?: string | null;
  lastNameFr?: string | null;
  shirtNumber: number | null;
  position: PlayerPosition;
  nationality: string;
  dateOfBirth: Date;
  age: number;
  height: number | null;
  preferredFoot: string | null;
  photoUrl: string | null;
  biography: string | null;
  status: string;
  team: {
    id: string;
    name: string;
    category: TeamCategory;
  } | null;
  stats: {
    appearances: number;
    goals: number;
  };
}

function calculateAge(dob: Date): number {
  const diff = Date.now() - dob.getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

/** Fetches all active club teams with player count. */
export async function getPublicTeams(): Promise<PublicTeamSummary[]> {
  const teams = await db.team.findMany({
    where: { active: true },
    select: {
      id: true,
      category: true,
      name: true,
      shortName: true,
      description: true,
      birthYearFrom: true,
      birthYearTo: true,
      _count: {
        select: {
          players: {
            where: { status: { in: [...ROSTER_PLAYER_STATUSES] } }
          }
        }
      }
    },
    orderBy: { category: "asc" }
  });

  // Standard category sorting order: SENIOR first, then descending youth
  const categoryOrder: Record<TeamCategory, number> = {
    SENIOR: 1,
    U20: 2,
    U17: 3,
    U15: 4
  };

  return teams
    .map((t) => ({
      id: t.id,
      category: t.category,
      name: t.name,
      shortName: t.shortName,
      description: t.description,
      birthYearFrom: t.birthYearFrom,
      birthYearTo: t.birthYearTo,
      playerCount: t._count.players
    }))
    .sort((a, b) => (categoryOrder[a.category] ?? 99) - (categoryOrder[b.category] ?? 99));
}

/** Fetches a public team and its active roster categorized by pitch position. */
export async function getPublicTeamByCategory(category: TeamCategory): Promise<PublicTeamDetail | null> {
  const team = await db.team.findFirst({
    where: { category, active: true },
    select: {
      id: true,
      category: true,
      name: true,
      shortName: true,
      description: true,
      birthYearFrom: true,
      birthYearTo: true,
      staff: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          photoUrl: true,
          biography: true
        },
        orderBy: [{ role: "asc" }, { lastName: "asc" }]
      },
      players: {
        where: { status: { in: [...ROSTER_PLAYER_STATUSES] } },
        select: {
          id: true,
          slug: true,
          firstName: true,
          lastName: true,
          firstNameFr: true,
          lastNameFr: true,
          shirtNumber: true,
          position: true,
          nationality: true,
          photoUrl: true,
          dateOfBirth: true
        },
        orderBy: [{ shirtNumber: "asc" }, { lastName: "asc" }]
      }
    }
  });

  if (!team) return null;

  const mappedPlayers: PublicPlayerItem[] = team.players.map((p) => ({
    id: p.id,
    slug: p.slug,
    firstName: p.firstName,
    lastName: p.lastName,
    firstNameFr: p.firstNameFr,
    lastNameFr: p.lastNameFr,
    shirtNumber: p.shirtNumber,
    position: p.position,
    nationality: p.nationality,
    photoUrl: p.photoUrl,
    dateOfBirth: p.dateOfBirth,
    age: calculateAge(p.dateOfBirth),
    teamCategory: team.category
  }));

  return {
    id: team.id,
    category: team.category,
    name: team.name,
    shortName: team.shortName,
    description: team.description,
    birthYearFrom: team.birthYearFrom,
    birthYearTo: team.birthYearTo,
    staff: team.staff.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      role: s.role,
      photoUrl: s.photoUrl,
      biography: s.biography
    })),
    playersByPosition: {
      goalkeepers: mappedPlayers.filter((p) => p.position === "GOALKEEPER"),
      defenders: mappedPlayers.filter((p) => p.position === "DEFENDER"),
      midfielders: mappedPlayers.filter((p) => p.position === "MIDFIELDER"),
      forwards: mappedPlayers.filter((p) => p.position === "FORWARD")
    },
    totalPlayers: mappedPlayers.length
  };
}

/** Fetches a public player profile by slug with localized biography and official match statistics. */
export async function getPublicPlayerBySlug(slug: string, locale: string): Promise<PublicPlayerProfile | null> {
  const player = await db.player.findFirst({
    where: {
      slug,
      status: { not: "ARCHIVED" }
    },
    select: {
      id: true,
      slug: true,
      firstName: true,
      lastName: true,
      firstNameFr: true,
      lastNameFr: true,
      shirtNumber: true,
      position: true,
      nationality: true,
      dateOfBirth: true,
      height: true,
      preferredFoot: true,
      photoUrl: true,
      biography: true,
      status: true,
      team: {
        select: {
          id: true,
          name: true,
          category: true
        }
      },
      translations: {
        where: { locale },
        select: { biography: true }
      },
      _count: {
        select: {
          matchLineups: true,
          matchEvents: {
            where: { type: "GOAL" }
          }
        }
      }
    }
  });

  if (!player) return null;

  // Use localized biography if available, otherwise fallback to main biography
  const biography = player.translations[0]?.biography || player.biography;

  return {
    id: player.id,
    slug: player.slug,
    firstName: player.firstName,
    lastName: player.lastName,
    firstNameFr: player.firstNameFr,
    lastNameFr: player.lastNameFr,
    shirtNumber: player.shirtNumber,
    position: player.position,
    nationality: player.nationality,
    dateOfBirth: player.dateOfBirth,
    age: calculateAge(player.dateOfBirth),
    height: player.height,
    preferredFoot: player.preferredFoot,
    photoUrl: player.photoUrl,
    biography,
    status: player.status,
    team: player.team
      ? {
          id: player.team.id,
          name: player.team.name,
          category: player.team.category
        }
      : null,
    stats: {
      appearances: player._count.matchLineups,
      goals: player._count.matchEvents
    }
  };
}
