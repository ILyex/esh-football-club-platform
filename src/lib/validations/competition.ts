import { z } from "zod";

export const competitionSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(["LEAGUE", "CUP"]).default("LEAGUE"),
  logoUrl: z.string().optional().nullable(),
  organization: z.string().max(120).optional().nullable(),
  seasonId: z.string().min(1),
  teamId: z.string().optional().nullable(),
  status: z.enum(["UPCOMING", "ONGOING", "FINISHED"]).default("UPCOMING")
});
export type CompetitionInput = z.infer<typeof competitionSchema>;

