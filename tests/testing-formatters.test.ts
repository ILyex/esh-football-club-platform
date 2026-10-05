import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatMeasurement, formatTestScore } from "@/lib/testing/formatters";

describe("testing formatters", () => {
  it("formats sprint and time measurements with 2 decimals and seconds unit", () => {
    assert.equal(formatMeasurement(4.153, "s"), "4.15 s");
    assert.equal(formatMeasurement("4.2", "s"), "4.20 s");
    assert.equal(formatMeasurement(3, "s"), "3.00 s");
  });

  it("formats aerobic running distances with thousands grouping and m unit", () => {
    assert.equal(formatMeasurement(1440, "m"), "1,440 m");
    assert.equal(formatMeasurement("2040", "m"), "2,040 m");
    assert.equal(formatMeasurement(80, "m"), "80 m");
  });

  it("formats vertical jump height in cm with clean precision", () => {
    assert.equal(formatMeasurement(48.5, "cm"), "48.5 cm");
    assert.equal(formatMeasurement(50, "cm"), "50 cm");
  });

  it("formats VO2max with ml/kg/min", () => {
    assert.equal(formatMeasurement(49.62, "ml/kg/min"), "49.6 ml/kg/min");
  });

  it("handles null and undefined values safely", () => {
    assert.equal(formatMeasurement(null, "s"), "—");
    assert.equal(formatMeasurement(undefined, "cm"), "—");
    assert.equal(formatMeasurement("", "m"), "—");
  });

  it("formats composite test scores", () => {
    assert.equal(formatTestScore(1440, "m", 49.6, "ml/kg/min"), "1,440 m (49.6 ml/kg/min)");
    assert.equal(formatTestScore(4.15, "s"), "4.15 s");
    assert.equal(formatTestScore(null, "s"), "—");
  });
});
