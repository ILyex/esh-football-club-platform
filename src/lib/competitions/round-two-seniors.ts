import type { StandingTeamEntry } from "./types";

export const OFFICIAL_ROUND_TWO_BASELINE_AT = "2026-10-23T00:00:00.000Z";

/** Structured transcription of the official Seniors standings after round two. */
export function getOfficialRoundTwoSeniorStandings(baselineAt = OFFICIAL_ROUND_TWO_BASELINE_AT): StandingTeamEntry[] {
  const rows: Array<[string, string, boolean, number, number, number, number, number, number, number, number]> = [
    ["esh", "E Sidi Hosni", true, 2, 1, 1, 0, 7, 1, 4, 0],
    ["csnr-tiaret", "CSNR Tiaret", false, 2, 1, 1, 0, 4, 1, 4, 0],
    ["ag-tiaret", "AG Tiaret", false, 2, 1, 1, 0, 4, 1, 4, 0],
    ["noudjoum-tiaret", "Noudjoum Tiaret", false, 2, 1, 1, 0, 3, 0, 4, 0],
    ["js-frenda", "JS Frenda", false, 2, 1, 1, 0, 3, 2, 4, 0],
    ["rb-sougueur", "RB Sougueur", false, 1, 1, 0, 0, 5, 0, 3, 0],
    ["awf-chellala", "AWF Chellala", false, 2, 1, 0, 1, 3, 5, 3, 0],
    ["s-ain-meriem", "S Ain Meriem", false, 2, 1, 0, 1, 2, 7, 3, 0],
    ["ab-rosfa", "AB Rosfa", false, 1, 0, 1, 0, 1, 1, 1, 0],
    ["um-tiaret", "UM Tiaret", false, 2, 0, 0, 2, 1, 3, 0, 0],
    ["crb-serguine", "CRB Serguine", false, 2, 0, 0, 2, 0, 6, -3, -3],
    ["irb-mechraa-sfa", "IRB Mechraâ Sfa", false, 2, 0, 0, 2, 0, 6, -3, -3]
  ];

  return rows.map(([id, teamName, isOurClub, played, won, drawn, lost, goalsFor, goalsAgainst, points, pointsAdjustment]) => ({
    id: `official-r2-${id}`,
    rank: 0,
    teamName,
    teamLogo: "/branding/opponent-crest-default.svg",
    isOurClub,
    played,
    won,
    drawn,
    lost,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    points,
    pointsAdjustment,
    baselineAt
  }));
}
