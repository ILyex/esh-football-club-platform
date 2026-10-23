import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email().max(254),
  // bcrypt only considers the first 72 bytes; reject longer UTF-8 values so
  // two distinct passwords can never authenticate as the same byte prefix.
  password: z.string().min(8).max(72).refine((value) => new TextEncoder().encode(value).length <= 72)
});
export type LoginInput = z.infer<typeof loginSchema>;

const passwordSchema = z.string().min(8).max(72)
  .refine((value) => new TextEncoder().encode(value).length <= 72);

export const changePasswordSchema = z.object({
  currentPassword: passwordSchema,
  newPassword: passwordSchema,
  confirmPassword: passwordSchema
}).superRefine((value, context) => {
  if (value.newPassword !== value.confirmPassword) {
    context.addIssue({ code: "custom", path: ["confirmPassword"], message: "password_mismatch" });
  }
  if (value.currentPassword === value.newPassword) {
    context.addIssue({ code: "custom", path: ["newPassword"], message: "password_unchanged" });
  }
});
