import { z } from "zod";

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(160),
  type: z.enum(["MATCH_REPORT", "MEETING_MINUTES", "CORRESPONDENCE", "ANNOUNCEMENT", "PLAYER_REPORT", "TRAINING_REPORT", "ADMINISTRATIVE_REPORT", "EXPENSE_STATEMENT", "DEPOSIT_RECEIPT", "WITHDRAWAL_RECEIPT", "OTHER"]),
  language: z.enum(["ar", "fr"])
});
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const fieldMappingSchema = z.object({
  placeholder: z.string().min(1),
  label: z.string().min(1).max(160),
  sourceType: z.enum(["DATABASE_FIELD", "MANUAL_INPUT", "AI_ASSISTED"]),
  sourcePath: z.string().max(160).optional().or(z.literal(""))
});
export type FieldMappingInput = z.infer<typeof fieldMappingSchema>;
