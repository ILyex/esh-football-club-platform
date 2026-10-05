import type { StandingTeamEntry } from "./types";

/** Sorts football standings by points, goal difference, and goals scored. Exact statistical ties share a rank. */
export function rankStandings(entries: StandingTeamEntry[]): StandingTeamEntry[] {
  const sorted = [...entries].sort((a, b) =>
    b.points - a.points ||
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor ||
    a.teamName.localeCompare(b.teamName)
  );

  let rank = 0;
  let previousKey = "";
  return sorted.map((team, index) => {
    const key = `${team.points}:${team.goalDifference}:${team.goalsFor}`;
    if (key !== previousKey) rank = index + 1;
    previousKey = key;
    return { ...team, rank };
  });
}
