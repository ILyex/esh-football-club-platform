import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CooperTestCalculator,
  FifaRSACalculator,
  IFT3015Calculator,
  IllinoisAgilityCalculator
} from "@/lib/testing/protocols/fifa-uefa-protocols";

test("FIFA RSA does not report a fatigue index until all six sprints are recorded", () => {
  const partial = [{ key: "sprint_1", value: "5.2", numericValue: 5.2, unit: "s" }];
  const partialResult = FifaRSACalculator.calculate({ measurements: partial });
  assert.equal(partialResult.secondaryScore, null);
  assert.equal(partialResult.normalizedMeasurements.some((m) => m.key === "fatigue_index"), false);
  assert.equal(FifaRSACalculator.validate([{ key: "sprint_1", value: "500", numericValue: 500 }]).valid, false);

  const complete = Array.from({ length: 6 }, (_, i) => ({ key: `sprint_${i + 1}`, value: "5.2", numericValue: 5.2, unit: "s" }));
  assert.equal(FifaRSACalculator.calculate({ measurements: complete }).secondaryScore, 0);
});

test("30-15 IFT records measured VIFT only and rejects fabricated defaults", () => {
  const absent: never[] = [];
  assert.equal(IFT3015Calculator.validate(absent).valid, false);
  assert.throws(() => IFT3015Calculator.calculate({ measurements: absent }));
  const measurements = [{ key: "vift", value: "18.5", numericValue: 18.5, unit: "km/h" }];
  assert.equal(IFT3015Calculator.validate(measurements).valid, true);
  const result = IFT3015Calculator.calculate({ measurements });
  assert.equal(result.summaryScore, 18.5);
  assert.equal(result.secondaryScore, null);
  assert.deepEqual(result.normalizedMeasurements.map((m) => m.key), ["vift"]);
});

test("Illinois agility requires a measured time and does not invent performance tiers", () => {
  assert.equal(IllinoisAgilityCalculator.validate([]).valid, false);
  assert.throws(() => IllinoisAgilityCalculator.calculate({ measurements: [] }));
  const measurements = [
    { key: "time_1", value: "16.42", numericValue: 16.42, unit: "s" },
    { key: "time_2", value: "16.10", numericValue: 16.10, unit: "s" }
  ];
  const result = IllinoisAgilityCalculator.calculate({ measurements });
  assert.equal(result.summaryScore, 16.1);
  assert.equal(result.scoreDisplay, "16.10s");
  assert.equal("tier" in (result.metadata ?? {}), false);
});

test("Cooper test requires a recorded distance and labels VO2 as estimated", () => {
  assert.equal(CooperTestCalculator.validate([]).valid, false);
  assert.throws(() => CooperTestCalculator.calculate({ measurements: [] }));
  const measurements = [{ key: "distance", value: "2400", numericValue: 2400, unit: "m" }];
  const result = CooperTestCalculator.calculate({ measurements });
  assert.equal(result.summaryScore, 2400);
  assert.equal(result.secondaryScore, 42.4);
  assert.match(result.scoreDisplay, /estimated VO₂/);
});
