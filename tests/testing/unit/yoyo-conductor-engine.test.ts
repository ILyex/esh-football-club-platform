import { test } from "node:test";
import assert from "node:assert/strict";
import {
  YOYO_IR1_FULL_SCHEDULE,
  deriveConductorState,
  COUNTDOWN_DURATION_SEC,
} from "@/lib/testing/protocols/yoyo-conductor-engine";

test("Yo-Yo IR1 conductor schedule follows every programmed shuttle without cumulative rounding", () => {
  assert.equal(YOYO_IR1_FULL_SCHEDULE.length, 92);
  for (let index = 0; index < YOYO_IR1_FULL_SCHEDULE.length; index++) {
    const shuttle = YOYO_IR1_FULL_SCHEDULE[index]!;
    assert.equal(shuttle.cumulativeDistanceMeters, (index + 1) * 40);
    assert.ok(Math.abs(shuttle.shuttleDurationSec - 144 / shuttle.speedKmh) < 1e-10);
    if (index > 0) {
      const previous = YOYO_IR1_FULL_SCHEDULE[index - 1]!;
      assert.equal(shuttle.timelineStartSec, previous.timelineRecoveryEndSec);
    }
  }
});

test("Yo-Yo IR1 conductor distance advances only when a shuttle is completed", () => {
  const first = YOYO_IR1_FULL_SCHEDULE[0]!;
  const duringFirstShuttle = deriveConductorState(COUNTDOWN_DURATION_SEC + first.shuttleDurationSec / 2);
  assert.equal(duringFirstShuttle.cumulativeDistanceMeters, 0);

  const firstRecovery = deriveConductorState(COUNTDOWN_DURATION_SEC + first.timelineShuttleEndSec);
  assert.equal(firstRecovery.phase, "RECOVERY");
  assert.equal(firstRecovery.cumulativeDistanceMeters, 40);

  const secondShuttle = YOYO_IR1_FULL_SCHEDULE[1]!;
  const duringSecondShuttle = deriveConductorState(COUNTDOWN_DURATION_SEC + secondShuttle.timelineStartSec);
  assert.equal(duringSecondShuttle.currentShuttle?.level, 5);
  assert.equal(duringSecondShuttle.cumulativeDistanceMeters, 40);
});
