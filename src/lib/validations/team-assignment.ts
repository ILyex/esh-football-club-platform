import { z } from "zod";

// ============================================================================
// P2 — Team Assignment Validation
// ----------------------------------------------------------------------------
// Both UserTeam and StaffTeam use exactly the same wire format: a single
// `teamId` field submitted from a <select>. The composite PK on each table
// enforces uniqueness at the database level; we also reject empty teamId at
// the Zod layer so a missing form field never reaches Prisma as an empty
// string.
// ============================================================================

export const teamAssignmentSchema = z.object({
  teamId: z.string().min(1, "teamRequired")
});
export type TeamAssignmentInput = z.infer<typeof teamAssignmentSchema>;
