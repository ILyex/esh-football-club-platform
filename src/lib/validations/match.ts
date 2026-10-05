import { z } from "zod";

// The form collects a single "opponent" name + an isHomeFixture toggle; the
// server action resolves homeTeamName/awayTeamName against the club's own
// name from ClubSettings (spec section 60 — never hardcode the club's
// identity in application code).
export const matchSchema = z.object({
  competitionId: z.string().min(1),
  teamId: z.string().min(1),
  opponent: z.string().min(1).max(120),
  isHomeFixture: z.coerce.boolean().default(true),
  matchDate: z.coerce.date(),
  stadium: z.string().max(160).optional(),
  refereeName: z.string().max(120).optional(),
  status: z.enum(["SCHEDULED", "LIVE", "FINISHED", "POSTPONED", "CANCELLED"]).default("SCHEDULED"),
  // An empty string from an unfilled number input must become "no score
  // yet" (undefined), not coerce to 0 — z.coerce.number() alone would turn
  // "" into 0 silently, which is wrong for a match that hasn't been played.
  homeScore: z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.coerce.number().int().min(0).max(99).optional()),
  awayScore: z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.coerce.number().int().min(0).max(99).optional()),
  matchReport: z.string().max(10000).optional()
});
export type MatchInput = z.infer<typeof matchSchema>;

export const matchEventSchema = z.object({
  playerId: z.string().optional().or(z.literal("")),
  type: z.enum(["GOAL", "OWN_GOAL", "ASSIST", "YELLOW_CARD", "RED_CARD", "SUBSTITUTION_IN", "SUBSTITUTION_OUT"]),
  minute: z.coerce.number().int().min(0).max(130),
  notes: z.string().max(500).optional()
});
export type MatchEventInput = z.infer<typeof matchEventSchema>;

export const matchLineupEntrySchema = z.object({
  playerId: z.string().min(1),
  isStarting: z.coerce.boolean().default(true),
  position: z.string().max(40).optional()
});
export type MatchLineupEntryInput = z.infer<typeof matchLineupEntrySchema>;
