import "server-only";

import type { PlayerPosition, PlayerStatus, TeamCategory } from "@prisma/client";

// ============================================================================
// PHASE 10B — DATA NORMALIZER & SANITIZER
// ----------------------------------------------------------------------------
// Normalizes and sanitizes untrusted incoming external data into canonical
// ESH internal formats and Prisma enums.
// ============================================================================

export function normalizeLicenceNumber(raw: string): string {
  if (!raw) return "";
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function normalizePersonName(name: string): string {
  if (!name) return "";
  return name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/<[^>]*>/g, ""); // Strip any HTML tags
}

export function mapFafPositionToPrisma(rawPosition?: string | null): PlayerPosition {
  if (!rawPosition) return "MIDFIELDER";
  const p = rawPosition.trim().toLowerCase();

  if (p.includes("gardien") || p.includes("goalkeeper") || p.includes("gk") || p === "g") {
    return "GOALKEEPER";
  }
  if (p.includes("défens") || p.includes("defens") || p.includes("arriere") || p.includes("df") || p === "d") {
    return "DEFENDER";
  }
  if (p.includes("attaqu") || p.includes("avant") || p.includes("buteur") || p.includes("fw") || p === "a") {
    return "FORWARD";
  }
  return "MIDFIELDER";
}

export function mapFafCategoryToPrisma(rawCategory?: string | null): TeamCategory {
  if (!rawCategory) return "SENIOR";
  const c = rawCategory.trim().toUpperCase().replace(/[-_\s]/g, "");

  if (c.includes("15")) return "U15";
  if (c.includes("17")) return "U17";
  if (c.includes("19") || c.includes("20") || c.includes("RESERVE") || c.includes("ESPOIR")) {
    return "U20";
  }
  return "SENIOR";
}

export function mapFafPlayerStatusToPrisma(fafStatus: string): PlayerStatus {
  switch (fafStatus) {
    case "VALID":
      return "ACTIVE";
    case "SUSPENDED":
      return "SUSPENDED";
    case "PENDING":
    case "REJECTED":
    default:
      return "ARCHIVED";
  }
}
