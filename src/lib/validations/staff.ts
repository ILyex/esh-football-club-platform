import { z } from "zod";

export const staffSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  firstNameFr: z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : String(v).trim()), z.string().max(80).optional()),
  lastNameFr: z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : String(v).trim()), z.string().max(80).optional()),
  licenceNumber: z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : String(v).trim()), z.string().max(80).optional()),
  role: z.enum([
    "HEAD_COACH",
    "ASSISTANT_COACH",
    "GOALKEEPING_COACH",
    "FITNESS_COACH",
    "MEDICAL_STAFF",
    "ADMINISTRATIVE_STAFF",
    "OTHER"
  ]),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
  biography: z.string().max(5000).optional(),
  photoUrl: z.string().optional(),
  // Internal contact info (phone/email) is never exposed on the public site —
  // spec section 10: "المعلومات الحساسة لا تظهر في الموقع العام".
  internalContact: z.string().max(255).optional()
});
export type StaffInput = z.infer<typeof staffSchema>;
