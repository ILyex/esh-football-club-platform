import { z } from "zod";
import { formBoolean } from "@/lib/validations/form-values";

const addedTimeMinutes = z.preprocess(
  (value) => value === "" || value === undefined || value === null ? 0 : value,
  z.coerce.number().int().min(0).max(15).default(0)
);

// The form collects a single "opponent" name + an isHomeFixture toggle; the
// server action resolves homeTeamName/awayTeamName against the club's own
// name from ClubSettings (spec section 60 — never hardcode the club's
// identity in application code).
export const matchSchema = z.object({
  competitionId: z.string().min(1),
  teamId: z.string().min(1),
  opponent: z.string().min(1).max(120),
  opponentNameFr: z.string().max(120).optional(),
  isHomeFixture: formBoolean(true),
  matchDate: z.coerce.date(),
  stadium: z.string().max(160).optional(),
  refereeName: z.string().max(480).optional().refine((value) => !value || value.split(/[,،]/).map((name) => name.trim()).filter(Boolean).length <= 3, "A maximum of three referee names is allowed"),
  refereeNameAr: z.string().max(480).optional().refine((value) => !value || value.split(/[,،]/).map((name) => name.trim()).filter(Boolean).length <= 3, "A maximum of three referee names is allowed"),
  refereeNameFr: z.string().max(480).optional().refine((value) => !value || value.split(/[,،]/).map((name) => name.trim()).filter(Boolean).length <= 3, "A maximum of three referee names is allowed"),
  status: z.enum(["SCHEDULED", "LIVE", "FINISHED", "POSTPONED", "CANCELLED"]).default("SCHEDULED"),
  hasExtraTime: formBoolean(false),
  hasPenaltyShootout: formBoolean(false),
  firstHalfAddedTime: addedTimeMinutes,
  secondHalfAddedTime: addedTimeMinutes,
  extraTimeFirstHalfAddedTime: addedTimeMinutes,
  extraTimeSecondHalfAddedTime: addedTimeMinutes,
  // An empty string from an unfilled number input must become "no score
  // yet" (undefined), not coerce to 0 — z.coerce.number() alone would turn
  // "" into 0 silently, which is wrong for a match that hasn't been played.
  homeScore: z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.coerce.number().int().min(0).max(99).optional()),
  awayScore: z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.coerce.number().int().min(0).max(99).optional()),
  matchReport: z.string().max(10000).optional()
}).superRefine((value, ctx) => {
  if (value.hasPenaltyShootout && !value.hasExtraTime) {
    ctx.addIssue({ code: "custom", path: ["hasPenaltyShootout"], message: "Penalty shootout requires extra time to be enabled" });
  }
});
export type MatchInput = z.infer<typeof matchSchema>;

export const matchEventSchema = z.object({
  playerId: z.string().optional().or(z.literal("")),
  outPlayerId: z.string().optional().or(z.literal("")),
  outPlayerName: z.string().trim().max(120).optional(),
  outPlayerNameFr: z.string().trim().max(120).optional(),
  playerName: z.string().trim().max(120).optional(),
  playerNameFr: z.string().trim().max(120).optional(),
  staffId: z.string().optional().or(z.literal("")),
  entityType: z.enum(["PLAYER", "STAFF"]).default("PLAYER"),
  side: z.enum(["HOME", "AWAY"]).default("HOME"),
  type: z.enum(["GOAL", "SHOT", "PENALTY_GOAL", "PENALTY_MISSED", "OWN_GOAL", "ASSIST", "YELLOW_CARD", "RED_CARD", "SUBSTITUTION_IN", "SUBSTITUTION_OUT"]),
  minute: z.coerce.number().int().min(0).max(130),
  notes: z.string().max(500).optional(),
  assistPlayerId: z.string().optional().or(z.literal("")),
  shotDetailsRequired: formBoolean(false),
  bodyPart: z.enum(["RIGHT_FOOT", "LEFT_FOOT", "HEAD", "OTHER", "UNKNOWN"]).optional(),
  shotSituation: z.enum(["OPEN_PLAY", "PENALTY", "FREE_KICK", "CORNER", "OTHER"]).optional(),
  shotOutcome: z.enum(["SAVED", "OFF_TARGET", "BLOCKED", "WOODWORK"]).optional(),
  shotX: z.preprocess((value) => value === "" || value === undefined || value === null ? undefined : value, z.coerce.number().min(0).max(100).optional()),
  shotY: z.preprocess((value) => value === "" || value === undefined || value === null ? undefined : value, z.coerce.number().min(0).max(100).optional())
}).superRefine((value, ctx) => {
  if (value.type === "YELLOW_CARD" || value.type === "RED_CARD" || value.type === "GOAL" || value.type === "SHOT" || value.type === "PENALTY_GOAL" || value.type === "PENALTY_MISSED" || value.type === "OWN_GOAL" || value.type === "ASSIST") {
    if (value.entityType === "STAFF" && !value.staffId && !value.playerName && !value.playerNameFr) ctx.addIssue({ code: "custom", path: ["staffId"], message: "Staff member is required" });
    if (value.entityType === "PLAYER" && !value.playerId && !value.playerName && !value.playerNameFr) {
      ctx.addIssue({ code: "custom", path: ["playerName"], message: "Player is required" });
    }
  }
  if ((value.shotX === undefined) !== (value.shotY === undefined)) {
    ctx.addIssue({ code: "custom", path: ["shotY"], message: "Shot location must include both coordinates" });
  }
  if (value.type === "SHOT" && !value.shotOutcome) {
    ctx.addIssue({ code: "custom", path: ["shotOutcome"], message: "Shot outcome is required" });
  }
  const recordsShot = ["GOAL", "SHOT", "PENALTY_GOAL", "PENALTY_MISSED"].includes(value.type);
  if (value.shotDetailsRequired && recordsShot && !value.bodyPart) {
    ctx.addIssue({ code: "custom", path: ["bodyPart"], message: "Shot body part is required" });
  }
  if (value.shotDetailsRequired && (value.type === "GOAL" || value.type === "SHOT") && value.shotX === undefined) {
    ctx.addIssue({ code: "custom", path: ["shotX"], message: "Shot location is required" });
  }
});
export type MatchEventInput = z.infer<typeof matchEventSchema>;

export const matchLineupEntrySchema = z.object({
  playerId: z.string().min(1),
  isCaptain: formBoolean(false),
  isStarting: formBoolean(true),
  selectionStatus: z.enum(["STARTING", "SUBSTITUTE", "INJURED", "SUSPENDED", "NOT_CALLED"]).default("STARTING"),
  position: z.string().max(40).optional()
});
export type MatchLineupEntryInput = z.infer<typeof matchLineupEntrySchema>;

export const matchShootoutKickSchema = z.object({
  side: z.enum(["HOME", "AWAY"]),
  playerId: z.string().optional().or(z.literal("")),
  playerName: z.string().trim().min(1).max(120),
  result: z.enum(["SCORED", "MISSED"])
});
export type MatchShootoutKickInput = z.infer<typeof matchShootoutKickSchema>;
