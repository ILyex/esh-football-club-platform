import { z } from "zod";

export const seasonSchema = z
  .object({
    label: z.string().min(1).max(20),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    isCurrent: z.coerce.boolean().default(false)
  })
  .refine((d) => d.endDate > d.startDate, { message: "endBeforeStart", path: ["endDate"] });
export type SeasonInput = z.infer<typeof seasonSchema>;
