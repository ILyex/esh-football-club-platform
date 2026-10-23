import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";

const STAFF_CARD_ROLE: Record<string, string> = {
  HEAD_COACH: "Entraîneur",
  ASSISTANT_COACH: "Entraîneur adjoint",
  GOALKEEPING_COACH: "Entraîneur des gardiens",
  FITNESS_COACH: "Préparateur physique",
  MEDICAL_STAFF: "Personnel médical",
  ADMINISTRATIVE_STAFF: "Personnel administratif",
  OTHER: "Staff"
};
const STAFF_CARD_CATEGORY: Record<string, string> = { SENIOR: "Seniors", U20: "U20", U17: "U17", U15: "U15" };
const staffCardTitle = (role: string, category?: string | null) =>
  `${STAFF_CARD_ROLE[role] ?? "Staff"}${category && STAFF_CARD_CATEGORY[category] ? ` — ${STAFF_CARD_CATEGORY[category]}` : ""}`;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const [staffMembers, viewerRole] = await Promise.all([
    db.staff.findMany({
      include: {
        user: true,
        teamAssignments: { select: { teamId: true, createdAt: true }, orderBy: { createdAt: "asc" } },
        team: { select: { category: true } }
      },
      orderBy: { createdAt: "asc" }
    }),
    db.role.findUnique({
      where: { key: "viewer" },
      select: { id: true }
    })
  ]);
  if (!viewerRole) throw new Error("Viewer role is required before staff account backfill.");

  let created = 0;
  let updated = 0;
  for (const staff of staffMembers) {
    const teamId = staff.teamId ?? staff.teamAssignments[0]?.teamId ?? null;
    const name = [staff.firstNameFr, staff.lastNameFr].filter(Boolean).join(" ") || `${staff.firstName} ${staff.lastName}`;
    if (staff.user) {
      await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: staff.user!.id },
          data: {
            name,
            firstName: staff.firstName,
            lastName: staff.lastName,
            dateOfBirth: staff.dateOfBirth,
            bloodGroup: staff.bloodGroup,
            licenseNumber: staff.licenceNumber,
            licenseRole: staffCardTitle(staff.role, staff.team?.category),
            image: staff.photoUrl,
            ...(staff.accountRoleId ? { roleId: staff.accountRoleId } : {})
          }
        });
        await tx.staffTeam.deleteMany({ where: { staffId: staff.id } });
        await tx.userTeam.deleteMany({ where: { userId: staff.user!.id } });
        if (teamId) {
          await tx.staffTeam.create({ data: { staffId: staff.id, teamId } });
          await tx.userTeam.create({ data: { userId: staff.user!.id, teamId } });
          await tx.staff.update({ where: { id: staff.id }, data: { teamId } });
        }
      });
      updated++;
      continue;
    }

    const email = `${staff.id}@staff.esh.invalid`;
    const existingEmail = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existingEmail) throw new Error(`Generated staff email already belongs to a different user: ${email}`);
    const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          firstName: staff.firstName,
          lastName: staff.lastName,
          dateOfBirth: staff.dateOfBirth,
          bloodGroup: staff.bloodGroup,
          licenseNumber: staff.licenceNumber,
          licenseRole: staffCardTitle(staff.role, staff.team?.category),
          image: staff.photoUrl,
          email,
          passwordHash,
          roleId: staff.accountRoleId ?? viewerRole.id,
          isActive: false
        },
        select: { id: true }
      });
      await tx.staff.update({
        where: { id: staff.id },
        data: { userId: user.id, accountRoleId: staff.accountRoleId ?? viewerRole.id }
      });
      if (teamId) {
        await tx.userTeam.create({ data: { userId: user.id, teamId } });
        await tx.staffTeam.deleteMany({ where: { staffId: staff.id } });
        await tx.staffTeam.create({ data: { staffId: staff.id, teamId } });
        await tx.staff.update({ where: { id: staff.id }, data: { teamId } });
      }
    });
    created++;
  }
  console.log(`Staff account backfill complete: ${created} created, ${updated} synchronized.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await (db as any).$disconnect?.();
  });
