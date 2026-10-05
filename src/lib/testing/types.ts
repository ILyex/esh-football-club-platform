import type { TestCategory, MetricDirection, TestSessionStatus, TestResultStatus } from "@prisma/client";

export type { TestCategory, MetricDirection, TestSessionStatus, TestResultStatus };

export interface RawMeasurement {
  key: string;
  value: string;
  numericValue?: number | null;
  unit?: string | null;
  attempt?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface CalculationInput {
  measurements: RawMeasurement[];
  protocolVersion?: number;
}

export interface CalculationOutput {
  summaryScore: number; // Primary normalized numeric score for sorting/trending
  secondaryScore?: number | null; // e.g. estimated VO2max
  primaryUnit: string; // e.g. "m", "s", "cm"
  scoreDisplay: string; // Formatted user-friendly label (e.g. "Level 16.3 (1,400 m)")
  normalizedMeasurements: RawMeasurement[];
  metadata?: Record<string, unknown>;
}

export interface TestCalculator {
  readonly strategyKey: string;
  readonly defaultUnit: string;
  readonly defaultDirection: MetricDirection;
  validate(measurements: RawMeasurement[]): { valid: boolean; error?: string };
  calculate(input: CalculationInput): CalculationOutput;
}

export interface PlayerPerformanceTrend {
  totalTests: number;
  latestDate: Date | null;
  latestScore: number | null;
  latestDisplay: string | null;
  previousDate: Date | null;
  previousScore: number | null;
  bestScore: number | null;
  bestDate: Date | null;
  delta: number | null; // latest - previous
  percentageChange: number | null; // ((latest - previous) / previous) * 100
  direction: MetricDirection;
  isImproved: boolean | null;
  history: Array<{
    id: string;
    sessionId: string;
    sessionTitle: string;
    date: Date;
    score: number | null;
    secondaryScore: number | null;
    scoreDisplay: string | null;
    rank: number | null;
    status: TestResultStatus;
    isCorrected: boolean;
    correctionReason?: string | null;
  }>;
}
