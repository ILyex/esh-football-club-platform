import "server-only";

// ============================================================================
// PHASE 10B — FIELD-LEVEL DATA AUTHORITY MATRIX
// ----------------------------------------------------------------------------
// Defines ownership rules for every synchronized attribute.
// Blanket overwrites are strictly prohibited. ESH-local operational data
// (contracts, tactical notes, finances) are immune to external modification.
// ============================================================================

export type AuthorityClassification =
  | "FAF_AUTHORITATIVE"
  | "ESH_AUTHORITATIVE"
  | "INITIAL_SEED_ONLY"
  | "NEVER_SYNCHRONIZE";

export const PLAYER_AUTHORITY_RULES: Record<string, AuthorityClassification> = {
  // Official federation registration attributes
  licenceNumber: "FAF_AUTHORITATIVE",
  status: "FAF_AUTHORITATIVE",
  medicalClearanceDate: "FAF_AUTHORITATIVE",
  registrationDate: "FAF_AUTHORITATIVE",

  // Demographic / Identity attributes (seed on creation, do not blindly overwrite)
  firstName: "INITIAL_SEED_ONLY",
  lastName: "INITIAL_SEED_ONLY",
  dateOfBirth: "INITIAL_SEED_ONLY",
  nationality: "INITIAL_SEED_ONLY",
  shirtNumber: "INITIAL_SEED_ONLY",
  position: "INITIAL_SEED_ONLY",

  // ESH local operational data (IMMUNE TO EXTERNAL OVERWRITE)
  internalNotes: "ESH_AUTHORITATIVE",
  contracts: "ESH_AUTHORITATIVE",
  salary: "ESH_AUTHORITATIVE",
  tacticalRating: "ESH_AUTHORITATIVE",
  trainingAttendance: "ESH_AUTHORITATIVE",
  height: "ESH_AUTHORITATIVE",
  preferredFoot: "ESH_AUTHORITATIVE"
};

export const STAFF_AUTHORITY_RULES: Record<string, AuthorityClassification> = {
  licenceNumber: "FAF_AUTHORITATIVE",
  qualificationLevel: "FAF_AUTHORITATIVE",
  status: "FAF_AUTHORITATIVE",

  firstName: "INITIAL_SEED_ONLY",
  lastName: "INITIAL_SEED_ONLY",
  role: "INITIAL_SEED_ONLY",

  // ESH operational data
  internalContact: "ESH_AUTHORITATIVE",
  teamAssignments: "ESH_AUTHORITATIVE",
  userLink: "ESH_AUTHORITATIVE"
};

export const MATCH_AUTHORITY_RULES: Record<string, AuthorityClassification> = {
  // Official competition data
  matchDate: "FAF_AUTHORITATIVE",
  stadium: "FAF_AUTHORITATIVE",
  refereeName: "FAF_AUTHORITATIVE",
  homeScore: "FAF_AUTHORITATIVE",
  awayScore: "FAF_AUTHORITATIVE",
  status: "FAF_AUTHORITATIVE",
  officialEvents: "FAF_AUTHORITATIVE",

  // ESH local operations
  matchReport: "ESH_AUTHORITATIVE",
  tacticalNotes: "ESH_AUTHORITATIVE",
  internalLogistics: "ESH_AUTHORITATIVE",
  expenses: "ESH_AUTHORITATIVE"
};

/**
 * Predicate checking whether a field should be updated from FAF when
 * the record already exists in ESH.
 */
export function shouldUpdateFieldFromFAF(
  domain: "Player" | "Staff" | "Match",
  fieldName: string
): boolean {
  let rule: AuthorityClassification | undefined;
  if (domain === "Player") rule = PLAYER_AUTHORITY_RULES[fieldName];
  else if (domain === "Staff") rule = STAFF_AUTHORITY_RULES[fieldName];
  else if (domain === "Match") rule = MATCH_AUTHORITY_RULES[fieldName];

  return rule === "FAF_AUTHORITATIVE";
}
