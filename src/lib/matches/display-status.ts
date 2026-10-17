import { getMatchClockState, type MatchAddedTimeSettings } from "@/lib/matches/clock";

export type MatchDisplayStatus = "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED" | "CANCELLED";

export interface MatchDisplayStatusInput {
  status: MatchDisplayStatus;
  matchDate: Date | string;
  hasExtraTime: boolean;
  hasPenaltyShootout: boolean;
  homeScore?: number | null;
  awayScore?: number | null;
  addedTime?: MatchAddedTimeSettings;
}

/**
 * Keep clock-derived status consistent in the public, dashboard, and field views.
 * The persisted status remains authoritative except when a live clock reaches full time.
 */
export function getMatchDisplayStatus(input: MatchDisplayStatusInput, now = new Date()): MatchDisplayStatus {
  if (input.status !== "LIVE") return input.status;

  const clock = getMatchClockState(
    input.matchDate,
    now,
    input.hasExtraTime,
    input.hasPenaltyShootout,
    input.homeScore,
    input.awayScore,
    input.addedTime
  );

  return clock.finished ? "FINISHED" : "LIVE";
}
