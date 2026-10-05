import { z } from "zod";

export const meetingMinuteSchema = z.object({
  title: z.string().min(1).max(200),
  date: z.coerce.date(),
  location: z.string().max(160).optional(),
  attendees: z.string().max(2000).optional(), // comma-separated in the form, split in the action
  teamId: z.string().optional().or(z.literal("")),
  calendarEventId: z.string().optional().or(z.literal("")),
  agenda: z.string().max(5000).optional(),
  content: z.string().min(1).max(20000),
  decisions: z.string().max(10000).optional(),
  notes: z.string().max(5000).optional(),
  status: z.enum(["DRAFT", "APPROVED", "ARCHIVED"]).default("DRAFT")
});
export type MeetingMinuteInput = z.infer<typeof meetingMinuteSchema>;
