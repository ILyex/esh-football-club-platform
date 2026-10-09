import { z } from "zod";
import { formBoolean } from "@/lib/validations/form-values";

export const announcementSchema = z
  .object({
    titleAr: z.string().min(1).max(200),
    contentAr: z.string().min(1).max(10000),
    titleFr: z.string().min(1).max(200),
    contentFr: z.string().min(1).max(10000),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
    teamId: z.string().optional().or(z.literal("")), // empty = club-wide (spec section 28)
    startDate: z.coerce.date(),
    endDate: z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.coerce.date().optional()),
    homepageVisibility: formBoolean(true),
    status: z.enum(["DRAFT", "PUBLISHED", "SCHEDULED", "ARCHIVED"]).default("DRAFT")
  })
  .refine((d) => !d.endDate || d.endDate > d.startDate, { message: "endBeforeStart", path: ["endDate"] });
export type AnnouncementInput = z.infer<typeof announcementSchema>;
