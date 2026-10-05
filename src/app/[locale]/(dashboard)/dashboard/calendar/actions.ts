"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { calendarEventSchema } from "@/lib/validations/calendar-event";
import { writeAuditLog } from "@/lib/audit";
import { getMutationScopeContext, assertTeamScope } from "@/lib/mutation-guards";
import { revalidatePath } from "next/cache";

// MATCH and TRAINING events are owned by the Matches/Training modules
// (synced via their own actions.ts) — this file only ever mutates
// MEETING/ADMINISTRATIVE/OTHER events, which are club-wide events
// created without a specific team.

export async function createCalendarEventAction(formData: FormData) {
  const user = await requirePermission("calendar.manage");
  const scopeContext = await getMutationScopeContext();

  const raw = Object.fromEntries(formData.entries());
  const parsed = calendarEventSchema.parse(raw);
  assertTeamScope(scopeContext, null, "CalendarEvent"); // creating manual club-wide calendar event requires unrestricted scope

  const event = await db.calendarEvent.create({ data: parsed });

  await writeAuditLog({
    userId: user.id,
    action: "calendarEvent.create",
    entityType: "CalendarEvent",
    entityId: event.id,
    changes: { after: parsed }
  });
  revalidatePath("/[locale]/dashboard/calendar", "page");
  if (event.type === "MEETING") revalidatePath("/[locale]/dashboard/meeting-minutes", "page");
  return { id: event.id, startDateTime: event.startDateTime };
}

export async function updateCalendarEventAction(eventId: string, formData: FormData) {
  const user = await requirePermission("calendar.manage");
  const scopeContext = await getMutationScopeContext();
  const before = await db.calendarEvent.findUniqueOrThrow({ where: { id: eventId }, include: { meetingMinute: true } });
  if (before.relatedMatchId || before.relatedTrainingId) {
    throw new Error("Auto-synced calendar events can only be edited from their source (match or training).");
  }

  assertTeamScope(scopeContext, before.teamId, "CalendarEvent");

  const raw = Object.fromEntries(formData.entries());
  const parsed = calendarEventSchema.parse(raw);
  if (before.meetingMinute && parsed.type !== "MEETING") throw new Error("A meeting with minutes must remain a meeting event.");

  const event = await db.$transaction(async (tx) => {
    const updated = await tx.calendarEvent.update({ where: { id: eventId }, data: parsed });
    if (before.meetingMinute) {
      await tx.meetingMinute.update({ where: { id: before.meetingMinute.id }, data: { title: parsed.title, date: parsed.startDateTime, location: parsed.location, teamId: before.teamId } });
    }
    return updated;
  });

  await writeAuditLog({
    userId: user.id,
    action: "calendarEvent.update",
    entityType: "CalendarEvent",
    entityId: event.id,
    changes: { before, after: parsed }
  });
  revalidatePath("/[locale]/dashboard/calendar", "page");
  if (event.type === "MEETING" || before.meetingMinute) revalidatePath("/[locale]/dashboard/meeting-minutes", "page");
  return { id: event.id };
}

export async function deleteCalendarEventAction(eventId: string) {
  const user = await requirePermission("calendar.manage");
  const scopeContext = await getMutationScopeContext();
  const event = await db.calendarEvent.findUniqueOrThrow({ where: { id: eventId } });
  if (event.relatedMatchId || event.relatedTrainingId) {
    throw new Error("Auto-synced calendar events can only be removed by deleting their source match or training session.");
  }
  assertTeamScope(scopeContext, event.teamId, "CalendarEvent");

  await db.calendarEvent.delete({ where: { id: eventId } });

  await writeAuditLog({ userId: user.id, action: "calendarEvent.delete", entityType: "CalendarEvent", entityId: eventId });
  revalidatePath("/[locale]/dashboard/calendar", "page");
  if (event.type === "MEETING") revalidatePath("/[locale]/dashboard/meeting-minutes", "page");
}
