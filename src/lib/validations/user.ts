import { z } from "zod";
import { formBoolean } from "@/lib/validations/form-values";

const optionalProfileText = (max: number) => z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().max(max).optional()
);
const optionalBirthDate = z.preprocess(
  (value) => value === "" ? undefined : value,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
);
const optionalBloodGroup = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional()
);

export const createUserSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(254),
  password: z.string().min(8).max(72).refine((value) => new TextEncoder().encode(value).length <= 72),
  roleId: z.string().min(1),
  licenseNumber: optionalProfileText(80),
  licenseRole: optionalProfileText(120),
  firstName: optionalProfileText(100),
  lastName: optionalProfileText(100),
  dateOfBirth: optionalBirthDate,
  bloodGroup: optionalBloodGroup
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  roleId: z.string().min(1),
  licenseNumber: optionalProfileText(80),
  licenseRole: optionalProfileText(120),
  firstName: optionalProfileText(100),
  lastName: optionalProfileText(100),
  dateOfBirth: optionalBirthDate,
  bloodGroup: optionalBloodGroup,
  isActive: formBoolean(true)
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({
  password: z.string().min(8).max(72).refine((value) => new TextEncoder().encode(value).length <= 72)
});
