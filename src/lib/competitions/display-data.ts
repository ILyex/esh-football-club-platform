import type { CupBracketData, StandingTeamEntry } from "./types";

export interface CompetitionDisplayData {
  standings: StandingTeamEntry[];
  bracket: CupBracketData;
  hasUnverifiedTemplateData: boolean;
}

function isLegacyTemplateStandings(value: unknown): boolean {
  if (!Array.isArray(value) || (value.length !== 6 && value.length !== 10)) return false;
  return value.every((row) =>
    row &&
    typeof row === "object" &&
    /^standing-team-\d+$/.test(String((row as any).id)) &&
    Number.isInteger((row as any).played) &&
    Array.isArray((row as any).form) &&
    (row as any).form.join("") === "WWD"
  );
}

function isLegacyTemplateBracket(value: unknown): boolean {
  const rounds = value && typeof value === "object" ? (value as any).rounds : null;
  if (!Array.isArray(rounds) || rounds.length !== 3) return false;
  const matches = rounds.flatMap((round) => Array.isArray(round?.matches) ? round.matches : []);
  return matches.length === 7 && matches.every((match) =>
    match && typeof match === "object" &&
    /^(qf-[1-4]|sf-[1-2]|final-1)-(SENIOR|U20|U17|U15)$/.test(String(match.id))
  );
}

/** Hides known generated demo snapshots without modifying their stored source rows. */
export function getCompetitionDisplayData(
  standingsValue: unknown,
  bracketValue: unknown
): CompetitionDisplayData {
  const legacyStandings = isLegacyTemplateStandings(standingsValue);
  const legacyBracket = isLegacyTemplateBracket(bracketValue);
  const standings = Array.isArray(standingsValue) && !legacyStandings ? standingsValue as StandingTeamEntry[] : [];
  const bracket = !legacyBracket && bracketValue && typeof bracketValue === "object" && Array.isArray((bracketValue as any).rounds)
    ? bracketValue as CupBracketData
    : { rounds: [] };

  return {
    standings,
    bracket,
    hasUnverifiedTemplateData: legacyStandings || legacyBracket
  };
}
