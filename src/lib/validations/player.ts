import { z } from "zod";

export const playerSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  firstNameFr: z.preprocess((val) => (val === "" || val === null || val === undefined ? undefined : String(val).trim()),
    z.string().max(80).optional()),
  lastNameFr: z.preprocess((val) => (val === "" || val === null || val === undefined ? undefined : String(val).trim()),
    z.string().max(80).optional()),
  position: z.enum(["GOALKEEPER", "DEFENDER", "MIDFIELDER", "FORWARD"]),
  nationality: z.string().min(1).max(80),
  dateOfBirth: z.coerce.date(),
  // Player.teamId is nullable in PostgreSQL. Keep the form contract aligned
  // so existing club-wide players can be edited without inventing a team.
  teamId: z.preprocess(
    (val) => (val === "" || val === undefined ? null : String(val)),
    z.string().nullable()
  ),
  // Numeric fields may be empty strings from HTML forms; treat "" as undefined before validation
  shirtNumber: z.preprocess((val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
    z.number().int().min(1).max(99).optional()),
  height: z.preprocess((val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
    z.number().int().min(120).max(230).optional()),
  weight: z.preprocess((val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
    z.number().min(30).max(200).optional()),
  previousTeam: z.preprocess((val) => (val === "" || val === null || val === undefined ? undefined : String(val).trim()),
    z.string().max(120).optional()),
  placeOfBirth: z.preprocess((val) => (val === "" || val === null || val === undefined ? undefined : String(val).trim()),
    z.string().max(120).optional()),
  bloodGroup: z.preprocess((val) => (val === "" || val === null || val === undefined ? undefined : String(val)),
    z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional()),
  birthCertificateNumber: z.preprocess((val) => (val === "" || val === null || val === undefined ? undefined : String(val).trim()),
    z.string().max(80).optional()),
  licenceNumber: z.preprocess((val) => (val === "" || val === null || val === undefined ? undefined : String(val).trim()),
    z.string().max(80).optional()),
  preferredFoot: z.preprocess((val) => (val === "" || val === null || val === undefined ? undefined : val),
    z.enum(["LEFT", "RIGHT", "BOTH"]).optional()),
  joiningDate: z.preprocess((val) => (val === "" || val === null || val === undefined ? undefined : val),
    z.coerce.date().optional()),
  status: z.enum(["ACTIVE", "INJURED", "SUSPENDED", "ON_LOAN", "ARCHIVED"]).default("ACTIVE"),
  biographyAr: z.preprocess((val) => (val === "" || val === null || val === undefined ? undefined : String(val)),
    z.string().max(5000).optional()),
  biographyFr: z.preprocess((val) => (val === "" || val === null || val === undefined ? undefined : String(val)),
    z.string().max(5000).optional()),
  internalNotes: z.preprocess((val) => (val === "" || val === null || val === undefined ? undefined : String(val)),
    z.string().max(5000).optional())
});
export type PlayerInput = z.infer<typeof playerSchema>;
