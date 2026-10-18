import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getNativePrincipal } from "@/lib/native-session";
import { hasPermission } from "@/lib/permissions";
import { resolveTeamScope, scopeIncludesTeam } from "@/lib/authz/policy";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ id: string; eventId: string }> }) {
  const user = await getNativePrincipal(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasPermission(user, "matches.report")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id: matchId, eventId } = await context.params;
  const scope = await resolveTeamScope(db, user);
  const event = await db.matchEvent.findUnique({ where: { id: eventId }, include: { match: true } });
  if (!event || event.matchId !== matchId) return NextResponse.json({ error: "event_not_found" }, { status: 404 });
  if (!scopeIncludesTeam(scope, event.match.teamId)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (event.source !== "MANUAL") return NextResponse.json({ error: "official_event_read_only" }, { status: 409 });

  await db.$transaction(async (tx) => {
    const paired = event.notes?.startsWith("__SUBSTITUTION_PAIR__:")
      ? await tx.matchEvent.findMany({ where: { matchId, notes: event.notes }, select: { id: true } })
      : [{ id: event.id }];
    await tx.matchEvent.deleteMany({ where: { id: { in: paired.map((item) => item.id) } } });
    if (["GOAL", "PENALTY_GOAL", "OWN_GOAL"].includes(event.type)) {
      const key = event.side === "HOME" ? "homeScore" : "awayScore";
      const currentScore = event.side === "HOME" ? event.match.homeScore : event.match.awayScore;
      await tx.match.update({ where: { id: matchId }, data: { [key]: Math.max(0, (currentScore ?? 0) - 1) } });
    }
    await writeAuditLog({ userId: user.id, action: "match.mobile_event.delete", entityType: "MatchEvent", entityId: event.id, changes: { before: event } }, tx);
  });

  revalidatePath("/[locale]/field/matches", "page");
  revalidatePath("/[locale]/dashboard/matches", "page");
  revalidatePath(`/[locale]/matches/${matchId}`, "page");
  revalidatePath("/[locale]/dashboard/player-stats", "page");
  return NextResponse.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
}
