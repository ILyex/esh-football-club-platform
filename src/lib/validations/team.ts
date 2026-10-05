import { z } from "zod";

export const teamSchema = z
  .object({
    name: z.string().min(1).max(160),
    shortName: z.string().max(40).optional(),
    birthYearFrom: z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.coerce.number().int().min(1980).max(2100).optional()),
    birthYearTo: z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.coerce.number().int().min(1980).max(2100).optional()),
    description: z.string().max(2000).optional(),
    active: z.coerce.boolean().default(true)
  })
  .refine((d) => !d.birthYearFrom || !d.birthYearTo || d.birthYearTo >= d.birthYearFrom, {
    message: "birthYearRangeInvalid",
    path: ["birthYearTo"]
  });
export type TeamInput = z.infer<typeof teamSchema>;
