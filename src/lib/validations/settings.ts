import { z } from "zod";

export const clubSettingsSchema = z.object({
  name: z.string().min(1).max(160),
  shortName: z.string().min(1).max(40),
  description: z.string().max(2000).optional(),
  stadium: z.string().max(160).optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().max(40).optional(),
  address: z.string().max(300).optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#B31B1B"),
  secondaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#111111"),
  defaultLocale: z.enum(["ar", "fr"]).default("ar"),
  facebookUrl: z.string().url().max(300).optional().or(z.literal("")),
  instagramUrl: z.string().url().max(300).optional().or(z.literal("")),
  websiteUrl: z.string().url().max(300).optional().or(z.literal(""))
});
export type ClubSettingsInput = z.infer<typeof clubSettingsSchema>;
