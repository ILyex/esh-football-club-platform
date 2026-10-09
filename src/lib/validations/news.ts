import { z } from "zod";

const arabicScriptPattern = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/u;
const frenchText = (max: number) =>
  z.string().min(1).max(max).refine((value) => !arabicScriptPattern.test(value), {
    message: "Le texte français ne peut pas contenir de caractères arabes."
  });

export const newsSchema = z.object({
  titleAr: z.string().min(1).max(200),
  contentAr: z.string().min(1).max(20000),
  titleFr: frenchText(200),
  contentFr: frenchText(20000),
  category: z.string().max(80).optional(),
  tags: z.string().max(300).optional(), // comma-separated in the form, split in the action
  status: z.enum(["DRAFT", "PUBLISHED", "SCHEDULED", "ARCHIVED"]).default("PUBLISHED"),
  scheduledFor: z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.coerce.date().optional())
});
export type NewsInput = z.infer<typeof newsSchema>;
