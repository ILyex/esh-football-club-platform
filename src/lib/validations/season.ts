import { z } from "zod";
import { formBoolean } from "@/lib/validations/form-values";

export const seasonSchema = z
  .object({
    label: z.string().trim().regex(/^\d{4}\/\d{4}$/, "seasonLabel"),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    isCurrent: formBoolean(false)
  })
  .refine((d) => {
    const [rawStartYear, rawEndYear] = d.label.split("/");
    const startYear = Number(rawStartYear);
    const endYear = Number(rawEndYear);
    return endYear === startYear + 1;
  }, { message: "seasonYearsMustBeConsecutive", path: ["label"] })
  .refine((d) => {
    const [rawStartYear, rawEndYear] = d.label.split("/");
    const startYear = Number(rawStartYear);
    const endYear = Number(rawEndYear);
    return d.startDate.getUTCFullYear() === startYear && d.endDate.getUTCFullYear() === endYear;
  }, { message: "seasonDatesMustMatchLabel", path: ["startDate"] })
  .refine((d) => d.endDate > d.startDate, { message: "endBeforeStart", path: ["endDate"] });
export type SeasonInput = z.infer<typeof seasonSchema>;
