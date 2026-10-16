"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { contractSchema } from "@/lib/validations/contract";
import { writeAuditLog } from "@/lib/audit";
import { getMutationScopeContext, assertTeamScope, assertDualTeamScope } from "@/lib/mutation-guards";
import { revalidatePath } from "next/cache";

async function resolveSubjectTeamId(playerId: string | undefined, staffId: string | undefined): Promise<string | null> {
  if (playerId) {
    const player = await db.player.findUnique({ where: { id: playerId }, select: { teamId: true } });
    return player?.teamId ?? null;
  }
  if (staffId) {
    const staff = await db.staff.findUnique({ where: { id: staffId }, select: { teamId: true } });
    return staff?.teamId ?? null;
  }
  return null;
}

export async function createContractAction(formData: FormData) {
  const user = await requirePermission("contracts.manage");
  const scopeContext = await getMutationScopeContext();

  const raw = Object.fromEntries(formData.entries());
  const parsed = contractSchema.parse(raw);

  if (parsed.playerId) {
    const player = await db.player.findUniqueOrThrow({ where: { id: parsed.playerId } });
    assertTeamScope(scopeContext, player.teamId, "Player");
  }
  if (parsed.staffId) {
    const staff = await db.staff.findUniqueOrThrow({ where: { id: parsed.staffId } });
    assertTeamScope(scopeContext, staff.teamId, "Staff");
  }

  // Team is derived from the contract's own subject (spec sections 4, 26)
  // rather than asked for separately — a contract's team should never be
  // able to drift from the player/staff member it actually belongs to.
  const teamId = await resolveSubjectTeamId(parsed.playerId, parsed.staffId);
  assertTeamScope(scopeContext, teamId, "Contract");

  const contract = await db.$transaction(async (tx) => {
    const created = await tx.contract.create({
    data: {
      type: parsed.type,
      playerId: parsed.playerId || null,
      staffId: parsed.staffId || null,
      teamId,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      status: parsed.status,
      notes: parsed.notes
    }
    });
    await writeAuditLog({
    userId: user.id,
    action: "contract.create",
    entityType: "Contract",
    entityId: created.id,
    changes: { after: parsed }
    }, tx);
    return created;
  });

  revalidatePath("/[locale]/dashboard/contracts", "page");
  revalidatePath("/[locale]/dashboard", "page"); // dashboard stats include contract counts
  return { id: contract.id };
}

export async function updateContractAction(contractId: string, formData: FormData) {
  const user = await requirePermission("contracts.manage");
  const scopeContext = await getMutationScopeContext();
  const before = await db.contract.findUniqueOrThrow({ where: { id: contractId } });
  assertTeamScope(scopeContext, before.teamId, "Contract");

  const raw = Object.fromEntries(formData.entries());
  const parsed = contractSchema.parse(raw);

  if (parsed.playerId) {
    const player = await db.player.findUniqueOrThrow({ where: { id: parsed.playerId } });
    assertTeamScope(scopeContext, player.teamId, "Player");
  }
  if (parsed.staffId) {
    const staff = await db.staff.findUniqueOrThrow({ where: { id: parsed.staffId } });
    assertTeamScope(scopeContext, staff.teamId, "Staff");
  }

  const teamId = await resolveSubjectTeamId(parsed.playerId, parsed.staffId);
  assertDualTeamScope(scopeContext, before.teamId, teamId, "Contract");

  const contract = await db.$transaction(async (tx) => {
    const updated = await tx.contract.update({
    where: { id: contractId },
    data: {
      type: parsed.type,
      playerId: parsed.playerId || null,
      staffId: parsed.staffId || null,
      teamId,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      status: parsed.status,
      notes: parsed.notes
    }
    });
    await writeAuditLog({
    userId: user.id,
    action: "contract.update",
    entityType: "Contract",
    entityId: updated.id,
    changes: { before, after: parsed }
    }, tx);
    return updated;
  });

  revalidatePath("/[locale]/dashboard/contracts", "page");
  revalidatePath("/[locale]/dashboard", "page");
  return { id: contract.id };
}

export async function archiveContractAction(contractId: string) {
  const user = await requirePermission("contracts.manage");
  const scopeContext = await getMutationScopeContext();
  const before = await db.contract.findUniqueOrThrow({ where: { id: contractId } });
  assertTeamScope(scopeContext, before.teamId, "Contract");

  await db.$transaction(async (tx) => {
    const contract = await tx.contract.update({ where: { id: contractId }, data: { status: "EXPIRED" } });
    await writeAuditLog({ userId: user.id, action: "contract.archive", entityType: "Contract", entityId: contract.id }, tx);
  });
  revalidatePath("/[locale]/dashboard/contracts", "page");
  revalidatePath("/[locale]/dashboard", "page");
}

