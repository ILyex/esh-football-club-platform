import { z } from "zod";

export const newsSchema = z.object({
  titleAr: z.string().min(1).max(200),
  contentAr: z.string().min(1).max(20000),
  titleFr: z.string().min(1).max(200),
  contentFr: z.string().min(1).max(20000),
  category: z.string().max(80).optional(),
  tags: z.string().max(300).optional(), // comma-separated in the form, split in the action
  status: z.enum(["DRAFT", "PUBLISHED", "SCHEDULED", "ARCHIVED"]).default("DRAFT"),
  scheduledFor: z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.coerce.date().optional())
});
export type NewsInput = z.infer<typeof newsSchema>;
