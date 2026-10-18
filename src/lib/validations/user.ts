import { z } from "zod";
import { formBoolean } from "@/lib/validations/form-values";

export const createUserSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(254),
  password: z.string().min(8).max(72).refine((value) => new TextEncoder().encode(value).length <= 72),
  roleId: z.string().min(1),
  licenseNumber: z.string().trim().max(80).optional()
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  roleId: z.string().min(1),
  licenseNumber: z.string().trim().max(80).optional(),
  isActive: formBoolean(true)
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({
  password: z.string().min(8).max(72).refine((value) => new TextEncoder().encode(value).length <= 72)
});
