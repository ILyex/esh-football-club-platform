import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(input: string): string {
  return input
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F]/g, "") // strip Arabic tashkeel/diacritics
    .replace(/[^\p{L}\p{N}]+/gu, "-") // unicode-aware, keeps Arabic letters
    .replace(/(^-|-$)/g, "");
}

// Spec section 7: a player's birth year must be checked against their
// selected team/category's range, but a mismatch is a WARNING, never a
// block — "the administrator decides". Computed on read, not stored, so it
// stays correct even if the team's own birth-year range changes later.
export function birthYearMismatch(
  dateOfBirth: Date,
  team: { birthYearFrom: number | null; birthYearTo: number | null } | null | undefined
): boolean {
  if (!team || (team.birthYearFrom == null && team.birthYearTo == null)) return false; // e.g. SENIOR — no restriction
  const year = dateOfBirth.getUTCFullYear();
  if (team.birthYearFrom != null && year < team.birthYearFrom) return true;
  if (team.birthYearTo != null && year > team.birthYearTo) return true;
  return false;
}

/**
 * Returns the player's or staff's display name according to the active locale,
 * with seamless fallback between Arabic and French:
 * - If locale === 'fr': prioritizes French name (firstNameFr lastNameFr), falls back to Arabic (firstName lastName).
 * - If locale === 'ar' (or any other): prioritizes Arabic name (firstName lastName), falls back to French if Arabic is empty.
 */
export function getPlayerDisplayName(
  person: {
    firstName?: string | null;
    lastName?: string | null;
    firstNameFr?: string | null;
    lastNameFr?: string | null;
  },
  locale?: string
): string {
  const arabicFirst = (person.firstName ?? "").trim();
  const arabicLast = (person.lastName ?? "").trim();
  const arabicFull = `${arabicFirst} ${arabicLast}`.trim();

  const frenchFirst = (person.firstNameFr ?? "").trim();
  const frenchLast = (person.lastNameFr ?? "").trim();
  const frenchFull = `${frenchFirst} ${frenchLast}`.trim();

  if (locale === "fr") {
    if (frenchFull) return frenchFull;
    return arabicFull;
  }

  // Arabic or default locale
  if (arabicFull) return arabicFull;
  return frenchFull;
}

export const getPersonDisplayName = getPlayerDisplayName;

