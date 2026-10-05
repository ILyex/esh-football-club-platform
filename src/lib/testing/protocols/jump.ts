import type { TestCalculator, CalculationInput, CalculationOutput, RawMeasurement } from "../types";

/**
 * Countermovement Vertical Jump (CMJ) Protocol
 * Metric: Centimeters (cm)
 * Direction: HIGHER_IS_BETTER
 */
export const JumpCalculator: TestCalculator = {
  strategyKey: "VERTICAL_JUMP",
  defaultUnit: "cm",
  defaultDirection: "HIGHER_IS_BETTER",

  validate(measurements: RawMeasurement[]) {
    const jumpM = measurements.filter((m) => m.key.startsWith("height") || m.key.startsWith("jump"));
    if (jumpM.length === 0) {
      return { valid: false, error: "At least one jump height measurement is required." };
    }
    for (const m of jumpM) {
      const val = Number(m.numericValue ?? m.value);
      if (isNaN(val) || val <= 5 || val > 120) {
        return { valid: false, error: `Invalid jump height: ${val}cm. Realistic range is 5cm to 120cm.` };
      }
    }
    return { valid: true };
  },

  calculate(input: CalculationInput): CalculationOutput {
    const jumps = input.measurements
      .filter((m) => m.key.startsWith("height") || m.key.startsWith("jump"))
      .map((m) => Number(m.numericValue ?? m.value))
      .filter((v) => !isNaN(v) && v > 0);

    if (jumps.length === 0) {
      throw new Error("No valid jump heights provided.");
    }

    // Higher is better: take best (maximum) height
    const bestHeight = Math.max(...jumps);
    const rounded = Math.round(bestHeight * 10) / 10;
    const scoreDisplay = `${rounded} cm`;

    const normalizedMeasurements: RawMeasurement[] = input.measurements.map((m, idx) => ({
      key: m.key,
      value: String(m.value),
      numericValue: Number(m.numericValue ?? m.value),
      unit: "cm",
      attempt: m.attempt ?? idx + 1
    }));

    return {
      summaryScore: rounded,
      primaryUnit: "cm",
      scoreDisplay,
      normalizedMeasurements,
      metadata: {
        allAttempts: jumps,
        bestHeight: rounded,
      }
    };
  }
};
