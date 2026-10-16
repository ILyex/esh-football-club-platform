import { z } from "zod";

export const inventoryItemSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  category: z.enum([
    "BALLS",
    "KITS",
    "CONES_MARKERS",
    "GOALKEEPING",
    "MEDICAL",
    "TRAINING_AIDS",
    "ELECTRONICS",
    "OTHER"
  ]).default("OTHER"),
  quantity: z.coerce.number().int().min(0).default(1),
  condition: z.enum(["NEW", "GOOD", "FAIR", "OLD", "POOR", "DAMAGED", "UNSPECIFIED"]).default("GOOD"),
  location: z.string().max(200).optional().or(z.literal("")),
  teamId: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal(""))
});

export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;
