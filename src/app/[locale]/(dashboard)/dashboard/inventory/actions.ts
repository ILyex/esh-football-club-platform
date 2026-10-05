"use server";

import { db } from "@/lib/db";
import { getSessionOrThrow, hasPermission, ForbiddenError } from "@/lib/permissions";
import { inventoryItemSchema } from "@/lib/validations/inventory";
import { writeAuditLog } from "@/lib/audit";
import { getMutationScopeContext, assertTeamScope, assertDualTeamScope } from "@/lib/mutation-guards";
import { revalidatePath } from "next/cache";

async function requireInventoryManage() {
  const user = await getSessionOrThrow();
  if (
    !hasPermission(user, "inventory.manage") &&
    !hasPermission(user, "training.manage") &&
    !hasPermission(user, "teams.manage")
  ) {
    throw new ForbiddenError("inventory.manage");
  }
  return user;
}

export async function createInventoryItemAction(formData: FormData) {
  const user = await requireInventoryManage();
  const scopeContext = await getMutationScopeContext();

  const raw = Object.fromEntries(formData.entries());
  const parsed = inventoryItemSchema.parse(raw);
  assertTeamScope(scopeContext, parsed.teamId || null, "InventoryItem");

  const item = await db.inventoryItem.create({
    data: {
      name: parsed.name,
      category: parsed.category,
      quantity: parsed.quantity,
      condition: parsed.condition,
      location: parsed.location || null,
      teamId: parsed.teamId || null,
      notes: parsed.notes || null,
      createdById: user.id
    }
  });

  await writeAuditLog({
    userId: user.id,
    action: "inventory.create",
    entityType: "InventoryItem",
    entityId: item.id,
    changes: { after: parsed }
  });

  revalidatePath("/[locale]/dashboard/inventory", "page");
  return { id: item.id };
}

export async function updateInventoryItemAction(id: string, formData: FormData) {
  const user = await requireInventoryManage();
  const scopeContext = await getMutationScopeContext();
  const before = await db.inventoryItem.findUniqueOrThrow({ where: { id } });

  const raw = Object.fromEntries(formData.entries());
  const parsed = inventoryItemSchema.parse(raw);
  assertDualTeamScope(scopeContext, before.teamId, parsed.teamId || null, "InventoryItem");

  const item = await db.inventoryItem.update({
    where: { id },
    data: {
      name: parsed.name,
      category: parsed.category,
      quantity: parsed.quantity,
      condition: parsed.condition,
      location: parsed.location || null,
      teamId: parsed.teamId || null,
      notes: parsed.notes || null
    }
  });

  await writeAuditLog({
    userId: user.id,
    action: "inventory.update",
    entityType: "InventoryItem",
    entityId: id,
    changes: { before, after: parsed }
  });

  revalidatePath("/[locale]/dashboard/inventory", "page");
  revalidatePath(`/[locale]/dashboard/inventory/${id}`, "page");
  return { id: item.id };
}

export async function deleteInventoryItemAction(id: string) {
  const user = await requireInventoryManage();
  const scopeContext = await getMutationScopeContext();
  const before = await db.inventoryItem.findUniqueOrThrow({ where: { id } });
  assertTeamScope(scopeContext, before.teamId, "InventoryItem");

  await db.inventoryItem.delete({ where: { id } });

  await writeAuditLog({
    userId: user.id,
    action: "inventory.delete",
    entityType: "InventoryItem",
    entityId: id,
    changes: { before }
  });

  revalidatePath("/[locale]/dashboard/inventory", "page");
}
