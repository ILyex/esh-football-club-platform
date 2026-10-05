import "server-only";

// ============================================================================
// PHASE 10B — FAF CONNECT INTEGRATION TYPES
// ----------------------------------------------------------------------------
// Type definitions for normalized FAF Connect entities, synchronization options,
// conflict reports, and audit statistics.
// ============================================================================

export type FAFSyncStatus = "SUCCESS" | "PARTIAL" | "FAILED" | "AUTH_REQUIRED" | "BLOCKED";

export type FAFSessionStatus =
  | "NOT_CONFIGURED"
  | "AUTHENTICATED"
  | "EXPIRING"
  | "EXPIRED"
  | "REAUTH_REQUIRED"
  | "ACCESS_RESTRICTED"
  | "ERROR";

export interface FAFSessionRecord {
  sessionCookie: string;
  authenticatedAt: string; // ISO string
  lastVerifiedAt: string;  // ISO string
  lastActiveAt: string;    // ISO string
  expiresAt?: string;      // ISO string
  clubId?: string;
  clubCode?: string;
}

export interface FAFSessionDTO {
  status: FAFSessionStatus;
  isConfigured: boolean;
  authenticatedAt: string | null;
  lastVerifiedAt: string | null;
  expiresInMinutes: number | null;
  clubCode: string | null;
  message: string;
}

export interface FAFLicenceData {
  licenceNumber: string;
  nationalId?: string | null;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO date string (YYYY-MM-DD)
  nationality: string;
  category: string; // e.g. "SENIOR", "U20", "U17", "U15"
  status: "VALID" | "SUSPENDED" | "PENDING" | "REJECTED";
  medicalClearanceDate?: string | null;
  registrationDate?: string | null;
  photoUrl?: string | null;
}

export interface FAFStaffLicenceData {
  licenceNumber: string;
  firstName: string;
  lastName: string;
  role: string; // e.g. "HEAD_COACH", "ASSISTANT_COACH", "DOCTOR", "ADMIN"
  qualificationLevel?: string | null;
  status: "VALID" | "SUSPENDED" | "PENDING";
  category?: string | null;
}

export interface FAFMatchFixtureData {
  fafMatchId: string;
  competitionName: string;
  seasonLabel: string;
  category: string;
  homeTeamName: string;
  awayTeamName: string;
  matchDate: string; // ISO date-time
  stadium?: string | null;
  status: "SCHEDULED" | "FINISHED" | "POSTPONED" | "CANCELLED";
  homeScore?: number | null;
  awayScore?: number | null;
  refereeName?: string | null;
}

export interface FAFMatchSheetData {
  fafMatchId: string;
  isHomologated: boolean;
  starters: Array<{ licenceNumber: string; shirtNumber: number; isCaptain?: boolean }>;
  substitutes: Array<{ licenceNumber: string; shirtNumber: number }>;
  goals: Array<{ licenceNumber: string; minute: number; isOwnGoal?: boolean }>;
  yellowCards: Array<{ licenceNumber: string; minute: number; reason?: string }>;
  redCards: Array<{ licenceNumber: string; minute: number; reason?: string }>;
  substitutions: Array<{ playerInLicence: string; playerOutLicence: string; minute: number }>;
}

export interface FAFSyncOptions {
  category?: string;
  seasonLabel?: string;
  dryRun?: boolean;
  forceOverwriteFAFFields?: boolean;
  triggeredById?: string;
}

export interface FAFSyncResult {
  status: FAFSyncStatus;
  startedAt: Date;
  completedAt: Date;
  recordsInspected: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsUnchanged: number;
  conflictsDetected: number;
  errors: string[];
  details: {
    playersProcessed: number;
    staffProcessed: number;
    matchesProcessed: number;
  };
}

export interface FAFConflict {
  entityType: "Player" | "Staff" | "Match";
  identifier: string; // e.g. licence number or match code
  field: string;
  eshValue: any;
  fafValue: any;
  resolution: "PRESERVE_ESH" | "OVERWRITE_WITH_FAF" | "MANUAL_REVIEW_REQUIRED";
  reason: string;
}
