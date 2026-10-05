/**
 * Unified Central Date Management System for ESH Platform
 * Standard Mandatory Format: DD/MM/YYYY (e.g., 05/10/2026)
 *
 * Provides strict validation, conversion between UI (DD/MM/YYYY) and Database (ISO/Date),
 * leap year verification, and safe bidirectional transformations without day/month inversions.
 */

/**
 * Returns true if the given year is a Gregorian leap year.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns the maximum days in a given month of a given year.
 */
export function getDaysInMonth(month: number, year: number): number {
  if (month < 1 || month > 12) return 0;
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month)) {
    return 30;
  }
  return 31;
}

/**
 * Validates whether a string matches strictly DD/MM/YYYY format with valid day, month, and year.
 * Correctly accounts for days per month and leap years.
 * Example valid: "05/10/2026", "29/02/2024"
 * Example invalid: "31/04/2026" (April has 30 days), "29/02/2025" (not a leap year)
 */
export function isValidDMY(dmyStr?: string | null): boolean {
  if (!dmyStr || typeof dmyStr !== "string") return false;
  const trimmed = dmyStr.trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match || !match[1] || !match[2] || !match[3]) return false;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;

  const maxDays = getDaysInMonth(month, year);
  return day >= 1 && day <= maxDays;
}

/**
 * Validates whether a string matches DD/MM/YYYY HH:mm format.
 */
export function isValidDMYTime(dmyTimeStr?: string | null): boolean {
  if (!dmyTimeStr || typeof dmyTimeStr !== "string") return false;
  const trimmed = dmyTimeStr.trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!match || !match[1] || !match[2] || !match[3] || !match[4] || !match[5]) return false;

  const datePart = `${match[1]}/${match[2]}/${match[3]}`;
  if (!isValidDMY(datePart)) return false;

  const hours = parseInt(match[4], 10);
  const minutes = parseInt(match[5], 10);

  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

/**
 * Formats any Date, ISO string, or timestamp into the mandatory DD/MM/YYYY display format.
 * Guarantees zero-padded two-digit day and month.
 * Example: Date("2026-10-05T00:00:00Z") -> "05/10/2026"
 */
export function formatDateToDMY(date?: Date | string | number | null): string {
  if (!date) return "";
  try {
    const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "";

    // If date string was in format YYYY-MM-DD without time, parse parts directly to avoid UTC timezone offset shifts
    if (typeof date === "string") {
      const ymdMatch = date.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (ymdMatch && ymdMatch[1] && ymdMatch[2] && ymdMatch[3]) {
        return `${ymdMatch[3]}/${ymdMatch[2]}/${ymdMatch[1]}`;
      }
      const dmyMatch = date.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (dmyMatch && dmyMatch[1] && dmyMatch[2] && dmyMatch[3]) {
        return `${dmyMatch[1].padStart(2, "0")}/${dmyMatch[2].padStart(2, "0")}/${dmyMatch[3]}`;
      }
    }

    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = String(d.getFullYear());
    return `${day}/${month}/${year}`;
  } catch {
    return "";
  }
}

/**
 * Formats a Date or timestamp into DD/MM/YYYY HH:mm format (24-hour).
 */
export function formatDateTimeToDMY(date?: Date | string | number | null): string {
  if (!date) return "";
  try {
    const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "";

    const datePart = formatDateToDMY(d);
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");

    return `${datePart} ${hours}:${minutes}`;
  } catch {
    return "";
  }
}

/**
 * Parses a DD/MM/YYYY string into a JavaScript Date object.
 * Strictly assigns: match[1] = Day, match[2] = Month, match[3] = Year.
 * Never inverts Day and Month!
 * Returns null if invalid.
 */
export function parseDMYToDate(dmyStr?: string | null): Date | null {
  if (!dmyStr || typeof dmyStr !== "string") return null;
  const trimmed = dmyStr.trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match || !match[1] || !match[2] || !match[3]) {
    // If input was already ISO YYYY-MM-DD
    const ymd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymd && ymd[1] && ymd[2] && ymd[3]) {
      const year = parseInt(ymd[1], 10);
      const month = parseInt(ymd[2], 10);
      const day = parseInt(ymd[3], 10);
      return new Date(year, month - 1, day, 12, 0, 0);
    }
    return null;
  }

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  if (month < 1 || month > 12) return null;
  const maxDays = getDaysInMonth(month, year);
  if (day < 1 || day > maxDays) return null;

  // Use midday (12:00:00) local to prevent any daylight saving or timezone boundary shift
  return new Date(year, month - 1, day, 12, 0, 0);
}

/**
 * Converts a DD/MM/YYYY or YYYY-MM-DD input string into an ISO YYYY-MM-DD string for Database / Prisma storage.
 * Preserves day and month order strictly.
 * Example: "05/10/2026" -> "2026-10-05"
 */
export function parseDMYToISO(dateStr?: string | null): string | null {
  if (!dateStr || typeof dateStr !== "string" || !dateStr.trim()) return null;
  const trimmed = dateStr.trim();

  // Match DD/MM/YYYY (or DD-MM-YYYY or DD.MM.YYYY)
  const dmy = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy && dmy[1] && dmy[2] && dmy[3]) {
    const day = dmy[1].padStart(2, "0");
    const month = dmy[2].padStart(2, "0");
    const year = dmy[3];
    return `${year}-${month}-${day}`;
  }

  // Match YYYY-MM-DD
  const ymd = trimmed.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (ymd && ymd[1] && ymd[2] && ymd[3]) {
    const year = ymd[1];
    const month = ymd[2].padStart(2, "0");
    const day = ymd[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return trimmed;
}

/**
 * Converts an ISO YYYY-MM-DD or ISO DateTime or Date object to DD/MM/YYYY for UI display.
 * Example: "2026-10-05" -> "05/10/2026"
 */
export function parseISOToDMY(dateStr?: string | Date | null): string {
  if (!dateStr) return "";
  if (dateStr instanceof Date) {
    return formatDateToDMY(dateStr);
  }
  const trimmed = String(dateStr).trim();
  const ymd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd && ymd[1] && ymd[2] && ymd[3]) {
    const year = ymd[1];
    const month = ymd[2];
    const day = ymd[3];
    return `${day}/${month}/${year}`;
  }
  return formatDateToDMY(trimmed);
}

/**
 * Parses a DD/MM/YYYY HH:mm string into an ISO DateTime string for Database / Prisma storage.
 * Example: "05/10/2026 15:30" -> "2026-10-05T15:30:00"
 */
export function parseDMYTimeToISO(dmyTimeStr?: string | null): string | null {
  if (!dmyTimeStr || typeof dmyTimeStr !== "string" || !dmyTimeStr.trim()) return null;
  const trimmed = dmyTimeStr.trim();

  // Match DD/MM/YYYY HH:mm
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match && match[1] && match[2] && match[3] && match[4] && match[5]) {
    const day = match[1].padStart(2, "0");
    const month = match[2].padStart(2, "0");
    const year = match[3];
    const hours = match[4].padStart(2, "0");
    const minutes = match[5].padStart(2, "0");
    const seconds = (match[6] || "00").padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  // If already in ISO datetime format YYYY-MM-DDTHH:mm
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Parses a DateTime ISO string (YYYY-MM-DDTHH:mm) into DD/MM/YYYY HH:mm
 * Example: "2026-10-05T15:30" -> "05/10/2026 15:30"
 */
export function parseISOToDMYTime(isoStr?: string | Date | null): string {
  if (!isoStr) return "";
  if (isoStr instanceof Date) {
    return formatDateTimeToDMY(isoStr);
  }
  const trimmed = String(isoStr).trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (match && match[1] && match[2] && match[3] && match[4] && match[5]) {
    const year = match[1];
    const month = match[2];
    const day = match[3];
    const hours = match[4];
    const minutes = match[5];
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }
  return formatDateTimeToDMY(trimmed);
}
