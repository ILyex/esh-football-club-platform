import { z } from "zod";

// MATCH and TRAINING calendar entries are auto-synced from the Matches and
// Training modules (see their actions.ts) and are never created directly
// here — this form only ever creates the remaining types.
export const calendarEventSchema = z
  .object({
    title: z.string().min(1).max(160),
    type: z.enum(["MEETING", "ADMINISTRATIVE", "OTHER"]),
    startDateTime: z.coerce.date(),
    endDateTime: z.coerce.date(),
    location: z.string().max(160).optional(),
    description: z.string().max(2000).optional()
  })
  .refine((d) => d.endDateTime > d.startDateTime, { message: "endBeforeStart", path: ["endDateTime"] });
export type CalendarEventInput = z.infer<typeof calendarEventSchema>;
