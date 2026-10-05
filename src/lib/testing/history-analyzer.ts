import type { MetricDirection, PlayerPerformanceTrend, TestResultStatus } from "./types";

export interface HistoricalTestRow {
  id: string;
  sessionId: string;
  sessionTitle: string;
  date: Date;
  summaryScore: number | null;
  secondaryScore: number | null;
  scoreDisplay: string | null;
  rank: number | null;
  status: TestResultStatus;
  isCorrected: boolean;
  correctionReason?: string | null;
}

/**
 * Pure deterministic analyzer for player performance history in a specific test definition.
 */
export function analyzePlayerHistory(
  records: HistoricalTestRow[],
  direction: MetricDirection = "HIGHER_IS_BETTER"
): PlayerPerformanceTrend {
  // Sort chronologically ascending for analysis
  const validRecords = records
    .filter((r) => r.status === "VALID" && r.summaryScore !== null && !isNaN(r.summaryScore))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (validRecords.length === 0) {
    return {
      totalTests: 0,
      latestDate: null,
      latestScore: null,
      latestDisplay: null,
      previousDate: null,
      previousScore: null,
      bestScore: null,
      bestDate: null,
      delta: null,
      percentageChange: null,
      direction,
      isImproved: null,
      history: records.map((r) => ({
        id: r.id,
        sessionId: r.sessionId,
        sessionTitle: r.sessionTitle,
        date: r.date,
        score: r.summaryScore,
        secondaryScore: r.secondaryScore,
        scoreDisplay: r.scoreDisplay,
        rank: r.rank,
        status: r.status,
        isCorrected: r.isCorrected,
        correctionReason: r.correctionReason,
      }))
    };
  }

  const latest = validRecords[validRecords.length - 1]!;
  const previous = validRecords.length > 1 ? validRecords[validRecords.length - 2]! : null;

  // Determine best score according to semantic direction
  let best = validRecords[0]!;
  for (const rec of validRecords) {
    if (rec.summaryScore === null) continue;
    if (direction === "HIGHER_IS_BETTER") {
      if (best.summaryScore === null || rec.summaryScore > best.summaryScore) {
        best = rec;
      }
    } else if (direction === "LOWER_IS_BETTER") {
      if (best.summaryScore === null || rec.summaryScore < best.summaryScore) {
        best = rec;
      }
    }
  }

  let delta: number | null = null;
  let percentageChange: number | null = null;
  let isImproved: boolean | null = null;

  if (previous && previous.summaryScore !== null && latest.summaryScore !== null) {
    delta = Math.round((latest.summaryScore - previous.summaryScore) * 100) / 100;
    if (previous.summaryScore !== 0) {
      percentageChange = Math.round(((latest.summaryScore - previous.summaryScore) / Math.abs(previous.summaryScore)) * 1000) / 10;
    }

    if (direction === "HIGHER_IS_BETTER") {
      isImproved = delta > 0 ? true : delta < 0 ? false : null;
    } else if (direction === "LOWER_IS_BETTER") {
      isImproved = delta < 0 ? true : delta > 0 ? false : null;
    }
  }

  return {
    totalTests: validRecords.length,
    latestDate: latest.date,
    latestScore: latest.summaryScore,
    latestDisplay: latest.scoreDisplay,
    previousDate: previous?.date ?? null,
    previousScore: previous?.summaryScore ?? null,
    bestScore: best.summaryScore,
    bestDate: best.date,
    delta,
    percentageChange,
    direction,
    isImproved,
    history: records
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map((r) => ({
        id: r.id,
        sessionId: r.sessionId,
        sessionTitle: r.sessionTitle,
        date: r.date,
        score: r.summaryScore,
        secondaryScore: r.secondaryScore,
        scoreDisplay: r.scoreDisplay,
        rank: r.rank,
        status: r.status,
        isCorrected: r.isCorrected,
        correctionReason: r.correctionReason,
      }))
  };
}
