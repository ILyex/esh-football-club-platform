import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getNativePrincipal } from "@/lib/native-session";
import { hasPermission } from "@/lib/permissions";
import { resolveTeamScope } from "@/lib/authz/policy";
import { rankStandings } from "@/lib/competitions/standings";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const entrySchema = z.object({
  id: z.string().min(1).max(120), rank: z.number().int().positive(), teamName: z.string().trim().min(2).max(120),
  teamLogo: z.string().max(2048).nullable().optional(), isOurClub: z.boolean(),
  played: z.number().int().nonnegative(), won: z.number().int().nonnegative(), drawn: z.number().int().nonnegative(), lost: z.number().int().nonnegative(),
  goalsFor: z.number().int().nonnegative(), goalsAgainst: z.number().int().nonnegative(), goalDifference: z.number().int(), points: z.number().int().nonnegative(),
  form: z.array(z.enum(["W", "D", "L"])).max(5).optional()
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getNativePrincipal(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(hasPermission(user, "competitions.manage") || user.roleKey === "developer" || user.roleKey === "super_admin")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const competition = await db.competition.findUnique({ where: { id }, select: { id: true, type: true, teamId: true } });
  if (!competition) return NextResponse.json({ error: "competition_not_found" }, { status: 404 });
  if (competition.type !== "LEAGUE") return NextResponse.json({ error: "standings_only_for_leagues" }, { status: 400 });
  const scope = await resolveTeamScope(db, user);
  if (scope.restricted && competition.teamId && !scope.teamIds.includes(competition.teamId)) return NextResponse.json({ error: "team_scope_forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const parsed = z.object({ standings: z.array(entrySchema).max(100) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_standings" }, { status: 400 });
  const standings = rankStandings(parsed.data.standings);
  await db.competition.update({ where: { id }, data: { standingsData: standings as any } });
  await writeAuditLog({ userId: user.id, action: "competition.mobileUpdateStandings", entityType: "Competition", entityId: id, changes: { teamCount: standings.length } });
  return NextResponse.json({ success: true, standings }, { headers: { "Cache-Control": "no-store" } });
}
