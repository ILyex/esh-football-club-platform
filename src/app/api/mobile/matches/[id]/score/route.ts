import { z } from "zod";
import { NextResponse } from "next/server";
import { MatchStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getNativePrincipal } from "@/lib/native-session";
import { hasPermission } from "@/lib/permissions";
import { resolveTeamScope, scopeIncludesTeam } from "@/lib/authz/policy";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const scoreSchema = z.object({
  homeScore: z.number().int().min(0).max(99).nullable().optional(),
  awayScore: z.number().int().min(0).max(99).nullable().optional(),
  status: z.nativeEnum(MatchStatus).optional()
}).refine((value) => value.homeScore !== undefined || value.awayScore !== undefined || value.status !== undefined);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getNativePrincipal(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasPermission(user, "matches.update")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await context.params;
  const parsed = scoreSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_score" }, { status: 400 });
  const match = await db.match.findUnique({ where: { id }, select: { id: true, teamId: true, homeScore: true, awayScore: true, status: true } });
  if (!match) return NextResponse.json({ error: "match_not_found" }, { status: 404 });
  const scope = await resolveTeamScope(db, user);
  if (!scopeIncludesTeam(scope, match.teamId)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const updated = await db.match.update({ where: { id }, data: parsed.data });
  await writeAuditLog({
    userId: user.id,
    action: "match.mobile_score.update",
    entityType: "Match",
    entityId: id,
    changes: { before: { homeScore: match.homeScore, awayScore: match.awayScore, status: match.status }, after: parsed.data }
  });
  revalidatePath("/[locale]/dashboard/matches", "page");
  revalidatePath("/[locale]/field/matches", "page");
  revalidatePath("/[locale]/matches/[id]", "page");
  return NextResponse.json({ homeScore: updated.homeScore, awayScore: updated.awayScore, status: updated.status }, { headers: { "Cache-Control": "no-store" } });
}
