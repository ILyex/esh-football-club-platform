import { z } from "zod";

export const trainingSessionSchema = z.object({
  date: z.coerce.date(),
  teamId: z.string().min(1),
  // Plain "HH:MM" from a <input type="time">, combined with `date` in the
  // server action — z.coerce.date() can't parse a bare time string on its
  // own, so we validate the format here instead.
  startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  location: z.string().max(160).optional(),
  coachId: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional(),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]).default("SCHEDULED")
}).superRefine((value, ctx) => {
  // Sessions are represented within one calendar day; reject an end time
  // that is equal to or earlier than the start instead of storing an
  // impossible duration (overnight sessions need an explicit next-day model).
  if (value.endTime <= value.startTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endTime"],
      message: "END_TIME_MUST_FOLLOW_START_TIME"
    });
  }
});
export type TrainingSessionInput = z.infer<typeof trainingSessionSchema>;

export const attendanceSchema = z.object({
  playerId: z.string().min(1),
  status: z.enum(["PRESENT", "ABSENT", "INJURED", "EXCUSED"]).default("PRESENT")
});
export type AttendanceInput = z.infer<typeof attendanceSchema>;

export const bulkAttendanceSchema = z.object({
  attendances: z.array(
    z.object({
      playerId: z.string().min(1),
      status: z.enum(["PRESENT", "ABSENT", "INJURED", "EXCUSED"])
    })
  )
});
export type BulkAttendanceInput = z.infer<typeof bulkAttendanceSchema>;

