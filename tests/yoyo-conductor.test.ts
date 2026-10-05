import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  YOYO_IR1_FULL_SCHEDULE,
  deriveConductorState,
  formatLevelShuttle,
  parseLevelShuttle
} from "@/lib/testing/protocols/yoyo-conductor-engine";

describe("Yo-Yo IR1 Conductor Schedule & Timing Engine", () => {
  it("builds the authoritative 91-shuttle schedule matching Bangsbo IR1 protocol", () => {
    assert.equal(YOYO_IR1_FULL_SCHEDULE.length, 91);

    // Shuttle 1: Level 5, Shuttle 1, Speed 10.0 km/h, 14.40s duration, 40m
    const s1 = YOYO_IR1_FULL_SCHEDULE[0]!;
    assert.equal(s1.level, 5);
    assert.equal(s1.shuttleInLevel, 1);
    assert.equal(s1.speedKmh, 10.0);
    assert.equal(s1.shuttleDurationSec, 14.4);
    assert.equal(s1.cumulativeDistanceMeters, 40);

    // Shuttle 2: Level 8, Shuttle 1, Speed 11.5 km/h, 12.52s duration, 80m
    const s2 = YOYO_IR1_FULL_SCHEDULE[1]!;
    assert.equal(s2.level, 8);
    assert.equal(s2.shuttleInLevel, 1);
    assert.equal(s2.speedKmh, 11.5);
    assert.equal(s2.cumulativeDistanceMeters, 80);

    // Shuttle 91: Level 23, Shuttle 8, Speed 19.0 km/h, 3640m
    const s91 = YOYO_IR1_FULL_SCHEDULE[90]!;
    assert.equal(s91.level, 23);
    assert.equal(s91.shuttleInLevel, 8);
    assert.equal(s91.speedKmh, 19.0);
    assert.equal(s91.cumulativeDistanceMeters, 3640);
  });

  it("determines countdown phase for elapsed time < 5s", () => {
    const state = deriveConductorState(2.5);
    assert.equal(state.phase, "COUNTDOWN");
    assert.equal(state.activeLevel, 5);
    assert.equal(state.activeShuttleInLevel, 1);
    assert.equal(state.phaseRemainingSec, 2.5);
  });

  it("transitions to running phase at 5.0s for Shuttle 1", () => {
    const state = deriveConductorState(5.0);
    assert.equal(state.phase, "SHUTTLE_RUNNING");
    assert.equal(state.activeLevel, 5);
    assert.equal(state.activeShuttleInLevel, 1);
    assert.equal(state.phaseDurationSec, 14.4);
    assert.equal(state.nextBeepLabel, "HALFWAY");
  });

  it("transitions to recovery phase after 40m shuttle completes", () => {
    // 5s countdown + 14.4s running = 19.4s
    const state = deriveConductorState(20.0);
    assert.equal(state.phase, "RECOVERY");
    assert.equal(state.activeLevel, 5);
    assert.equal(state.phaseDurationSec, 10.0);
  });

  it("transitions to next level (Level 8) after 10s recovery", () => {
    // 5s countdown + 14.4s running + 10s recovery = 29.4s
    const state = deriveConductorState(30.0);
    assert.equal(state.phase, "SHUTTLE_RUNNING");
    assert.equal(state.activeLevel, 8);
    assert.equal(state.activeShuttleInLevel, 1);
    assert.equal(state.speedKmh, 11.5);
  });

  it("formats and parses Level.Shuttle correctly", () => {
    assert.equal(formatLevelShuttle(15, 4), "15.4");
    assert.equal(formatLevelShuttle(17, 8), "17.8");

    const parsed = parseLevelShuttle("15.4");
    assert.deepEqual(parsed, { level: 15, shuttle: 4 });

    assert.equal(parseLevelShuttle("invalid"), null);
    assert.equal(parseLevelShuttle("15"), null);
  });
});
