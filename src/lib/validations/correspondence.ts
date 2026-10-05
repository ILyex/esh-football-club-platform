import { z } from "zod";

export const correspondenceSchema = z.object({
  referenceNumber: z.string().min(1).max(60),
  subject: z.string().min(1).max(300),
  sender: z.string().min(1).max(160),
  recipient: z.string().min(1).max(160),
  date: z.coerce.date(),
  type: z.enum(["INCOMING", "OUTGOING"]),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  status: z.enum(["NEW", "IN_PROGRESS", "COMPLETED", "ARCHIVED"]).default("NEW"),
  teamId: z.string().optional().or(z.literal("")),
  relatedPlayerId: z.string().optional().or(z.literal("")),
  relatedStaffId: z.string().optional().or(z.literal("")),
  relatedMatchId: z.string().optional().or(z.literal("")),
  notes: z.string().max(5000).optional()
});
export type CorrespondenceInput = z.infer<typeof correspondenceSchema>;
