import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isLeapYear,
  getDaysInMonth,
  isValidDMY,
  isValidDMYTime,
  formatDateToDMY,
  formatDateTimeToDMY,
  parseDMYToDate,
  parseDMYToISO,
  parseISOToDMY,
  parseDMYTimeToISO,
  parseISOToDMYTime
} from "@/lib/date-utils";

test("isLeapYear correctly handles Gregorian leap years", () => {
  assert.equal(isLeapYear(2024), true); // Divisible by 4
  assert.equal(isLeapYear(2026), false); // Not divisible by 4
  assert.equal(isLeapYear(2000), true); // Divisible by 400
  assert.equal(isLeapYear(1900), false); // Divisible by 100 but not 400
});

test("getDaysInMonth accurately returns days per month including February in leap years", () => {
  assert.equal(getDaysInMonth(1, 2026), 31); // January
  assert.equal(getDaysInMonth(2, 2026), 28); // Feb 2026 non-leap
  assert.equal(getDaysInMonth(2, 2024), 29); // Feb 2024 leap
  assert.equal(getDaysInMonth(4, 2026), 30); // April
  assert.equal(getDaysInMonth(10, 2026), 31); // October
});

test("isValidDMY strictly enforces DD/MM/YYYY and validates real dates", () => {
  // Valid dates
  assert.equal(isValidDMY("05/10/2026"), true);
  assert.equal(isValidDMY("29/02/2024"), true);
  assert.equal(isValidDMY("31/12/2026"), true);
  assert.equal(isValidDMY("1/1/2026"), true);

  // Invalid dates
  assert.equal(isValidDMY("29/02/2026"), false); // 2026 is not leap year
  assert.equal(isValidDMY("31/04/2026"), false); // April has 30 days
  assert.equal(isValidDMY("32/01/2026"), false); // Day 32 impossible
  assert.equal(isValidDMY("15/13/2026"), false); // Month 13 impossible
  assert.equal(isValidDMY("00/05/2026"), false); // Day 0 impossible
  assert.equal(isValidDMY("2026-10-05"), false); // Must be DD/MM/YYYY
  assert.equal(isValidDMY("10-05-2026"), false); // Must use forward slash
  assert.equal(isValidDMY("invalid"), false);
  assert.equal(isValidDMY(null), false);
});

test("parseDMYToISO converts DD/MM/YYYY to YYYY-MM-DD without swapping day and month", () => {
  assert.equal(parseDMYToISO("05/10/2026"), "2026-10-05"); // October 5, NOT May 10!
  assert.equal(parseDMYToISO("10/05/2026"), "2026-05-10"); // May 10, NOT October 5!
  assert.equal(parseDMYToISO("29/02/2024"), "2024-02-29");
  assert.equal(parseDMYToISO("31/12/2025"), "2025-12-31");
  assert.equal(parseDMYToISO("2026-10-05"), "2026-10-05"); // Idempotent
  assert.equal(parseDMYToISO(null), null);
});

test("parseISOToDMY converts ISO string or Date to DD/MM/YYYY", () => {
  assert.equal(parseISOToDMY("2026-10-05"), "05/10/2026");
  assert.equal(parseISOToDMY("2026-05-10"), "10/05/2026");
  assert.equal(parseISOToDMY("2024-02-29"), "29/02/2024");
  assert.equal(parseISOToDMY(new Date(2026, 9, 5)), "05/10/2026"); // Month index 9 is October
  assert.equal(parseISOToDMY(null), "");
});

test("formatDateToDMY formats any date type to DD/MM/YYYY with zero padding", () => {
  assert.equal(formatDateToDMY("2026-10-05"), "05/10/2026");
  assert.equal(formatDateToDMY("2026-01-02"), "02/01/2026");
  assert.equal(formatDateToDMY("05/10/2026"), "05/10/2026");
  assert.equal(formatDateToDMY(null), "");
});

test("parseDMYToDate correctly constructs Date object with noon time", () => {
  const d = parseDMYToDate("05/10/2026");
  assert.ok(d instanceof Date);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 9); // October
  assert.equal(d.getDate(), 5); // 5th

  // Invalid date returns null
  assert.equal(parseDMYToDate("31/04/2026"), null);
  assert.equal(parseDMYToDate("invalid"), null);
});

test("parseDMYTimeToISO and parseISOToDMYTime correctly handle datetime fields", () => {
  assert.equal(parseDMYTimeToISO("05/10/2026 15:30"), "2026-10-05T15:30:00");
  assert.equal(parseISOToDMYTime("2026-10-05T15:30:00"), "05/10/2026 15:30");
  assert.equal(isValidDMYTime("05/10/2026 15:30"), true);
  assert.equal(isValidDMYTime("05/10/2026 25:00"), false); // Invalid hour
});
