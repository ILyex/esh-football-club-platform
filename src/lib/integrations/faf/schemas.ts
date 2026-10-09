import "server-only";

import { z } from "zod";

// ============================================================================
// PHASE 10B — UNTRUSTED FAF DATA VALIDATION SCHEMAS
// ----------------------------------------------------------------------------
// Enforces strict runtime boundary verification for all data originating from
// FAF Connect. Malformed or hostile inputs are rejected before domain execution.
// ============================================================================

export function isSafeExternalUrl(urlStr: string | null | undefined): boolean {
  if (!urlStr) return false;
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");

    // Disallow empty or loopback hostname strings
    if (!host || host === "localhost" || host === "0.0.0.0" || host === "::" || host === "::1") {
      return false;
    }

    // Disallow loopback 127.0.0.0/8
    if (host.startsWith("127.") || host === "127.1") {
      return false;
    }

    // Disallow Cloud metadata service (169.254.0.0/16)
    if (host.startsWith("169.254.")) {
      return false;
    }

    // Disallow RFC 1918 private IPv4 ranges:
    // 10.0.0.0/8
    if (host.startsWith("10.")) return false;
    // 192.168.0.0/16
    if (host.startsWith("192.168.")) return false;
    // 172.16.0.0 - 172.31.255.255
    const match172 = host.match(/^172\.(\d+)\./);
    if (match172 && match172[1]) {
      const secondOctet = parseInt(match172[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) return false;
    }

    // Disallow IPv6 link-local and unique local addresses
    if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) {
      return false;
    }

    // Disallow common private domain suffixes
    if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".lan")) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export const fafPlayerLicenceSchema = z.object({
  licenceNumber: z
    .string()
    .trim()
    .min(3, "Licence number must be at least 3 characters")
    .max(50, "Licence number exceeds maximum length")
    .regex(/^[A-Za-z0-9\-_./]+$/, "Licence contains invalid characters"),
  nationalId: z.string().trim().max(30).optional().nullable(),
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  dateOfBirth: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be YYYY-MM-DD")
    .refine((dateStr) => {
      const date = new Date(dateStr);
      return !isNaN(date.getTime()) && date < new Date();
    }, "Date of birth must be a valid past date"),
  nationality: z.string().trim().min(2).max(60).default("Algérien"),
  category: z.string().trim().min(2).max(20),
  status: z.enum(["VALID", "SUSPENDED", "PENDING", "REJECTED"]).default("VALID"),
  medicalClearanceDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  registrationDate: z.string().trim().optional().nullable(),
  photoUrl: z
    .string()
    .trim()
    .url("Invalid photo URL")
    .optional()
    .nullable()
    .refine((url) => !url || isSafeExternalUrl(url), "SSRF protection: internal or unsafe photo URLs are forbidden")
});

export const fafStaffLicenceSchema = z.object({
  licenceNumber: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .regex(/^[A-Za-z0-9\-_./]+$/),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  role: z.string().trim().min(2).max(50),
  qualificationLevel: z.string().trim().max(100).optional().nullable(),
  status: z.enum(["VALID", "SUSPENDED", "PENDING"]).default("VALID"),
  category: z.string().trim().max(20).optional().nullable()
});

export const fafMatchFixtureSchema = z.object({
  fafMatchId: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[A-Za-z0-9\-_]+$/),
  competitionName: z.string().trim().min(2).max(120),
  seasonLabel: z.string().trim().min(4).max(20),
  category: z.string().trim().min(2).max(20),
  homeTeamName: z.string().trim().min(2).max(120),
  awayTeamName: z.string().trim().min(2).max(120),
  matchDate: z
    .string()
    .trim()
    .refine((val) => !isNaN(new Date(val).getTime()), "Invalid match date timestamp"),
  stadium: z.string().trim().max(120).optional().nullable(),
  status: z.enum(["SCHEDULED", "FINISHED", "POSTPONED", "CANCELLED"]).default("SCHEDULED"),
  homeScore: z.number().int().min(0).max(50).optional().nullable(),
  awayScore: z.number().int().min(0).max(50).optional().nullable(),
  refereeName: z.string().trim().max(100).optional().nullable()
});

export const fafMatchSheetSchema = z.object({
  fafMatchId: z.string().trim().min(2).max(64),
  isHomologated: z.boolean().default(false),
  starters: z.array(
    z.object({
      licenceNumber: z.string().trim().min(3),
      shirtNumber: z.number().int().min(1).max(99),
      isCaptain: z.boolean().optional()
    })
  ),
  substitutes: z.array(
    z.object({
      licenceNumber: z.string().trim().min(3),
      shirtNumber: z.number().int().min(1).max(99)
    })
  ),
  goals: z.array(
    z.object({
      licenceNumber: z.string().trim().min(3),
      minute: z.number().int().min(0).max(130),
      isOwnGoal: z.boolean().optional()
    })
  ),
  yellowCards: z.array(
    z.object({
      licenceNumber: z.string().trim().min(3),
      minute: z.number().int().min(0).max(130),
      reason: z.string().max(200).optional()
    })
  ),
  redCards: z.array(
    z.object({
      licenceNumber: z.string().trim().min(3),
      minute: z.number().int().min(0).max(130),
      reason: z.string().max(200).optional()
    })
  ),
  substitutions: z.array(
    z.object({
      playerInLicence: z.string().trim().min(3),
      playerOutLicence: z.string().trim().min(3),
      minute: z.number().int().min(0).max(130)
    })
  )
});
