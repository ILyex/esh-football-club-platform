export type MatchSide = "HOME" | "AWAY";

export interface MatchResultInput {
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  hasPenaltyShootout: boolean;
  shootoutKicks: ReadonlyArray<{ side: MatchSide; result: "SCORED" | "MISSED" }>;
}

export interface ResolvedMatchResult {
  homePenaltyScore: number;
  awayPenaltyScore: number;
  winnerSide: MatchSide | null;
  decidedByPenalties: boolean;
}

export function resolveShootoutWinner(kicks: MatchResultInput["shootoutKicks"]): MatchSide | null {
  const homeKicks = kicks.filter((kick) => kick.side === "HOME");
  const awayKicks = kicks.filter((kick) => kick.side === "AWAY");
  const homeGoals = homeKicks.filter((kick) => kick.result === "SCORED").length;
  const awayGoals = awayKicks.filter((kick) => kick.result === "SCORED").length;
  const homeAttempts = homeKicks.length;
  const awayAttempts = awayKicks.length;

  if (Math.max(homeAttempts, awayAttempts) <= 5) {
    const homePotential = homeGoals + Math.max(0, 5 - homeAttempts);
    const awayPotential = awayGoals + Math.max(0, 5 - awayAttempts);
    if (homeGoals > awayPotential) return "HOME";
    if (awayGoals > homePotential) return "AWAY";
    if (homeAttempts >= 5 && awayAttempts >= 5 && homeGoals !== awayGoals) {
      return homeGoals > awayGoals ? "HOME" : "AWAY";
    }
    return null;
  }

  // In sudden death both sides must take the same number of kicks before a
  // difference can decide the match.
  if (homeAttempts === awayAttempts && homeGoals !== awayGoals) {
    return homeGoals > awayGoals ? "HOME" : "AWAY";
  }
  return null;
}

/** Resolve a completed match using the football result first, then penalties when scores are level. */
export function resolveMatchResult(input: MatchResultInput): ResolvedMatchResult {
  const homePenaltyScore = input.shootoutKicks.filter((kick) => kick.side === "HOME" && kick.result === "SCORED").length;
  const awayPenaltyScore = input.shootoutKicks.filter((kick) => kick.side === "AWAY" && kick.result === "SCORED").length;

  if (input.status !== "FINISHED" || input.homeScore == null || input.awayScore == null) {
    return { homePenaltyScore, awayPenaltyScore, winnerSide: null, decidedByPenalties: false };
  }

  if (input.homeScore !== input.awayScore) {
    return {
      homePenaltyScore,
      awayPenaltyScore,
      winnerSide: input.homeScore > input.awayScore ? "HOME" : "AWAY",
      decidedByPenalties: false
    };
  }

  if (!input.hasPenaltyShootout) {
    return { homePenaltyScore, awayPenaltyScore, winnerSide: null, decidedByPenalties: false };
  }

  const penaltyWinner = resolveShootoutWinner(input.shootoutKicks);
  if (!penaltyWinner) return { homePenaltyScore, awayPenaltyScore, winnerSide: null, decidedByPenalties: false };

  return {
    homePenaltyScore,
    awayPenaltyScore,
    winnerSide: penaltyWinner,
    decidedByPenalties: true
  };
}
