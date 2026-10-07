import { z } from "zod";

export const seasonSchema = z
  .object({
    label: z.string().trim().regex(/^\d{4}\/\d{4}$/, "seasonLabel"),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    isCurrent: z.coerce.boolean().default(false)
  })
  .refine((d) => d.endDate > d.startDate, { message: "endBeforeStart", path: ["endDate"] });
export type SeasonInput = z.infer<typeof seasonSchema>;
