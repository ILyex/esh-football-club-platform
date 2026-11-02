"use server";

import { db } from "@/lib/db";
import { getSessionOrThrow, hasPermission, ForbiddenError } from "@/lib/permissions";
import { inventoryItemSchema } from "@/lib/validations/inventory";
import { writeAuditLog } from "@/lib/audit";
import { getMutationScopeContext, assertTeamScope, assertDualTeamScope } from "@/lib/mutation-guards";
import { revalidatePath } from "next/cache";

function safelyRevalidateInventory(...paths: string[]) {
  for (const path of paths) {
    try {
      revalidatePath(path, "page");
    } catch (error) {
      console.error("Inventory saved, but cache refresh failed:", error instanceof Error ? error.message : "unknown error");
    }
  }
}

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

  const item = await db.$transaction(async (tx) => {
    const created = await tx.inventoryItem.create({
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
      entityId: created.id,
      changes: { after: parsed }
    }, tx);

    return created;
  });
  safelyRevalidateInventory("/[locale]/dashboard/inventory");
  return { id: item.id };
}

export async function updateInventoryItemAction(id: string, formData: FormData) {
  const user = await requireInventoryManage();
  const scopeContext = await getMutationScopeContext();
  const before = await db.inventoryItem.findUniqueOrThrow({ where: { id } });

  const raw = Object.fromEntries(formData.entries());
  const parsed = inventoryItemSchema.parse(raw);
  assertDualTeamScope(scopeContext, before.teamId, parsed.teamId || null, "InventoryItem");

  const item = await db.$transaction(async (tx) => {
    const updated = await tx.inventoryItem.update({
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
    }, tx);

    return updated;
  });
  safelyRevalidateInventory("/[locale]/dashboard/inventory", `/[locale]/dashboard/inventory/${id}`);
  return { id: item.id };
}

export async function deleteInventoryItemAction(id: string) {
  // Deleting stock is an inventory decision. `training.manage` may edit items
  // (that is how coaches consume equipment) but may not erase the register.
  const user = await getSessionOrThrow();
  if (!hasPermission(user, "inventory.manage") && !hasPermission(user, "teams.manage")) {
    throw new ForbiddenError("inventory.manage");
  }
  const scopeContext = await getMutationScopeContext();
  const before = await db.inventoryItem.findUniqueOrThrow({ where: { id } });
  assertTeamScope(scopeContext, before.teamId, "InventoryItem");

  await db.$transaction(async (tx) => {
    await tx.inventoryItem.delete({ where: { id } });
    await writeAuditLog({
      userId: user.id,
      action: "inventory.delete",
      entityType: "InventoryItem",
      entityId: id,
      changes: { before }
    }, tx);
  });
  safelyRevalidateInventory("/[locale]/dashboard/inventory");
}
