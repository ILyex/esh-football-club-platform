"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { resolveUserTeamContext } from "@/lib/team-context";
import { writeAuditLog } from "@/lib/audit";

const playerSchema = z.object({ id: z.string().min(1).max(40), kind: z.enum(["player", "opponent"]), x: z.number().min(0).max(1000), y: z.number().min(0).max(640), number: z.string().max(3), label: z.string().max(32), color: z.string().regex(/^#[0-9a-f]{6}$/i) });
const boardDataSchema = z.object({
  items: z.array(z.discriminatedUnion("kind", [
    playerSchema,
    z.object({ id: z.string().min(1).max(40), kind: z.literal("ball"), x: z.number().min(0).max(1000), y: z.number().min(0).max(640), color: z.string().regex(/^#[0-9a-f]{6}$/i).optional() }),
    z.object({ id: z.string().min(1).max(40), kind: z.enum(["arrow", "line", "zone"]), x: z.number().min(0).max(1000), y: z.number().min(0).max(640), x2: z.number().min(0).max(1000), y2: z.number().min(0).max(640), color: z.string().regex(/^#[0-9a-f]{6}$/i), label: z.string().max(100).optional() }),
    z.object({ id: z.string().min(1).max(40), kind: z.literal("path"), x: z.number().min(0).max(1000), y: z.number().min(0).max(640), x2: z.number().min(0).max(1000), y2: z.number().min(0).max(640), color: z.string().regex(/^#[0-9a-f]{6}$/i), label: z.string().max(100).optional(), points: z.array(z.object({ x: z.number().min(0).max(1000), y: z.number().min(0).max(640) })).min(2).max(500) })
  ])).max(80),
  orientation: z.enum(["horizontal", "vertical"]),
  mode: z.enum(["image", "video"]).optional(),
  notes: z.string().max(4000),
  coachName: z.string().max(100).optional(),
  animation: z.object({
    duration: z.number().min(2).max(60),
    frames: z.array(z.object({
      time: z.number().min(0).max(60),
      positions: z.record(z.string().min(1).max(40), z.object({ x: z.number().min(0).max(1000), y: z.number().min(0).max(640) })).refine((positions) => Object.keys(positions).length <= 24)
    })).max(120)
  }).optional()
});

const planSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1).max(100),
  description: z.string().max(2000).optional().default(""),
  formation: z.enum(["4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "3-4-3", "4-1-4-1"]).default("4-3-3"),
  teamId: z.string().optional().nullable(),
  data: z.string().min(2).max(250_000)
});

export async function saveTacticalPlanAction(input: unknown) {
  const user = await requirePermission("training.manage");
  const value = planSchema.parse(input);
  let decoded: unknown;
  try { decoded = boardDataSchema.parse(JSON.parse(value.data)); } catch { throw new Error("Invalid tactical board data"); }
  const context = await resolveUserTeamContext();
  const selectedTeamId = value.teamId || null;
  if (selectedTeamId && !context.authorizedTeams.some((team) => team.id === selectedTeamId)) {
    throw new Error("You cannot manage tactics for this team");
  }

  const existing = value.id ? await db.tacticalPlan.findUnique({ where: { id: value.id } }) : null;
  if (value.id && (!existing || existing.creatorId !== user.id)) throw new Error("Tactical plan not found");
  if (existing?.teamId && !context.authorizedTeams.some((team) => team.id === existing.teamId)) {
    throw new Error("You cannot manage tactics for this team");
  }

  const data = {
    title: value.title,
    description: value.description || null,
    formation: value.formation,
    teamId: selectedTeamId,
    data: decoded as object
  };
  const plan = existing
    ? await db.tacticalPlan.update({ where: { id: existing.id }, data })
    : await db.tacticalPlan.create({ data: { ...data, creatorId: user.id } });
  await writeAuditLog({ userId: user.id, action: existing ? "tactics.update" : "tactics.create", entityType: "TacticalPlan", entityId: plan.id });
  revalidatePath("/[locale]/dashboard/tactics", "page");
  revalidatePath("/[locale]/dashboard/tactics/plans", "page");
  return { id: plan.id, updatedAt: plan.updatedAt.toISOString() };
}

export async function deleteTacticalPlanAction(id: string) {
  const user = await requirePermission("training.manage");
  const plan = await db.tacticalPlan.findUnique({ where: { id } });
  if (!plan || plan.creatorId !== user.id) throw new Error("Tactical plan not found");
  const context = await resolveUserTeamContext();
  if (plan.teamId && !context.authorizedTeams.some((team) => team.id === plan.teamId)) {
    throw new Error("You cannot manage tactics for this team");
  }
  await db.tacticalPlan.delete({ where: { id } });
  await writeAuditLog({ userId: user.id, action: "tactics.delete", entityType: "TacticalPlan", entityId: plan.id });
  revalidatePath("/[locale]/dashboard/tactics", "page");
  revalidatePath("/[locale]/dashboard/tactics/plans", "page");
  return { ok: true };
}
