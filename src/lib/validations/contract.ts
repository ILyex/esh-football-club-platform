import { z } from "zod";

// A contract belongs to exactly one subject — a Player OR a Staff member,
// never both, never neither. The Prisma schema itself allows both FKs to be
// null/set independently (spec section 15's Contract model doesn't encode an
// XOR constraint at the DB level), so the exclusivity is enforced here, in
// the one place every Contract mutation passes through.
export const contractSchema = z
  .object({
    type: z.enum(["PROFESSIONAL", "AMATEUR", "LOAN", "STAFF"]),
    playerId: z.string().optional().or(z.literal("")),
    staffId: z.string().optional().or(z.literal("")),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    status: z.enum(["ACTIVE", "EXPIRING_SOON", "EXPIRED", "PENDING"]).default("PENDING"),
    notes: z.string().max(5000).optional()
  })
  .refine((data) => Boolean(data.playerId) !== Boolean(data.staffId), {
    message: "subjectRequired",
    path: ["playerId"]
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "endBeforeStart",
    path: ["endDate"]
  });
export type ContractInput = z.infer<typeof contractSchema>;
