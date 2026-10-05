import type { TestCalculator, CalculationInput, CalculationOutput, RawMeasurement } from "../types";

/**
 * ----------------------------------------------------------------------------
 * 1. FIFA Repeated Sprint Ability Protocol (FIFA RSA 6 x 40m)
 * Reference: FIFA Referee & Elite Player Fitness Testing Directive
 * 6 x 40m maximal sprints with 60s passive/walking recovery between repetitions.
 * Calculates: Best Sprint, Mean Sprint Time, and Fatigue Index (Sdec %).
 * Sdec % = [ (Total Time / (Best Time * 6)) - 1 ] * 100
 * ----------------------------------------------------------------------------
 */
export const FifaRSACalculator: TestCalculator = {
  strategyKey: "FIFA_RSA",
  defaultUnit: "s",
  defaultDirection: "LOWER_IS_BETTER",

  validate(measurements: RawMeasurement[]) {
    const entries = measurements.filter((m) => /^sprint_[1-6]$/.test(m.key));
    const times = entries.filter((m) => m.numericValue != null && m.numericValue > 0 && m.numericValue <= 30);
    if (times.length !== entries.length) {
      return { valid: false, error: "FIFA RSA sprint times must be between 0 and 30 seconds." };
    }
    if (times.length < 1) {
      return { valid: false, error: "At least one valid sprint time (sprint_1) is required for FIFA RSA." };
    }
    return { valid: true };
  },

  calculate(input: CalculationInput): CalculationOutput {
    const sprintValues: number[] = [];
    for (let i = 1; i <= 6; i++) {
      const m = input.measurements.find((x) => x.key === `sprint_${i}`);
      if (m && m.numericValue != null && m.numericValue > 0) {
        sprintValues.push(m.numericValue);
      }
    }

    if (sprintValues.length === 0) {
      const single = input.measurements.find((m) => m.numericValue != null && m.numericValue > 0);
      if (single?.numericValue) sprintValues.push(single.numericValue);
    }

    if (sprintValues.length === 0 || sprintValues.some((time) => !Number.isFinite(time) || time <= 0 || time > 30)) {
      throw new Error("FIFA RSA requires at least one valid sprint time between 0 and 30 seconds.");
    }

    const bestTime = Math.min(...sprintValues);
    const sumTime = sprintValues.reduce((a, b) => a + b, 0);
    const meanTime = Math.round((sumTime / sprintValues.length) * 100) / 100;

    // FIFA Fatigue index % (Sdec)
    const fatigueIndex = sprintValues.length === 6
      ? Math.max(0, Math.round((((sumTime / (bestTime * 6)) - 1) * 100) * 10) / 10)
      : null;

    const scoreDisplay = `${bestTime.toFixed(2)}s (Mean: ${meanTime.toFixed(2)}s${fatigueIndex != null ? `, Fatigue: ${fatigueIndex}%` : ""})`;

    const normalizedMeasurements: RawMeasurement[] = [
      { key: "best_time", value: String(bestTime), numericValue: bestTime, unit: "s" },
      { key: "mean_time", value: String(meanTime), numericValue: meanTime, unit: "s" },
      ...(fatigueIndex == null ? [] : [{ key: "fatigue_index", value: String(fatigueIndex), numericValue: fatigueIndex, unit: "%" }]),
      ...sprintValues.map((t, idx) => ({
        key: `sprint_${idx + 1}`,
        value: String(t),
        numericValue: t,
        unit: "s",
        attempt: idx + 1
      }))
    ];

    return {
      summaryScore: bestTime,
      secondaryScore: fatigueIndex,
      primaryUnit: "s",
      scoreDisplay,
      normalizedMeasurements,
      metadata: {
        protocol: "FIFA RSA 6x40m Protocol",
        bestTime,
        meanTime,
        fatigueIndex,
        completedSprints: sprintValues.length
      }
    };
  }
};

/**
 * ----------------------------------------------------------------------------
 * 3. 30-15 Intermittent Fitness Test (30-15 IFT - Martin Buchheit Protocol)
 * Reference: Buchheit M. "The 30-15 Intermittent Fitness Test: Accuracy for
 * individualizing interval training in young intermittent sports players."
 * (J Strength Cond Res. 2008)
 * Measures VIFT (velocity in km/h) in 30s shuttle run / 15s walking recovery.
 * ----------------------------------------------------------------------------
 */
export const IFT3015Calculator: TestCalculator = {
  strategyKey: "IFT_30_15",
  defaultUnit: "km/h",
  defaultDirection: "HIGHER_IS_BETTER",

  validate(measurements: RawMeasurement[]) {
    const speedM = measurements.find((m) => m.key === "vift" || m.key === "speed" || m.key === "stage");
    const value = Number(speedM?.numericValue ?? speedM?.value);
    if (Number.isFinite(value) && value >= 8 && value <= 25) {
      return { valid: true };
    }
    return { valid: false, error: "30-15 IFT requires final velocity (VIFT) between 8.0 and 25.0 km/h." };
  },

  calculate(input: CalculationInput): CalculationOutput {
    const speedM = input.measurements.find((m) => m.key === "vift" || m.key === "speed" || m.key === "stage");
    const vift = Number(speedM?.numericValue ?? speedM?.value);
    if (!Number.isFinite(vift) || vift < 8 || vift > 25) throw new Error("30-15 IFT requires a valid final velocity (VIFT) between 8.0 and 25.0 km/h.");
    const scoreDisplay = `${vift.toFixed(1)} km/h (VIFT)`;

    const normalizedMeasurements: RawMeasurement[] = [
      { key: "vift", value: String(vift), numericValue: vift, unit: "km/h" }
    ];

    return {
      summaryScore: vift,
      secondaryScore: null,
      primaryUnit: "km/h",
      scoreDisplay,
      normalizedMeasurements,
      metadata: {
        protocol: "30-15 Intermittent Fitness Test (Buchheit)",
        vift
      }
    };
  }
};

/**
 * ----------------------------------------------------------------------------
 * 4. Illinois Agility Test
 * Measures speed and agility in 10m x 5m grid with slalom center cones.
 * ----------------------------------------------------------------------------
 */
export const IllinoisAgilityCalculator: TestCalculator = {
  strategyKey: "ILLINOIS_AGILITY",
  defaultUnit: "s",
  defaultDirection: "LOWER_IS_BETTER",

  validate(measurements: RawMeasurement[]) {
    const timeM = measurements.find((m) => m.key === "time" || m.key === "time_1" || m.key === "best_time");
    const value = Number(timeM?.numericValue ?? timeM?.value);
    if (Number.isFinite(value) && value > 10 && value < 30) {
      return { valid: true };
    }
    return { valid: false, error: "Illinois Agility test requires completed time between 10.0s and 30.0s." };
  },

  calculate(input: CalculationInput): CalculationOutput {
    const times = input.measurements
      .filter((m) => (m.key.startsWith("time") || m.key === "best_time") && Number.isFinite(Number(m.numericValue ?? m.value)) && Number(m.numericValue ?? m.value) > 10 && Number(m.numericValue ?? m.value) < 30)
      .map((m) => Number(m.numericValue ?? m.value));
    if (times.length === 0) throw new Error("Illinois Agility test requires a completed time between 10.0s and 30.0s.");

    const bestTime = Math.min(...times);
    const scoreDisplay = `${bestTime.toFixed(2)}s`;

    const normalizedMeasurements: RawMeasurement[] = [
      { key: "time", value: String(bestTime), numericValue: bestTime, unit: "s" },
      ...times.map((t, i) => ({
        key: `time_${i + 1}`,
        value: String(t),
        numericValue: t,
        unit: "s",
        attempt: i + 1
      }))
    ];

    return {
      summaryScore: bestTime,
      secondaryScore: null,
      primaryUnit: "s",
      scoreDisplay,
      normalizedMeasurements,
      metadata: {
        protocol: "Illinois Agility Test",
        bestTime
      }
    };
  }
};

/**
 * ----------------------------------------------------------------------------
 * 5. Cooper 12-Minute Aerobic Test
 * Classic continuous 12-minute run for maximum distance.
 * VO2max = (Distance in meters - 504.9) / 44.73
 * ----------------------------------------------------------------------------
 */
export const CooperTestCalculator: TestCalculator = {
  strategyKey: "COOPER_12MIN",
  defaultUnit: "m",
  defaultDirection: "HIGHER_IS_BETTER",

  validate(measurements: RawMeasurement[]) {
    const distM = measurements.find((m) => m.key === "distance");
    const value = Number(distM?.numericValue ?? distM?.value);
    if (Number.isInteger(value) && value >= 600 && value <= 5000) {
      return { valid: true };
    }
    return { valid: false, error: "Cooper Test requires distance in meters (500m - 5000m)." };
  },

  calculate(input: CalculationInput): CalculationOutput {
    const distM = input.measurements.find((m) => m.key === "distance");
    const distanceMeters = Number(distM?.numericValue ?? distM?.value);
    if (!Number.isInteger(distanceMeters) || distanceMeters < 600 || distanceMeters > 5000) throw new Error("Cooper Test requires a recorded distance between 600m and 5000m.");

    const vo2max = Math.round(((distanceMeters - 504.9) / 44.73) * 10) / 10;
    const scoreDisplay = `${distanceMeters.toLocaleString()} m (estimated VO₂: ${vo2max})`;

    const normalizedMeasurements: RawMeasurement[] = [
      { key: "distance", value: String(distanceMeters), numericValue: distanceMeters, unit: "m" },
      { key: "vo2max", value: String(vo2max), numericValue: vo2max, unit: "ml/kg/min" }
    ];

    return {
      summaryScore: distanceMeters,
      secondaryScore: vo2max,
      primaryUnit: "m",
      scoreDisplay,
      normalizedMeasurements,
      metadata: {
        protocol: "Cooper 12-Minute Aerobic Run",
        distanceMeters,
        estimatedVO2max: vo2max
      }
    };
  }
};
