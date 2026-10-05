import { z } from "zod";

export const albumSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  category: z.enum(["MATCHES", "TRAINING", "TEAM", "EVENTS", "CLUB"]),
  teamId: z.string().optional().or(z.literal("")),
  published: z.coerce.boolean().default(true)
});
export type AlbumInput = z.infer<typeof albumSchema>;
