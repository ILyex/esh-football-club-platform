import { z } from "zod";

export const staffSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  dateOfBirth: z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) return null;
    const date = new Date(`${String(value)}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? value : date;
  }, z.date().nullable().optional()),
  bloodGroup: z.preprocess((value) => value === "" || value === null || value === undefined ? null : String(value), z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).nullable().optional()),
  firstNameFr: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : String(v).trim()), z.string().max(80).nullable().optional()),
  lastNameFr: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : String(v).trim()), z.string().max(80).nullable().optional()),
  licenceNumber: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : String(v).trim()), z.string().max(80).nullable().optional()),
  role: z.enum([
    "HEAD_COACH",
    "ASSISTANT_COACH",
    "GOALKEEPING_COACH",
    "FITNESS_COACH",
    "MEDICAL_STAFF",
    "ADMINISTRATIVE_STAFF",
    "OTHER"
  ]),
  // A staff member has one operational category. RBAC account roles remain
  // separate because they control permissions, not the person's profession.
  teamId: z.preprocess((value) => value === "" || value === null || value === undefined ? null : String(value), z.string().max(100).nullable().optional()),
  accountRoleId: z.preprocess((value) => value === "" || value === null || value === undefined ? undefined : String(value), z.string().max(100).optional()),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
  biography: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.string().max(5000).nullable().optional()),
  photoUrl: z.string().optional(),
  // Internal contact info (phone/email) is never exposed on the public site —
  // spec section 10: "المعلومات الحساسة لا تظهر في الموقع العام".
  internalContact: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.string().max(255).nullable().optional())
});
export type StaffInput = z.infer<typeof staffSchema>;
