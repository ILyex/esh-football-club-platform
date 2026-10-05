import { z } from "zod";

export const createRoleSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9_]+$/, "keyFormat"), // stable, code-referenced identifier — lowercase snake_case only
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional()
});
export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional()
});
