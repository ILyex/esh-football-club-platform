import { TeamCategory, CompetitionType } from "@prisma/client";

export interface StandingTeamEntry {
  id: string;
  rank: number;
  teamName: string;
  teamLogo?: string | null;
  isOurClub: boolean;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form?: ("W" | "D" | "L")[];
}

export interface CupTeamSide {
  name: string;
  logo?: string | null;
  score?: number | null;
  penalties?: number | null;
  isOurClub?: boolean;
}

export interface CupMatchEntry {
  id: string;
  round: "ROUND_OF_16" | "QUARTER_FINAL" | "SEMI_FINAL" | "FINAL";
  matchOrder: number;
  homeTeam: CupTeamSide;
  awayTeam: CupTeamSide;
  winner?: "HOME" | "AWAY" | null;
  status: "SCHEDULED" | "LIVE" | "FINISHED";
  date?: string | null;
  notes?: string | null;
}

export interface CupBracketData {
  rounds: {
    roundKey: "ROUND_OF_16" | "QUARTER_FINAL" | "SEMI_FINAL" | "FINAL";
    labelAr: string;
    labelFr: string;
    matches: CupMatchEntry[];
  }[];
}

export const OFFICIAL_CATEGORY_NAMES: Record<TeamCategory, { ar: string; fr: string }> = {
  SENIOR: { ar: "الأكابر", fr: "Séniors" },
  U20: { ar: "الأواسط (U20)", fr: "U20" },
  U17: { ar: "الأشبال (U17)", fr: "U17" },
  U15: { ar: "الأصاغر (U15)", fr: "U15" }
};

export const CLUB_DEFAULT_CREST = "/branding/esh-logo-128.png";
export const CUP_DEFAULT_LOGO = "/branding/coupe-algerie-logo.svg";
export const LEAGUE_DEFAULT_LOGO = "/branding/ligue-algerie-logo.svg";

/**
 * Normalizes team name for matching against opponent logos.
 */
export function normalizeTeamName(name: string): string {
  return name.trim().toLowerCase().replace(/[\(\)\[\]]/g, "").replace(/\s+/g, " ");
}
