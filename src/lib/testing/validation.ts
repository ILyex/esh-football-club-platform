import { z } from "zod";

export const CreateSessionSchema = z.object({
  testDefinitionId: z.string().min(1, "Test protocol is required"),
  teamId: z.string().min(1, "Team is required"),
  title: z.string().min(2, "Session title is required").max(120),
  date: z.coerce.date(),
  location: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const RawMeasurementSchema = z.object({
  key: z.string().min(1).max(50),
  value: z.string().min(1).max(100),
  numericValue: z.number().optional().nullable(),
  unit: z.string().max(20).optional().nullable(),
  attempt: z.number().int().min(1).max(10).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export const PlayerMeasurementEntrySchema = z.object({
  playerId: z.string().min(1),
  status: z.enum(["VALID", "INCOMPLETE", "DISQUALIFIED", "ABSENT"]).default("VALID"),
  measurements: z.array(RawMeasurementSchema).default([]),
  notes: z.string().max(500).optional().nullable(),
});

export const SaveSessionMeasurementsSchema = z.object({
  sessionId: z.string().min(1),
  entries: z.array(PlayerMeasurementEntrySchema).superRefine((entries, ctx) => {
    const seen = new Set<string>();
    entries.forEach((entry, index) => {
      if (seen.has(entry.playerId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [index, "playerId"], message: "A player may only appear once in a session save." });
      }
      seen.add(entry.playerId);
    });
  }),
});

export const CorrectResultSchema = z.object({
  resultId: z.string().min(1),
  correctionReason: z.string().min(5, "A descriptive correction reason is required (at least 5 characters)"),
  status: z.enum(["VALID", "INCOMPLETE", "DISQUALIFIED", "ABSENT"]).default("VALID"),
  measurements: z.array(RawMeasurementSchema),
  notes: z.string().max(500).optional().nullable(),
});

export const CreateDefinitionSchema = z.object({
  code: z.string().min(2).max(50).regex(/^[A-Z0-9_]+$/, "Code must be uppercase alphanumeric with underscores"),
  name: z.string().min(2).max(100),
  category: z.enum(["ENDURANCE", "SPEED", "AGILITY", "POWER", "STRENGTH", "FLEXIBILITY", "OTHER"]).default("ENDURANCE"),
  description: z.string().max(500).optional().nullable(),
  primaryUnit: z.string().min(1).max(20),
  secondaryUnit: z.string().max(20).optional().nullable(),
  direction: z.enum(["HIGHER_IS_BETTER", "LOWER_IS_BETTER", "NEUTRAL"]).default("HIGHER_IS_BETTER"),
  calculationStrategy: z.string().min(1).max(50),
  defaultRetestDays: z.number().int().min(1).max(365).optional().default(42),
  instructions: z.string().max(2000).optional().nullable(),
  active: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
});
