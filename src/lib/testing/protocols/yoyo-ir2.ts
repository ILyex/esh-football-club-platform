import type { CalculationInput, CalculationOutput, RawMeasurement, TestCalculator } from "../types";

/** Yo-Yo IR2 score blocks based on Bangsbo et al. (2008). */
export interface YoYoIR2LevelInfo {
  level: number;
  speedKmh: number;
  shuttlesInLevel: number;
  priorDistanceMeters: number;
}

export const YOYO_IR2_LEVELS: readonly YoYoIR2LevelInfo[] = [
  { level: 11, speedKmh: 13, shuttlesInLevel: 1, priorDistanceMeters: 0 },
  { level: 15, speedKmh: 15, shuttlesInLevel: 1, priorDistanceMeters: 40 },
  { level: 17, speedKmh: 16, shuttlesInLevel: 2, priorDistanceMeters: 80 },
  { level: 18, speedKmh: 16.5, shuttlesInLevel: 3, priorDistanceMeters: 160 },
  { level: 19, speedKmh: 17, shuttlesInLevel: 4, priorDistanceMeters: 280 },
  { level: 20, speedKmh: 17.5, shuttlesInLevel: 8, priorDistanceMeters: 440 },
  { level: 21, speedKmh: 18, shuttlesInLevel: 8, priorDistanceMeters: 760 },
  { level: 22, speedKmh: 18.5, shuttlesInLevel: 8, priorDistanceMeters: 1080 },
  { level: 23, speedKmh: 19, shuttlesInLevel: 8, priorDistanceMeters: 1400 },
  { level: 24, speedKmh: 19.5, shuttlesInLevel: 8, priorDistanceMeters: 1720 },
  { level: 25, speedKmh: 20, shuttlesInLevel: 8, priorDistanceMeters: 2040 },
  { level: 26, speedKmh: 20.5, shuttlesInLevel: 8, priorDistanceMeters: 2360 },
] as const;

export const YOYO_IR2_MAX_DISTANCE_METERS = 2680;

export function calculateYoYoIR2Distance(level: number, shuttle: number): number {
  if (!Number.isInteger(level) || !Number.isInteger(shuttle)) throw new Error("Yo-Yo IR2 level and shuttle must be whole numbers.");
  const levelInfo = YOYO_IR2_LEVELS.find((item) => item.level === level);
  if (!levelInfo) throw new Error(`Invalid Yo-Yo IR2 speed level: ${level}.`);
  if (shuttle < 1 || shuttle > levelInfo.shuttlesInLevel) throw new Error(`Invalid shuttle ${shuttle} for Yo-Yo IR2 level ${level}.`);
  return levelInfo.priorDistanceMeters + shuttle * 40;
}

export function deriveYoYoIR2LevelAndShuttle(distanceMeters: number): { level: number; shuttle: number } {
  if (!Number.isInteger(distanceMeters) || distanceMeters < 40 || distanceMeters > YOYO_IR2_MAX_DISTANCE_METERS || distanceMeters % 40 !== 0) {
    throw new Error(`Yo-Yo IR2 distance must be a completed 40m shuttle between 40m and ${YOYO_IR2_MAX_DISTANCE_METERS}m.`);
  }
  for (let i = YOYO_IR2_LEVELS.length - 1; i >= 0; i--) {
    const info = YOYO_IR2_LEVELS[i]!;
    if (distanceMeters > info.priorDistanceMeters) {
      return { level: info.level, shuttle: (distanceMeters - info.priorDistanceMeters) / 40 };
    }
  }
  throw new Error("Unable to derive a Yo-Yo IR2 level from the provided distance.");
}

export function calculateYoYoIR2VO2max(distanceMeters: number): number {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) throw new Error("Yo-Yo IR2 distance must be a non-negative number.");
  return Math.round((distanceMeters * 0.0136 + 45.3) * 10) / 10;
}

export const YoYoIR2Calculator: TestCalculator = {
  strategyKey: "YOYO_IR2",
  defaultUnit: "m",
  defaultDirection: "HIGHER_IS_BETTER",
  validate(measurements: RawMeasurement[]) {
    const distance = measurements.find((m) => m.key === "distance");
    const level = measurements.find((m) => m.key === "level");
    const shuttle = measurements.find((m) => m.key === "shuttle");
    if (level || shuttle) {
      if (!level || !shuttle) return { valid: false, error: "Yo-Yo IR2 requires both level and shuttle." };
      try {
        const calculatedDistance = calculateYoYoIR2Distance(Number(level.numericValue ?? level.value), Number(shuttle.numericValue ?? shuttle.value));
        if (distance && Number(distance.numericValue ?? distance.value) !== calculatedDistance) {
          return { valid: false, error: "Recorded distance does not match the selected Yo-Yo IR2 level and shuttle." };
        }
        return { valid: true };
      } catch (error) {
        return { valid: false, error: error instanceof Error ? error.message : "Invalid Yo-Yo IR2 result." };
      }
    }
    if (!distance) return { valid: false, error: "Yo-Yo IR2 requires a distance or both level and shuttle." };
    try {
      deriveYoYoIR2LevelAndShuttle(Number(distance.numericValue ?? distance.value));
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : "Invalid Yo-Yo IR2 distance." };
    }
  },
  calculate(input: CalculationInput): CalculationOutput {
    const distanceMeasurement = input.measurements.find((m) => m.key === "distance");
    const levelMeasurement = input.measurements.find((m) => m.key === "level");
    const shuttleMeasurement = input.measurements.find((m) => m.key === "shuttle");
    const distance = levelMeasurement && shuttleMeasurement
      ? calculateYoYoIR2Distance(Number(levelMeasurement.numericValue ?? levelMeasurement.value), Number(shuttleMeasurement.numericValue ?? shuttleMeasurement.value))
      : Number(distanceMeasurement?.numericValue ?? distanceMeasurement?.value);
    const { level, shuttle } = deriveYoYoIR2LevelAndShuttle(distance);
    const vo2max = calculateYoYoIR2VO2max(distance);
    return {
      summaryScore: distance,
      secondaryScore: vo2max,
      primaryUnit: "m",
      scoreDisplay: `${level}.${shuttle} (${distance.toLocaleString()} m)`,
      normalizedMeasurements: [
        { key: "level", value: String(level), numericValue: level, unit: "speed level" },
        { key: "shuttle", value: String(shuttle), numericValue: shuttle, unit: "shuttle" },
        { key: "distance", value: String(distance), numericValue: distance, unit: "m" },
        { key: "vo2max", value: String(vo2max), numericValue: vo2max, unit: "ml/kg/min" },
      ],
      metadata: { protocol: "Yo-Yo Intermittent Recovery Test - Level 2 (Bangsbo)", level, shuttle, distanceMeters: distance, estimatedVo2max: vo2max },
    };
  },
};
