"use server";

import { revalidatePath } from "next/cache";
import {
  createTestSession,
  saveSessionMeasurements,
  completeTestSession,
  correctTestResult,
  deleteTestSession,
  TestingDomainError
} from "@/lib/testing/service";
import type { PlayerMeasurementEntrySchema } from "@/lib/testing/validation";
import type { z } from "zod";

export async function createTestSessionAction(formData: FormData) {
  const testDefinitionId = formData.get("testDefinitionId") as string;
  const teamId = formData.get("teamId") as string;
  const title = formData.get("title") as string;
  const rawDate = formData.get("date") as string;
  const location = (formData.get("location") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  try {
    const session = await createTestSession({
      testDefinitionId,
      teamId,
      title,
      date: new Date(rawDate),
      location,
      notes,
    });
    revalidatePath("/[locale]/dashboard/testing", "page");
    return { success: true, sessionId: session.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function saveSessionMeasurementsAction(
  sessionId: string,
  entries: z.infer<typeof PlayerMeasurementEntrySchema>[]
) {
  try {
    const res = await saveSessionMeasurements({ sessionId, entries });
    revalidatePath(`/[locale]/dashboard/testing/${sessionId}`, "page");
    return { success: true, count: res.count };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function completeTestSessionAction(sessionId: string) {
  try {
    const res = await completeTestSession(sessionId);
    revalidatePath(`/[locale]/dashboard/testing/${sessionId}`, "page");
    revalidatePath("/[locale]/dashboard/testing", "page");
    return { success: true, count: res.completedResults };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function correctTestResultAction(
  resultId: string,
  correctionReason: string,
  measurements: any[],
  status: "VALID" | "INCOMPLETE" | "DISQUALIFIED" | "ABSENT" = "VALID",
  notes?: string | null
) {
  try {
    const updated = await correctTestResult({
      resultId,
      correctionReason,
      status,
      measurements,
      notes,
    });
    revalidatePath(`/[locale]/dashboard/testing`, "layout");
    return { success: true, resultId: updated.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteTestSessionAction(sessionId: string) {
  try {
    const res = await deleteTestSession(sessionId);
    revalidatePath("/[locale]/dashboard/testing", "page");
    return { success: true, id: res.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getCoachTestingAIInsightsAction(sessionId: string, locale = "ar", currentPlayers?: unknown) {
  const { requirePermission } = await import("@/lib/permissions");
  const { db } = await import("@/lib/db");
  const { getMutationScopeContext, assertTeamScope } = await import("@/lib/mutation-guards");
  const { generateCoachTestingInsights } = await import("@/lib/ai/coach-assistant-service");

  await requirePermission("players.view");

  const session = await db.testSession.findUnique({
    where: { id: sessionId },
    include: {
      team: true,
      testDefinition: true,
      results: {
        include: {
          player: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              shirtNumber: true,
              position: true
            }
          },
          measurements: true
        }
      }
    }
  });

  if (!session) {
    return { success: false, error: "Session not found" };
  }

  try {
    assertTeamScope(await getMutationScopeContext(), session.teamId, "TestSession");
  } catch {
    return { success: false, error: "You are not authorized to view this session" };
  }

  // Use current sheet edits when supplied, but only for players on this session's team.
  const inputRows = Array.isArray(currentPlayers) ? currentPlayers.slice(0, 300) : null;
  const inputIds = inputRows?.map((row: any) => typeof row?.id === "string" ? row.id : "").filter(Boolean) ?? [];
  const teamPlayers = inputRows ? await db.player.findMany({
    where: { id: { in: inputIds }, teamId: session.teamId },
    select: { id: true, firstName: true, lastName: true, shirtNumber: true, position: true }
  }) : [];
  const teamPlayerMap = new Map(teamPlayers.map((player) => [player.id, player]));

  const players = inputRows ? inputRows.flatMap((row: any) => {
    const player = teamPlayerMap.get(row?.id);
    if (!player) return [];
    const measurements: Record<string, string | number> = {};
    if (row.measurements && typeof row.measurements === "object" && !Array.isArray(row.measurements)) {
      for (const [key, value] of Object.entries(row.measurements).slice(0, 40)) {
        if (/^[a-zA-Z0-9_-]{1,50}$/.test(key) && ((typeof value === "string" && /^[+-]?[\d.,]+$/.test(value)) || (typeof value === "number" && Number.isFinite(value)))) measurements[key] = typeof value === "string" ? value.slice(0, 40) : value;
      }
    }
    const status = ["VALID", "INCOMPLETE", "DISQUALIFIED", "ABSENT"].includes(row.status) ? row.status : "INCOMPLETE";
    const score = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
    return [{ id: player.id, name: `${player.firstName} ${player.lastName}`, shirtNumber: player.shirtNumber, position: player.position,
      status, summaryScore: score(row.summaryScore), secondaryScore: score(row.secondaryScore), scoreDisplay: null, measurements }];
  }) : session.results.map((r) => {
    const measMap: Record<string, any> = {};
    for (const m of r.measurements) {
      measMap[m.key] = m.numericValue ?? m.value;
    }
    return {
      id: r.playerId,
      name: `${r.player.firstName} ${r.player.lastName}`,
      shirtNumber: r.player.shirtNumber,
      position: r.player.position,
      status: r.status,
      scoreDisplay: r.scoreDisplay,
      summaryScore: r.summaryScore,
      secondaryScore: r.secondaryScore,
      measurements: measMap
    };
  });

  try {
    const report = await generateCoachTestingInsights({
      sessionId: session.id,
      sessionTitle: session.title,
      teamName: session.team.name,
      protocolCode: session.testDefinition.code,
      protocolName: session.testDefinition.name,
      primaryUnit: session.testDefinition.primaryUnit,
      secondaryUnit: session.testDefinition.secondaryUnit,
      date: session.date.toISOString().slice(0, 10),
      players,
      locale
    });
    return { success: true, report };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

