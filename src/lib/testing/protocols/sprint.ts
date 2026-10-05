import type { TestCalculator, CalculationInput, CalculationOutput, RawMeasurement } from "../types";

/**
 * 30-Meter Linear Sprint Test Protocol
 * Metric: Seconds (s)
 * Direction: LOWER_IS_BETTER
 */
export const SprintCalculator: TestCalculator = {
  strategyKey: "SPRINT_30M",
  defaultUnit: "s",
  defaultDirection: "LOWER_IS_BETTER",

  validate(measurements: RawMeasurement[]) {
    const timeM = measurements.filter((m) => m.key.startsWith("time"));
    if (timeM.length === 0) {
      return { valid: false, error: "At least one time measurement is required for 30m Sprint." };
    }
    for (const m of timeM) {
      const val = Number(m.numericValue ?? m.value);
      if (isNaN(val) || val <= 2.5 || val > 15.0) {
        return { valid: false, error: `Invalid sprint time: ${val}s. Realistic range is 2.5s to 15s.` };
      }
    }
    return { valid: true };
  },

  calculate(input: CalculationInput): CalculationOutput {
    const times = input.measurements
      .filter((m) => m.key.startsWith("time"))
      .map((m) => Number(m.numericValue ?? m.value))
      .filter((v) => !isNaN(v) && v > 0);

    if (times.length === 0) {
      throw new Error("No valid sprint times provided.");
    }

    // Lower is better: take best (minimum) time
    const bestTime = Math.min(...times);
    const rounded = Math.round(bestTime * 100) / 100;
    const scoreDisplay = `${rounded.toFixed(2)} s`;

    const normalizedMeasurements: RawMeasurement[] = input.measurements.map((m, idx) => ({
      key: m.key,
      value: String(m.value),
      numericValue: Number(m.numericValue ?? m.value),
      unit: "s",
      attempt: m.attempt ?? idx + 1
    }));

    return {
      summaryScore: rounded,
      primaryUnit: "s",
      scoreDisplay,
      normalizedMeasurements,
      metadata: {
        allAttempts: times,
        bestTime: rounded,
      }
    };
  }
};
