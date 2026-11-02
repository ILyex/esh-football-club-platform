/**
 * Authoritative Yo-Yo Intermittent Recovery Test Level 1 (Yo-Yo IR1) Conductor Schedule Engine.
 *
 * Deterministic, drift-free protocol timing derived from Bangsbo (2008).
 * 2 x 20m shuttles with 10s active recovery (2 x 5m walk/jog).
 * Speed formula: Shuttle time (s) = 40m / (Speed km/h / 3.6) = 144 / Speed.
 */

import { YOYO_IR1_LEVELS, calculateYoYoDistance } from "./yoyo-ir1";

export interface ScheduledShuttle {
  shuttleIndex: number; // 1 to 92
  level: number;
  shuttleInLevel: number;
  totalShuttlesInLevel: number;
  speedKmh: number;
  shuttleDurationSec: number;
  halfwaySec: number;
  recoveryDurationSec: number;
  cumulativeDistanceMeters: number;
  isLevelStart: boolean;
  timelineStartSec: number; // Seconds from start of shuttle 1
  timelineShuttleEndSec: number;
  timelineRecoveryEndSec: number;
}

export type ConductorPhase = "NOT_STARTED" | "COUNTDOWN" | "SHUTTLE_RUNNING" | "RECOVERY" | "COMPLETED";

export interface ConductorState {
  phase: ConductorPhase;
  currentShuttle: ScheduledShuttle | null;
  totalShuttles: number;
  activeLevel: number;
  activeShuttleInLevel: number;
  speedKmh: number;
  cumulativeDistanceMeters: number;
  elapsedSec: number;
  phaseElapsedSec: number;
  phaseDurationSec: number;
  phaseRemainingSec: number;
  nextBeepLabel: "COUNTDOWN" | "START" | "HALFWAY" | "SHUTTLE_END" | "RECOVERY_WARNING" | "NEXT_SHUTTLE" | "TEST_FINISH";
  secondsToNextBeep: number;
  progressPercent: number; // 0 to 100
  isCompleted: boolean;
}

export const COUNTDOWN_DURATION_SEC = 5.0; // 5-second preparation countdown
export const RECOVERY_DURATION_SEC = 10.0; // 10-second active recovery

/**
 * Pre-computes the deterministic timeline of all 92 shuttles (3,680 m).
 */
function buildFullSchedule(): ScheduledShuttle[] {
  const schedule: ScheduledShuttle[] = [];
  let shuttleIndex = 1;
  let runningTimelineSec = 0;

  for (const lvl of YOYO_IR1_LEVELS) {
    const speed = lvl.speedKmh;
    // Keep full floating-point timing internally so rounding each shuttle does
    // not accumulate drift across the full 92-shuttle IR1 protocol.
    const shuttleDurationSec = 144 / speed;
    const halfwaySec = shuttleDurationSec / 2;

    for (let s = 1; s <= lvl.shuttlesInLevel; s++) {
      const isLevelStart = s === 1;
      const distance = calculateYoYoDistance(lvl.level, s);
      const timelineStartSec = runningTimelineSec;
      const timelineShuttleEndSec = timelineStartSec + shuttleDurationSec;
      const timelineRecoveryEndSec = timelineShuttleEndSec + RECOVERY_DURATION_SEC;

      schedule.push({
        shuttleIndex,
        level: lvl.level,
        shuttleInLevel: s,
        totalShuttlesInLevel: lvl.shuttlesInLevel,
        speedKmh: speed,
        shuttleDurationSec,
        halfwaySec,
        recoveryDurationSec: RECOVERY_DURATION_SEC,
        cumulativeDistanceMeters: distance,
        isLevelStart,
        timelineStartSec,
        timelineShuttleEndSec,
        timelineRecoveryEndSec,
      });

      runningTimelineSec = timelineRecoveryEndSec;
      shuttleIndex++;
    }
  }

  return schedule;
}

export const YOYO_IR1_FULL_SCHEDULE: readonly ScheduledShuttle[] = buildFullSchedule();

/**
 * Deterministically computes current conductor state given monotonic elapsed seconds since test start.
 */
export function deriveConductorState(elapsedSec: number): ConductorState {
  const totalShuttles = YOYO_IR1_FULL_SCHEDULE.length;

  if (elapsedSec < 0) {
    const first = YOYO_IR1_FULL_SCHEDULE[0]!;
    return {
      phase: "NOT_STARTED",
      currentShuttle: first,
      totalShuttles,
      activeLevel: first.level,
      activeShuttleInLevel: first.shuttleInLevel,
      speedKmh: first.speedKmh,
      cumulativeDistanceMeters: 0,
      elapsedSec: 0,
      phaseElapsedSec: 0,
      phaseDurationSec: COUNTDOWN_DURATION_SEC,
      phaseRemainingSec: COUNTDOWN_DURATION_SEC,
      nextBeepLabel: "START",
      secondsToNextBeep: COUNTDOWN_DURATION_SEC,
      progressPercent: 0,
      isCompleted: false,
    };
  }

  // Initial Preparation Countdown Phase
  if (elapsedSec < COUNTDOWN_DURATION_SEC) {
    const first = YOYO_IR1_FULL_SCHEDULE[0]!;
    const remaining = COUNTDOWN_DURATION_SEC - elapsedSec;
    return {
      phase: "COUNTDOWN",
      currentShuttle: first,
      totalShuttles,
      activeLevel: first.level,
      activeShuttleInLevel: first.shuttleInLevel,
      speedKmh: first.speedKmh,
      cumulativeDistanceMeters: 0,
      elapsedSec,
      phaseElapsedSec: elapsedSec,
      phaseDurationSec: COUNTDOWN_DURATION_SEC,
      phaseRemainingSec: Math.max(0, remaining),
      nextBeepLabel: "START",
      secondsToNextBeep: Math.max(0, remaining),
      progressPercent: (elapsedSec / COUNTDOWN_DURATION_SEC) * 100,
      isCompleted: false,
    };
  }

  // Active protocol timeline (after initial 5s countdown)
  const protocolSec = elapsedSec - COUNTDOWN_DURATION_SEC;
  const lastShuttle = YOYO_IR1_FULL_SCHEDULE[totalShuttles - 1]!;

  if (protocolSec >= lastShuttle.timelineShuttleEndSec) {
    // Protocol naturally reached final shuttle
    return {
      phase: "COMPLETED",
      currentShuttle: lastShuttle,
      totalShuttles,
      activeLevel: lastShuttle.level,
      activeShuttleInLevel: lastShuttle.shuttleInLevel,
      speedKmh: lastShuttle.speedKmh,
      cumulativeDistanceMeters: lastShuttle.cumulativeDistanceMeters,
      elapsedSec,
      phaseElapsedSec: 0,
      phaseDurationSec: 0,
      phaseRemainingSec: 0,
      nextBeepLabel: "TEST_FINISH",
      secondsToNextBeep: 0,
      progressPercent: 100,
      isCompleted: true,
    };
  }

  // Locate current shuttle in timeline
  const activeShuttle =
    YOYO_IR1_FULL_SCHEDULE.find(
      (s) => protocolSec >= s.timelineStartSec && protocolSec < s.timelineRecoveryEndSec
    ) || lastShuttle;

  const shuttleElapsed = protocolSec - activeShuttle.timelineStartSec;

  if (shuttleElapsed < activeShuttle.shuttleDurationSec - 1e-6) {
    // 🏃 RUNNING PHASE (40m Shuttle)
    const phaseRemaining = activeShuttle.shuttleDurationSec - shuttleElapsed;
    const isBeforeHalfway = shuttleElapsed < activeShuttle.halfwaySec;
    const secondsToNextBeep = isBeforeHalfway
      ? activeShuttle.halfwaySec - shuttleElapsed
      : phaseRemaining;
    const nextBeepLabel = isBeforeHalfway ? "HALFWAY" : "SHUTTLE_END";

    return {
      phase: "SHUTTLE_RUNNING",
      currentShuttle: activeShuttle,
      totalShuttles,
      activeLevel: activeShuttle.level,
      activeShuttleInLevel: activeShuttle.shuttleInLevel,
      speedKmh: activeShuttle.speedKmh,
      cumulativeDistanceMeters: activeShuttle.shuttleIndex > 1
        ? activeShuttle.cumulativeDistanceMeters - 40
        : 0,
      elapsedSec,
      phaseElapsedSec: shuttleElapsed,
      phaseDurationSec: activeShuttle.shuttleDurationSec,
      phaseRemainingSec: Math.max(0, phaseRemaining),
      nextBeepLabel,
      secondsToNextBeep: Math.max(0, secondsToNextBeep),
      progressPercent: Math.min(100, (shuttleElapsed / activeShuttle.shuttleDurationSec) * 100),
      isCompleted: false,
    };
  } else {
    // 🚶 ACTIVE RECOVERY PHASE (10 seconds)
    const recoveryElapsed = shuttleElapsed - activeShuttle.shuttleDurationSec;
    const phaseRemaining = activeShuttle.recoveryDurationSec - recoveryElapsed;
    const nextShuttle = YOYO_IR1_FULL_SCHEDULE[activeShuttle.shuttleIndex] || null;

    let secondsToNextBeep = phaseRemaining;
    let nextBeepLabel: ConductorState["nextBeepLabel"] = "NEXT_SHUTTLE";

    if (recoveryElapsed < 5.0) {
      secondsToNextBeep = 5.0 - recoveryElapsed;
      nextBeepLabel = "RECOVERY_WARNING";
    } else if (recoveryElapsed < 7.0) {
      secondsToNextBeep = 7.0 - recoveryElapsed;
      nextBeepLabel = "RECOVERY_WARNING";
    } else {
      secondsToNextBeep = phaseRemaining;
      nextBeepLabel = nextShuttle?.isLevelStart ? "START" : "NEXT_SHUTTLE";
    }

    return {
      phase: "RECOVERY",
      currentShuttle: activeShuttle,
      totalShuttles,
      activeLevel: activeShuttle.level,
      activeShuttleInLevel: activeShuttle.shuttleInLevel,
      speedKmh: activeShuttle.speedKmh,
      cumulativeDistanceMeters: activeShuttle.cumulativeDistanceMeters,
      elapsedSec,
      phaseElapsedSec: recoveryElapsed,
      phaseDurationSec: activeShuttle.recoveryDurationSec,
      phaseRemainingSec: Math.max(0, phaseRemaining),
      nextBeepLabel,
      secondsToNextBeep: Math.max(0, secondsToNextBeep),
      progressPercent: Math.min(100, (recoveryElapsed / activeShuttle.recoveryDurationSec) * 100),
      isCompleted: false,
    };
  }
}

/**
 * Formats level and shuttle into first-class human string "Level.Shuttle" (e.g. 15.4)
 */
export function formatLevelShuttle(level: number, shuttle: number): string {
  return `${level}.${shuttle}`;
}

/**
 * Parses "15.4" into { level: 15, shuttle: 4 }
 */
export function parseLevelShuttle(val: string): { level: number; shuttle: number } | null {
  const parts = val.trim().split(".");
  if (parts.length !== 2) return null;
  const level = parseInt(parts[0]!, 10);
  const shuttle = parseInt(parts[1]!, 10);
  if (isNaN(level) || isNaN(shuttle) || level <= 0 || shuttle <= 0) return null;
  return { level, shuttle };
}
