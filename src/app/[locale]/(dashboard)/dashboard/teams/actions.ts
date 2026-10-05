"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { teamSchema } from "@/lib/validations/team";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

// Teams are fixed, seeded rows (one per TeamCategory — see prisma/seed.ts) —
// there's deliberately no create/delete action here, only editing the four
// canonical categories' display name, birth-year range, description and
// active flag.
export async function updateTeamAction(teamId: string, formData: FormData) {
  const user = await requirePermission("teams.manage");
  const before = await db.team.findUniqueOrThrow({ where: { id: teamId } });

  const raw = Object.fromEntries(formData.entries());
  const parsed = teamSchema.parse(raw);

  const team = await db.team.update({ where: { id: teamId }, data: parsed });

  await writeAuditLog({ userId: user.id, action: "team.update", entityType: "Team", entityId: team.id, changes: { before, after: parsed } });
  revalidatePath("/[locale]/dashboard/teams", "page");
  revalidatePath("/[locale]/dashboard", "page"); // team switcher labels shown in the layout
  return { id: team.id };
}
