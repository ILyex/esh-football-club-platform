import type { TestCalculator, CalculationInput, CalculationOutput, RawMeasurement } from "../types";

/**
 * Official Bangsbo Yo-Yo Intermittent Recovery Test — Level 1 (Yo-Yo IR1) Protocol
 *
 * References:
 *  - Bangsbo J, Iaia FM, Krustrup P. "The Yo-Yo Intermittent Recovery Test : a useful tool
 *    for evaluation of physical performance in intermittent sports." Sports Med. 2008;38(1):37-51.
 *  - Krustrup P, Mohr M, Amstrup T, et al. "The yo-yo intermittent recovery test: physiological
 *    response, reliability, and validity." Med Sci Sports Exerc. 2003;35(4):697-705.
 *
 * Structure:
 *  - 2 x 20m shuttle runs with 10s active recovery (2 x 5m walk/jog) between shuttles.
 *  - Each shuttle is 40 meters.
 *  - Starts at Level 5 (10.0 km/h) and progressively speeds up.
 *
 * Official VO2max Estimation Formula:
 *   VO2max (ml/kg/min) = (Distance in meters * 0.0084) + 36.4
 */

export interface YoYoLevelInfo {
  level: number;
  speedKmh: number;
  shuttlesInLevel: number;
  priorDistanceMeters: number;
  levelTotalDistanceMeters: number;
}

export const YOYO_IR1_LEVELS: readonly YoYoLevelInfo[] = [
  { level: 5, speedKmh: 10.0, shuttlesInLevel: 1, priorDistanceMeters: 0, levelTotalDistanceMeters: 40 },
  { level: 9, speedKmh: 12.0, shuttlesInLevel: 1, priorDistanceMeters: 40, levelTotalDistanceMeters: 40 },
  { level: 11, speedKmh: 13.0, shuttlesInLevel: 2, priorDistanceMeters: 80, levelTotalDistanceMeters: 80 },
  { level: 12, speedKmh: 13.5, shuttlesInLevel: 3, priorDistanceMeters: 160, levelTotalDistanceMeters: 120 },
  { level: 13, speedKmh: 14.0, shuttlesInLevel: 4, priorDistanceMeters: 280, levelTotalDistanceMeters: 160 },
  { level: 14, speedKmh: 14.5, shuttlesInLevel: 8, priorDistanceMeters: 440, levelTotalDistanceMeters: 320 },
  { level: 15, speedKmh: 15.0, shuttlesInLevel: 8, priorDistanceMeters: 760, levelTotalDistanceMeters: 320 },
  { level: 16, speedKmh: 15.5, shuttlesInLevel: 8, priorDistanceMeters: 1080, levelTotalDistanceMeters: 320 },
  { level: 17, speedKmh: 16.0, shuttlesInLevel: 8, priorDistanceMeters: 1400, levelTotalDistanceMeters: 320 },
  { level: 18, speedKmh: 16.5, shuttlesInLevel: 8, priorDistanceMeters: 1720, levelTotalDistanceMeters: 320 },
  { level: 19, speedKmh: 17.0, shuttlesInLevel: 8, priorDistanceMeters: 2040, levelTotalDistanceMeters: 320 },
  { level: 20, speedKmh: 17.5, shuttlesInLevel: 8, priorDistanceMeters: 2360, levelTotalDistanceMeters: 320 },
  { level: 21, speedKmh: 18.0, shuttlesInLevel: 8, priorDistanceMeters: 2680, levelTotalDistanceMeters: 320 },
  { level: 22, speedKmh: 18.5, shuttlesInLevel: 8, priorDistanceMeters: 3000, levelTotalDistanceMeters: 320 },
  { level: 23, speedKmh: 19.0, shuttlesInLevel: 8, priorDistanceMeters: 3320, levelTotalDistanceMeters: 320 },
] as const;

export const SHUTTLE_DISTANCE_METERS = 40;

/**
 * Calculates total cumulative distance (in meters) from level and completed shuttle.
 */
export function calculateYoYoDistance(level: number, shuttle: number): number {
  if (!Number.isInteger(level) || !Number.isInteger(shuttle)) {
    throw new Error("Yo-Yo IR1 level and shuttle must be whole numbers.");
  }
  const levelInfo = YOYO_IR1_LEVELS.find((l) => l.level === level);
  if (!levelInfo) {
    throw new Error(`Invalid Yo-Yo IR1 level: ${level}. Allowed levels are: ${YOYO_IR1_LEVELS.map((l) => l.level).join(", ")}`);
  }
  if (shuttle < 1 || shuttle > levelInfo.shuttlesInLevel) {
    throw new Error(`Invalid shuttle ${shuttle} for level ${level}. Maximum shuttles is ${levelInfo.shuttlesInLevel}.`);
  }
  return levelInfo.priorDistanceMeters + shuttle * SHUTTLE_DISTANCE_METERS;
}

/**
 * Derives level and shuttle from total meters completed in Yo-Yo IR1.
 */
export function deriveYoYoLevelAndShuttle(distanceMeters: number): { level: number; shuttle: number } {
  if (!Number.isInteger(distanceMeters) || distanceMeters < SHUTTLE_DISTANCE_METERS || distanceMeters > 3640 || distanceMeters % SHUTTLE_DISTANCE_METERS !== 0) {
    throw new Error("Yo-Yo IR1 distance must be a completed 40m shuttle between 40m and 3640m.");
  }
  for (let i = YOYO_IR1_LEVELS.length - 1; i >= 0; i--) {
    const info = YOYO_IR1_LEVELS[i];
    if (info && distanceMeters > info.priorDistanceMeters) {
      const remainingMeters = distanceMeters - info.priorDistanceMeters;
      const shuttle = Math.min(Math.floor(remainingMeters / SHUTTLE_DISTANCE_METERS), info.shuttlesInLevel);
      return { level: info.level, shuttle: Math.max(1, shuttle) };
    }
  }
  throw new Error("Unable to derive a Yo-Yo IR1 level from the provided distance.");
}

/**
 * Calculates estimated VO2max from Yo-Yo IR1 distance in meters using Bangsbo equation.
 * VO2max (ml/kg/min) = distance * 0.0084 + 36.4
 */
export function calculateYoYoVO2max(distanceMeters: number): number {
  if (distanceMeters <= 0) return 0;
  const raw = distanceMeters * 0.0084 + 36.4;
  return Math.round(raw * 10) / 10;
}

export const YoYoIR1Calculator: TestCalculator = {
  strategyKey: "YOYO_IR1",
  defaultUnit: "m",
  defaultDirection: "HIGHER_IS_BETTER",

  validate(measurements: RawMeasurement[]) {
    const levelM = measurements.find((m) => m.key === "level");
    const shuttleM = measurements.find((m) => m.key === "shuttle");
    const distM = measurements.find((m) => m.key === "distance");

    // If explicit level and shuttle are provided, validate them first
    if (levelM && shuttleM) {
      const level = Number(levelM.numericValue ?? levelM.value);
      const shuttle = Number(shuttleM.numericValue ?? shuttleM.value);

      if (!Number.isInteger(level) || !Number.isInteger(shuttle)) {
        return { valid: false, error: "Yo-Yo IR1 level and shuttle must be whole numbers." };
      }

      const levelInfo = YOYO_IR1_LEVELS.find((l) => l.level === level);
      if (!levelInfo) {
        return { valid: false, error: `Invalid Yo-Yo IR1 level: ${level}.` };
      }
      if (shuttle < 1 || shuttle > levelInfo.shuttlesInLevel) {
        return { valid: false, error: `Invalid shuttle count ${shuttle} for level ${level} (max: ${levelInfo.shuttlesInLevel}).` };
      }
      if (distM) {
        const recordedDistance = Number(distM.numericValue ?? distM.value);
        const calculatedDistance = levelInfo.priorDistanceMeters + shuttle * SHUTTLE_DISTANCE_METERS;
        if (!Number.isInteger(recordedDistance) || recordedDistance !== calculatedDistance) {
          return { valid: false, error: "Recorded distance does not match the selected Yo-Yo IR1 level and shuttle." };
        }
      }
      return { valid: true };
    }

    if (distM) {
      const distance = Number(distM.numericValue ?? distM.value);
      if (!Number.isInteger(distance) || distance < 40 || distance > 3640 || distance % 40 !== 0) {
        return { valid: false, error: "Distance must be a completed 40m shuttle between 40m and 3640m." };
      }
      return { valid: true };
    }

    return { valid: false, error: "Yo-Yo IR1 requires either 'distance' or both 'level' and 'shuttle' measurements." };
  },

  calculate(input: CalculationInput): CalculationOutput {
    let distanceMeters = 0;
    let level = 5;
    let shuttle = 1;

    const levelM = input.measurements.find((m) => m.key === "level");
    const shuttleM = input.measurements.find((m) => m.key === "shuttle");
    const distM = input.measurements.find((m) => m.key === "distance");

    // Explicit level and shuttle take precedence over derived distance
    if (levelM && shuttleM) {
      level = Number(levelM.numericValue ?? levelM.value);
      shuttle = Number(shuttleM.numericValue ?? shuttleM.value);
      distanceMeters = calculateYoYoDistance(level, shuttle);
    } else if (distM) {
      distanceMeters = Number(distM.numericValue ?? distM.value);
      if (!Number.isInteger(distanceMeters) || distanceMeters % 40 !== 0) {
        throw new Error("Yo-Yo IR1 distance must be entered in completed 40m shuttles.");
      }
      const derived = deriveYoYoLevelAndShuttle(distanceMeters);
      level = derived.level;
      shuttle = derived.shuttle;
    } else {
      throw new Error("Missing required measurements for Yo-Yo IR1.");
    }

    const vo2max = calculateYoYoVO2max(distanceMeters);
    const scoreDisplay = `${level}.${shuttle} (${distanceMeters.toLocaleString()} m)`;

    const normalizedMeasurements: RawMeasurement[] = [
      { key: "level", value: String(level), numericValue: level, unit: "level" },
      { key: "shuttle", value: String(shuttle), numericValue: shuttle, unit: "shuttle" },
      { key: "distance", value: String(distanceMeters), numericValue: distanceMeters, unit: "m" },
      { key: "vo2max", value: String(vo2max), numericValue: vo2max, unit: "ml/kg/min" },
    ];

    return {
      summaryScore: distanceMeters,
      secondaryScore: vo2max,
      primaryUnit: "m",
      scoreDisplay,
      normalizedMeasurements,
      metadata: {
        protocol: "Yo-Yo Intermittent Recovery Test - Level 1 (Bangsbo)",
        level,
        shuttle,
        distanceMeters,
        vo2max,
      }
    };
  }
};
