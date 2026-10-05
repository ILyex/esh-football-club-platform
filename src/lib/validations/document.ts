import { z } from "zod";

const optionalCuid = () => z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.string().cuid().optional());

export const documentMetadataSchema = z.object({
  name: z.string().min(1).max(200),
  categoryId: z.string().cuid(),
  description: z.string().max(2000).optional(),
  documentDate: z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.coerce.date().optional()),
  classification: z.enum(["PUBLIC", "INTERNAL", "RESTRICTED"]).default("INTERNAL"),
  department: z.string().max(120).optional(),
  teamId: optionalCuid(),
  relatedPlayerId: optionalCuid(),
  relatedStaffId: optionalCuid(),
  relatedMatchId: optionalCuid()
});
export type DocumentMetadataInput = z.infer<typeof documentMetadataSchema>;
