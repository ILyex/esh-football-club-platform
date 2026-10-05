import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateYoYoDistance,
  deriveYoYoLevelAndShuttle,
  calculateYoYoVO2max,
  YoYoIR1Calculator,
  YOYO_IR1_LEVELS
} from "@/lib/testing/protocols/yoyo-ir1";
import {
  calculateYoYoIR2Distance,
  calculateYoYoIR2VO2max,
  deriveYoYoIR2LevelAndShuttle,
  YoYoIR2Calculator,
} from "@/lib/testing/protocols/yoyo-ir2";

test("Yo-Yo IR1: exact Bangsbo cumulative distance verification", () => {
  // Level 5, shuttle 1 -> 40m
  assert.equal(calculateYoYoDistance(5, 1), 40);

  // Speed level 9 (12 km/h), shuttle 1 -> 80m
  assert.equal(calculateYoYoDistance(9, 1), 80);

  // Level 11, shuttle 1 -> 120m, shuttle 2 -> 160m
  assert.equal(calculateYoYoDistance(11, 1), 120);
  assert.equal(calculateYoYoDistance(11, 2), 160);

  // Level 12, shuttle 3 -> 280m
  assert.equal(calculateYoYoDistance(12, 3), 280);

  // Level 13, shuttle 4 -> 440m
  assert.equal(calculateYoYoDistance(13, 4), 440);

  // Level 14, shuttle 8 -> 760m
  assert.equal(calculateYoYoDistance(14, 8), 760);

  // Level 15, shuttle 8 -> 1,080m
  assert.equal(calculateYoYoDistance(15, 8), 1080);

  // Level 16, shuttle 3 -> 1,200m (1080 + 3*40)
  assert.equal(calculateYoYoDistance(16, 3), 1200);

  // Level 16, shuttle 8 -> 1,400m
  assert.equal(calculateYoYoDistance(16, 8), 1400);

  // Level 17, shuttle 8 -> 1,720m
  assert.equal(calculateYoYoDistance(17, 8), 1720);

  // Level 18, shuttle 8 -> 2,040m
  assert.equal(calculateYoYoDistance(18, 8), 2040);

  // Level 23, shuttle 8 -> 3,640m (maximum protocol limit)
  assert.equal(calculateYoYoDistance(23, 8), 3640);
});

test("Yo-Yo IR1 uses the official speed levels and rejects impossible partial-shuttle distances", () => {
  assert.equal(YOYO_IR1_LEVELS[1]?.level, 9);
  assert.equal(YOYO_IR1_LEVELS[1]?.speedKmh, 12);
  assert.deepEqual(deriveYoYoLevelAndShuttle(80), { level: 9, shuttle: 1 });
  assert.throws(() => deriveYoYoLevelAndShuttle(81), /completed 40m shuttle/);
  assert.equal(YoYoIR1Calculator.validate([{ key: "distance", value: "81", numericValue: 81 }]).valid, false);
  assert.equal(YoYoIR1Calculator.validate([
    { key: "level", value: "16.4", numericValue: 16.4 },
    { key: "shuttle", value: "3", numericValue: 3 },
  ]).valid, false);
  assert.equal(YoYoIR1Calculator.validate([
    { key: "level", value: "16", numericValue: 16 },
    { key: "shuttle", value: "3", numericValue: 3 },
    { key: "distance", value: "1160", numericValue: 1160 },
  ]).valid, false);
});

test("Yo-Yo IR2 uses its own Bangsbo distance blocks and estimation equation", () => {
  assert.equal(calculateYoYoIR2Distance(11, 1), 40);
  assert.equal(calculateYoYoIR2Distance(15, 1), 80);
  assert.equal(calculateYoYoIR2Distance(17, 2), 160);
  assert.equal(calculateYoYoIR2Distance(22, 3), 1200);
  assert.equal(calculateYoYoIR2VO2max(1200), 61.6);
  assert.deepEqual(deriveYoYoIR2LevelAndShuttle(1200), { level: 22, shuttle: 3 });

  const measurements = [
    { key: "level", value: "22", numericValue: 22 },
    { key: "shuttle", value: "3", numericValue: 3 },
  ];
  assert.equal(YoYoIR2Calculator.validate(measurements).valid, true);
  const result = YoYoIR2Calculator.calculate({ measurements });
  assert.equal(result.summaryScore, 1200);
  assert.equal(result.secondaryScore, 61.6);
  assert.equal(result.scoreDisplay, "22.3 (1,200 m)");
  assert.equal(YoYoIR2Calculator.validate([{ key: "level", value: "16", numericValue: 16 }]).valid, false);
  assert.equal(YoYoIR2Calculator.validate([{ key: "distance", value: "121", numericValue: 121 }]).valid, false);
  assert.equal(YoYoIR2Calculator.validate([
    { key: "level", value: "22", numericValue: 22 },
    { key: "shuttle", value: "3", numericValue: 3 },
    { key: "distance", value: "1160", numericValue: 1160 },
  ]).valid, false);
});

test("Yo-Yo IR1: VO2max Bangsbo formula verification", () => {
  // Bangsbo equation: distance * 0.0084 + 36.4
  // 1400m -> 1400 * 0.0084 + 36.4 = 11.76 + 36.4 = 48.16 -> 48.2 ml/kg/min
  assert.equal(calculateYoYoVO2max(1400), 48.2);

  // 2040m -> 2040 * 0.0084 + 36.4 = 17.136 + 36.4 = 53.536 -> 53.5 ml/kg/min
  assert.equal(calculateYoYoVO2max(2040), 53.5);

  // 2400m -> 2400 * 0.0084 + 36.4 = 20.16 + 36.4 = 56.56 -> 56.6 ml/kg/min
  assert.equal(calculateYoYoVO2max(2400), 56.6);
});

test("Yo-Yo IR1: boundary checks and invalid input rejection", () => {
  // Level 6 is not in IR1 (jumps from 5 to 8, then 11)
  assert.throws(() => calculateYoYoDistance(6, 1), /Invalid Yo-Yo IR1 level/);

  // Shuttle 0 is invalid
  assert.throws(() => calculateYoYoDistance(15, 0), /Invalid shuttle/);

  // Shuttle 9 on Level 15 (max is 8)
  assert.throws(() => calculateYoYoDistance(15, 9), /Maximum shuttles is 8/);

  // Shuttle 2 on Level 5 (max is 1)
  assert.throws(() => calculateYoYoDistance(5, 2), /Maximum shuttles is 1/);
});

test("Yo-Yo IR1: inverse derivation of level and shuttle from meters", () => {
  const d1 = deriveYoYoLevelAndShuttle(40);
  assert.deepEqual(d1, { level: 5, shuttle: 1 });

  const d2 = deriveYoYoLevelAndShuttle(1200);
  assert.deepEqual(d2, { level: 16, shuttle: 3 });

  const d3 = deriveYoYoLevelAndShuttle(1400);
  assert.deepEqual(d3, { level: 16, shuttle: 8 });
});

test("Yo-Yo IR1 Calculator: end-to-end execution", () => {
  const input = {
    measurements: [
      { key: "level", value: "16", numericValue: 16 },
      { key: "shuttle", value: "3", numericValue: 3 }
    ]
  };

  const validation = YoYoIR1Calculator.validate(input.measurements);
  assert.equal(validation.valid, true);

  const output = YoYoIR1Calculator.calculate(input);
  assert.equal(output.summaryScore, 1200);
  assert.equal(output.secondaryScore, 46.5); // 1200 * 0.0084 + 36.4 = 46.48 -> 46.5
  assert.equal(output.primaryUnit, "m");
  assert.equal(output.scoreDisplay, "16.3 (1,200 m)");
});
