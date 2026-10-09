import { resolveShootoutWinner } from "@/lib/matches/result";

export type MatchClockPhase =
  | "FIRST_HALF"
  | "HALF_TIME"
  | "SECOND_HALF"
  | "FULL_TIME"
  | "EXTRA_TIME_BREAK"
  | "EXTRA_TIME_FIRST_HALF"
  | "EXTRA_TIME_HALF_TIME"
  | "EXTRA_TIME_SECOND_HALF"
  | "PENALTIES";

export interface MatchClockState {
  minute: number;
  addedMinute?: number;
  phase: MatchClockPhase;
  playingMinutes: number;
  finished: boolean;
}

export interface MatchAddedTimeSettings {
  firstHalf: number;
  secondHalf: number;
  extraTimeFirstHalf: number;
  extraTimeSecondHalf: number;
}

const NO_ADDED_TIME: MatchAddedTimeSettings = {
  firstHalf: 0,
  secondHalf: 0,
  extraTimeFirstHalf: 0,
  extraTimeSecondHalf: 0
};

export function getMatchClockState(
  matchDate: Date | string,
  now: Date,
  hasExtraTime: boolean,
  hasPenaltyShootout: boolean,
  homeScore: number | null = 0,
  awayScore: number | null = 0,
  addedTime: MatchAddedTimeSettings = NO_ADDED_TIME
): MatchClockState {
  const elapsed = Math.max(0, (now.getTime() - new Date(matchDate).getTime()) / 60_000);
  const firstHalfAddedTime = Math.max(0, addedTime.firstHalf || 0);
  const secondHalfAddedTime = Math.max(0, addedTime.secondHalf || 0);
  const extraTimeFirstHalfAddedTime = Math.max(0, addedTime.extraTimeFirstHalf || 0);
  const extraTimeSecondHalfAddedTime = Math.max(0, addedTime.extraTimeSecondHalf || 0);
  const halfTimeEnd = 60 + firstHalfAddedTime;
  const secondHalfEnd = 105 + firstHalfAddedTime;
  const regulationEnd = secondHalfEnd + secondHalfAddedTime;
  const extraTimeFirstStart = regulationEnd + 15;
  const extraTimeFirstEnd = extraTimeFirstStart + 15;
  const extraTimeHalfTimeEnd = extraTimeFirstEnd + extraTimeFirstHalfAddedTime + 15;
  const extraTimeSecondStart = extraTimeHalfTimeEnd;
  const extraTimeSecondEnd = extraTimeSecondStart + 15;
  const extraTimeEnd = extraTimeSecondEnd + extraTimeSecondHalfAddedTime;

  if (elapsed < 45) {
    const minute = Math.floor(elapsed);
    return { minute, phase: "FIRST_HALF", playingMinutes: minute, finished: false };
  }
  if (elapsed < 45 + firstHalfAddedTime) {
    const addedMinute = Math.floor(elapsed - 45) + 1;
    return { minute: 45, addedMinute, phase: "FIRST_HALF", playingMinutes: 45 + addedMinute, finished: false };
  }
  if (elapsed < halfTimeEnd) return { minute: 45, phase: "HALF_TIME", playingMinutes: 45, finished: false };
  if (elapsed < secondHalfEnd) {
    const minute = Math.min(90, 45 + Math.floor(elapsed - halfTimeEnd));
    return { minute, phase: "SECOND_HALF", playingMinutes: minute, finished: false };
  }
  if (elapsed < regulationEnd) {
    const addedMinute = Math.floor(elapsed - secondHalfEnd) + 1;
    return { minute: 90, addedMinute, phase: "SECOND_HALF", playingMinutes: 90 + addedMinute, finished: false };
  }
  // A regular match is over at full time, regardless of a stale/inconsistent
  // shootout flag. Penalties are only reachable after extra time is enabled.
  if (!hasExtraTime) {
    return { minute: 90, phase: "FULL_TIME", playingMinutes: 90, finished: true };
  }
  if (elapsed < extraTimeFirstStart) return { minute: 90, phase: "EXTRA_TIME_BREAK", playingMinutes: 90, finished: false };
  if (elapsed < extraTimeFirstEnd) {
    const minute = 91 + Math.floor(elapsed - extraTimeFirstStart);
    return { minute, phase: "EXTRA_TIME_FIRST_HALF", playingMinutes: minute, finished: false };
  }
  if (elapsed < extraTimeFirstEnd + extraTimeFirstHalfAddedTime) {
    const addedMinute = Math.floor(elapsed - extraTimeFirstEnd) + 1;
    return { minute: 105, addedMinute, phase: "EXTRA_TIME_FIRST_HALF", playingMinutes: 105 + addedMinute, finished: false };
  }
  if (elapsed < extraTimeHalfTimeEnd) return { minute: 105, phase: "EXTRA_TIME_HALF_TIME", playingMinutes: 105 + extraTimeFirstHalfAddedTime, finished: false };
  if (elapsed < extraTimeSecondEnd) {
    const minute = 106 + Math.floor(elapsed - extraTimeSecondStart);
    return { minute, phase: "EXTRA_TIME_SECOND_HALF", playingMinutes: minute, finished: false };
  }
  if (elapsed < extraTimeEnd) {
    const addedMinute = Math.floor(elapsed - extraTimeSecondEnd) + 1;
    return { minute: 120, addedMinute, phase: "EXTRA_TIME_SECOND_HALF", playingMinutes: 120 + addedMinute, finished: false };
  }
  if (hasPenaltyShootout && (homeScore ?? 0) === (awayScore ?? 0)) return { minute: 120, phase: "PENALTIES", playingMinutes: 120 + extraTimeSecondHalfAddedTime, finished: false };
  return { minute: 120, phase: "FULL_TIME", playingMinutes: 120 + extraTimeSecondHalfAddedTime, finished: true };
}

export function isShootoutDecided(kicks: Array<{ side: "HOME" | "AWAY"; attemptNumber: number; result: "SCORED" | "MISSED" }>): boolean {
  return resolveShootoutWinner(kicks) !== null;
}
