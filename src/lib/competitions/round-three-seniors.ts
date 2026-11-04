import type { StandingTeamEntry } from "./types";

export const OFFICIAL_ROUND_THREE_BASELINE_AT = "2026-11-04T00:00:00.000Z";

/**
 * Structured transcription of the official Seniors standings after Round Three (Ligue de Football de la Wilaya de Tiaret - LWFT).
 *
 * 1.  E Sidi Hosni:    J: 3, G: 2, P: 0, N: 1, BC: 1, BP: 9, +/-:  8, Pts: 7
 * 2.  RB Sougueur:     J: 3, G: 2, P: 0, N: 1, BC: 0, BP: 6, +/-:  6, Pts: 7
 * 3.  AG Tiaret:       J: 2, G: 1, P: 0, N: 1, BC: 1, BP: 4, +/-:  3, Pts: 4
 * 4.  JS Frenda:       J: 3, G: 1, P: 1, N: 1, BC: 4, BP: 3, +/-: -1, Pts: 4
 * 5.  S Ain Meriem:    J: 2, G: 1, P: 1, N: 0, BC: 7, BP: 2, +/-: -5, Pts: 3
 * 6.  CSNR Tiaret:     J: 2, G: 0, P: 0, N: 2, BC: 2, BP: 2, +/-:  0, Pts: 2
 * 7.  AB Rosfa:        J: 2, G: 0, P: 0, N: 2, BC: 1, BP: 1, +/-:  0, Pts: 2
 * 8.  Noudjoum Tiaret: J: 2, G: 0, P: 1, N: 1, BC: 3, BP: 0, +/-: -3, Pts: 1
 * 9.  AWF Chellala:    J: 2, G: 0, P: 1, N: 1, BC: 6, BP: 1, +/-: -5, Pts: 1
 * 10. UM Tiaret:       J: 3, G: 0, P: 3, N: 0, BC: 4, BP: 1, +/-: -3, Pts: 0
 */
export function getOfficialRoundThreeSeniorStandings(baselineAt = OFFICIAL_ROUND_THREE_BASELINE_AT): StandingTeamEntry[] {
  const rows: Array<[string, string, string, boolean, number, number, number, number, number, number, number, number]> = [
    ["esh", "E Sidi Hosni", "/branding/esh-logo-128.png", true, 3, 2, 1, 0, 9, 1, 7, 0],
    ["rb-sougueur", "RB Sougueur", "/branding/opponents/rb-sougueur.svg", false, 3, 2, 1, 0, 6, 0, 7, 0],
    ["ag-tiaret", "AG Tiaret", "/branding/opponents/ag-tiaret.svg", false, 2, 1, 1, 0, 4, 1, 4, 0],
    ["js-frenda", "JS Frenda", "/branding/opponents/js-frenda.svg", false, 3, 1, 1, 1, 3, 4, 4, 0],
    ["s-ain-meriem", "S Ain Meriem", "/branding/opponents/s-ain-meriem.svg", false, 2, 1, 0, 1, 2, 7, 3, 0],
    ["csnr-tiaret", "CSNR Tiaret", "/branding/opponents/csnr-tiaret.svg", false, 2, 0, 2, 0, 2, 2, 2, 0],
    ["ab-rosfa", "AB Rosfa", "/branding/opponents/ab-rosfa.svg", false, 2, 0, 2, 0, 1, 1, 2, 0],
    ["noudjoum-tiaret", "Noudjoum Tiaret", "/branding/opponents/noudjoum-tiaret.svg", false, 2, 0, 1, 1, 0, 3, 1, 0],
    ["awf-chellala", "AWF Chellala", "/branding/opponents/awf-chellala.svg", false, 2, 0, 1, 1, 1, 6, 1, 0],
    ["um-tiaret", "UM Tiaret", "/branding/opponents/um-tiaret.svg", false, 3, 0, 0, 3, 1, 4, 0, 0]
  ];

  return rows.map(([id, teamName, teamLogo, isOurClub, played, won, drawn, lost, goalsFor, goalsAgainst, points, pointsAdjustment]) => ({
    id: `official-r3-${id}`,
    rank: 0,
    teamName,
    teamLogo,
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
