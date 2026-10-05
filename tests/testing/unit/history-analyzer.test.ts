import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzePlayerHistory, type HistoricalTestRow } from "@/lib/testing/history-analyzer";

test("History Analyzer: empty history returns safe null-state", () => {
  const trend = analyzePlayerHistory([], "HIGHER_IS_BETTER");
  assert.equal(trend.totalTests, 0);
  assert.equal(trend.latestScore, null);
  assert.equal(trend.bestScore, null);
  assert.equal(trend.delta, null);
  assert.equal(trend.isImproved, null);
});

test("History Analyzer: single test establishes baseline without delta", () => {
  const rows: HistoricalTestRow[] = [
    {
      id: "r1",
      sessionId: "s1",
      sessionTitle: "Pre-season Test",
      date: new Date("2026-08-01"),
      summaryScore: 1200,
      secondaryScore: 46.5,
      scoreDisplay: "16.3 (1,200 m)",
      rank: 5,
      status: "VALID",
      isCorrected: false,
    }
  ];

  const trend = analyzePlayerHistory(rows, "HIGHER_IS_BETTER");
  assert.equal(trend.totalTests, 1);
  assert.equal(trend.latestScore, 1200);
  assert.equal(trend.previousScore, null);
  assert.equal(trend.bestScore, 1200);
  assert.equal(trend.delta, null);
  assert.equal(trend.isImproved, null);
});

test("History Analyzer: HIGHER_IS_BETTER improvement evaluation (Yo-Yo)", () => {
  const rows: HistoricalTestRow[] = [
    {
      id: "r1",
      sessionId: "s1",
      sessionTitle: "Session 1",
      date: new Date("2026-08-01"),
      summaryScore: 1200,
      secondaryScore: 46.5,
      scoreDisplay: "16.3 (1,200 m)",
      rank: 5,
      status: "VALID",
      isCorrected: false,
    },
    {
      id: "r2",
      sessionId: "s2",
      sessionTitle: "Session 2",
      date: new Date("2026-09-15"),
      summaryScore: 1400,
      secondaryScore: 48.2,
      scoreDisplay: "16.8 (1,400 m)",
      rank: 2,
      status: "VALID",
      isCorrected: false,
    }
  ];

  const trend = analyzePlayerHistory(rows, "HIGHER_IS_BETTER");
  assert.equal(trend.totalTests, 2);
  assert.equal(trend.latestScore, 1400);
  assert.equal(trend.previousScore, 1200);
  assert.equal(trend.bestScore, 1400);
  assert.equal(trend.delta, 200); // 1400 - 1200
  assert.equal(trend.percentageChange, 16.7); // (200 / 1200) * 100 = 16.666 -> 16.7%
  assert.equal(trend.isImproved, true);
});

test("History Analyzer: LOWER_IS_BETTER improvement evaluation (30m Sprint)", () => {
  const rows: HistoricalTestRow[] = [
    {
      id: "r1",
      sessionId: "s1",
      sessionTitle: "Sprint Test 1",
      date: new Date("2026-08-01"),
      summaryScore: 4.25,
      secondaryScore: null,
      scoreDisplay: "4.25 s",
      rank: 8,
      status: "VALID",
      isCorrected: false,
    },
    {
      id: "r2",
      sessionId: "s2",
      sessionTitle: "Sprint Test 2",
      date: new Date("2026-09-01"),
      summaryScore: 4.08,
      secondaryScore: null,
      scoreDisplay: "4.08 s",
      rank: 3,
      status: "VALID",
      isCorrected: false,
    }
  ];

  const trend = analyzePlayerHistory(rows, "LOWER_IS_BETTER");
  assert.equal(trend.totalTests, 2);
  assert.equal(trend.latestScore, 4.08);
  assert.equal(trend.previousScore, 4.25);
  // In LOWER_IS_BETTER, best is minimum time (4.08)
  assert.equal(trend.bestScore, 4.08);
  assert.equal(trend.delta, -0.17); // 4.08 - 4.25
  // Decreased time is an IMPROVEMENT!
  assert.equal(trend.isImproved, true);
});

test("History Analyzer: preserves correction state and reason", () => {
  const rows: HistoricalTestRow[] = [
    {
      id: "r1",
      sessionId: "s1",
      sessionTitle: "Session 1",
      date: new Date("2026-08-01"),
      summaryScore: 1240,
      secondaryScore: 46.8,
      scoreDisplay: "16.4 (1,240 m)",
      rank: 4,
      status: "VALID",
      isCorrected: true,
      correctionReason: "Timer operator noted extra shuttle finished before double beep.",
    }
  ];

  const trend = analyzePlayerHistory(rows, "HIGHER_IS_BETTER");
  assert.equal(trend.history[0]?.isCorrected, true);
  assert.equal(trend.history[0]?.correctionReason, "Timer operator noted extra shuttle finished before double beep.");
});
