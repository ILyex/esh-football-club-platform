"use server";

import { db } from "@/lib/db";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { meetingMinuteSchema } from "@/lib/validations/meeting-minute";
import { writeAuditLog } from "@/lib/audit";
import { getMutationScopeContext, assertTeamScope, assertDualTeamScope } from "@/lib/mutation-guards";
import { validateUploadedFile, uploadPrivateFile, generateStorageKey, FileValidationError } from "@/lib/storage";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const scheduledMeetingSchema = z.object({
  title: z.string().trim().min(1).max(160),
  startDateTime: z.coerce.date(),
  endDateTime: z.coerce.date(),
  location: z.string().trim().max(160).optional(),
  description: z.string().trim().max(2000).optional()
}).refine((value) => value.endDateTime > value.startDateTime, { message: "endBeforeStart", path: ["endDateTime"] });

export async function createScheduledMeetingAction(formData: FormData) {
  const user = await requirePermission("meetings.manage");
  const scopeContext = await getMutationScopeContext();
  assertTeamScope(scopeContext, null, "CalendarEvent");
  const result = scheduledMeetingSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!result.success) {
    return { error: result.error.issues.some((issue) => issue.message === "endBeforeStart") ? "end-before-start" as const : "invalid-schedule" as const };
  }
  const parsed = result.data;
  const event = await db.$transaction(async (tx) => {
    const created = await tx.calendarEvent.create({
      data: { ...parsed, type: "MEETING", location: parsed.location || null, description: parsed.description || null }
    });
    await writeAuditLog({
      userId: user.id,
      action: "meeting.schedule",
      entityType: "CalendarEvent",
      entityId: created.id,
      changes: { after: parsed }
    }, tx);
    return created;
  });
  try {
    const { notifyCalendarManagersOfMeeting } = await import("@/lib/push/admin-meeting-push");
    await notifyCalendarManagersOfMeeting(event);
  } catch (error) {
    console.error("[CalendarMeeting] Meeting was saved, but notification delivery failed.", error instanceof Error ? error.message : "unknown error");
  }
  revalidatePath("/[locale]/dashboard/meeting-minutes", "page");
  revalidatePath("/[locale]/dashboard/calendar", "page");
  return { id: event.id, startDateTime: event.startDateTime };
}

function splitAttendees(raw: string | undefined): string[] {
  return raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

async function getOrCreateMeetingCategory() {
  let cat = await db.documentCategory.findUnique({ where: { key: "meeting_minute" } });
  if (!cat) {
    cat = await db.documentCategory.create({
      data: { key: "meeting_minute", name: "Meeting Minutes / محاضر الاجتماعات" }
    });
  }
  return cat;
}

export async function createMeetingMinuteAction(formData: FormData) {
  const user = await requirePermission("meetings.manage");
  const scopeContext = await getMutationScopeContext();

  const raw = Object.fromEntries(formData.entries());
  const parsed = meetingMinuteSchema.parse(raw);
  if (!parsed.calendarEventId) throw new Error("calendarMeetingRequiredForMinutes");
  assertTeamScope(scopeContext, parsed.teamId || null, "MeetingMinute");

  let linkedEvent: { id: string; type: string; teamId: string | null; title: string; startDateTime: Date; location: string | null } | null = null;
  if (parsed.calendarEventId) {
    const event = await db.calendarEvent.findUnique({
      where: { id: parsed.calendarEventId },
      select: { id: true, type: true, teamId: true, title: true, startDateTime: true, endDateTime: true, location: true, meetingMinute: { select: { id: true } } }
    });
    if (!event || event.type !== "MEETING") throw new Error("calendarMeetingNotFound");
    if (event.meetingMinute) throw new Error("calendarMeetingAlreadyHasMinutes");
    if (event.endDateTime > new Date()) throw new Error("calendarMeetingNotFinished");
    assertTeamScope(scopeContext, event.teamId, "CalendarEvent", { allowClubWide: true });
    if (event.teamId !== (parsed.teamId || null)) throw new Error("calendarMeetingTeamMismatch");
    linkedEvent = event;
  }

  const meeting = await db.meetingMinute.create({
    data: {
      title: linkedEvent?.title ?? parsed.title,
      date: linkedEvent?.startDateTime ?? parsed.date,
      location: linkedEvent ? linkedEvent.location : parsed.location,
      attendees: splitAttendees(parsed.attendees),
      teamId: linkedEvent ? linkedEvent.teamId : (parsed.teamId || null),
      agenda: parsed.agenda,
      content: parsed.content,
      decisions: parsed.decisions,
      notes: parsed.notes,
      status: parsed.status,
      calendarEventId: linkedEvent?.id,
      responsiblePersonId: user.id
    }
  });

  // Optional direct file upload attached during creation
  const file = formData.get("file") as File | null;
  if (file && file.size > 0) {
    const buffer = Buffer.from(await file.arrayBuffer());
    let validated;
    try {
      validated = await validateUploadedFile(buffer);
    } catch (err) {
      if (err instanceof FileValidationError) throw new Error(err.message);
      throw err;
    }

    const category = await getOrCreateMeetingCategory();
    const storageKey = generateStorageKey(category.id, validated.ext);
    await uploadPrivateFile({ key: storageKey, buffer, mimeType: validated.mime });

    const document = await db.document.create({
      data: {
        name: parsed.title,
        categoryId: category.id,
        description: `Attachment for meeting minutes: ${parsed.title}`,
        documentDate: parsed.date,
        classification: "RESTRICTED",
        department: "Administration / الإدارة",
        storageKey,
        mimeType: validated.mime,
        sizeBytes: buffer.byteLength,
        originalName: file.name,
        ownerId: user.id,
        uploadedById: user.id,
        teamId: parsed.teamId || null,
        status: "APPROVED"
      }
    });

    await db.meetingAttachment.create({
      data: {
        meetingId: meeting.id,
        documentId: document.id
      }
    });
  }

  await writeAuditLog({
    userId: user.id,
    action: "meeting.create",
    entityType: "MeetingMinute",
    entityId: meeting.id,
    changes: { after: parsed }
  });
  revalidatePath("/[locale]/dashboard/meeting-minutes", "page");
  return { id: meeting.id };
}

export async function updateMeetingMinuteAction(meetingId: string, formData: FormData) {
  const user = await requirePermission("meetings.manage");
  const scopeContext = await getMutationScopeContext();
  const before = await db.meetingMinute.findUniqueOrThrow({ where: { id: meetingId }, include: { calendarEvent: true } });

  const raw = Object.fromEntries(formData.entries());
  const parsed = meetingMinuteSchema.parse(raw);
  assertDualTeamScope(scopeContext, before.teamId, parsed.teamId || null, "MeetingMinute");

  const meeting = await db.meetingMinute.update({
    where: { id: meetingId },
    data: {
      title: before.calendarEvent?.title ?? parsed.title,
      date: before.calendarEvent?.startDateTime ?? parsed.date,
      location: before.calendarEvent ? before.calendarEvent.location : parsed.location,
      attendees: splitAttendees(parsed.attendees),
      teamId: before.calendarEvent ? before.calendarEvent.teamId : (parsed.teamId || null),
      agenda: parsed.agenda,
      content: parsed.content,
      decisions: parsed.decisions,
      notes: parsed.notes,
      status: parsed.status
    }
  });

  await writeAuditLog({
    userId: user.id,
    action: "meeting.update",
    entityType: "MeetingMinute",
    entityId: meeting.id,
    changes: { before, after: parsed }
  });
  revalidatePath("/[locale]/dashboard/meeting-minutes", "page");
  revalidatePath(`/[locale]/dashboard/meeting-minutes/${meetingId}`, "page");
  return { id: meeting.id };
}

// Same reasoning as Correspondence: attachments point at existing, already
// secure Document rows rather than a second raw-upload path.
export async function attachMeetingDocumentAction(meetingId: string, formData: FormData) {
  const user = await requirePermission("meetings.manage");
  const scopeContext = await getMutationScopeContext();
  const meeting = await db.meetingMinute.findUniqueOrThrow({ where: { id: meetingId } });
  assertTeamScope(scopeContext, meeting.teamId, "MeetingMinute");

  const documentId = String(formData.get("documentId") ?? "");
  if (!documentId) return;

  const canSeeRestricted = hasPermission(user, "documents.view.restricted");
  const document = await db.document.findFirst({
    where: { id: documentId, ...(canSeeRestricted ? {} : { classification: { in: ["PUBLIC", "INTERNAL"] } }) }
  });
  if (!document) return;

  // Attachment compatibility:
  // - Team A parent -> Team A document OR club-wide document
  // - Club-wide parent -> club-wide document only
  if (meeting.teamId) {
    if (document.teamId !== null && document.teamId !== meeting.teamId) return;
  } else {
    if (document.teamId !== null) return;
  }

  assertTeamScope(scopeContext, document.teamId, "Document", { allowClubWide: true });

  await db.meetingAttachment.upsert({
    where: { meetingId_documentId: { meetingId, documentId } },
    update: {},
    create: { meetingId, documentId }
  });

  await writeAuditLog({ userId: user.id, action: "meeting.attach", entityType: "MeetingMinute", entityId: meetingId, changes: { after: { documentId } } });
  revalidatePath(`/[locale]/dashboard/meeting-minutes/${meetingId}`, "page");
}

export async function detachMeetingDocumentAction(meetingId: string, documentId: string) {
  const user = await requirePermission("meetings.manage");
  const scopeContext = await getMutationScopeContext();
  const meeting = await db.meetingMinute.findUniqueOrThrow({ where: { id: meetingId } });
  assertTeamScope(scopeContext, meeting.teamId, "MeetingMinute");

  await db.meetingAttachment.deleteMany({ where: { meetingId, documentId } });

  await writeAuditLog({ userId: user.id, action: "meeting.detach", entityType: "MeetingMinute", entityId: meetingId, changes: { after: { documentId } } });
  revalidatePath(`/[locale]/dashboard/meeting-minutes/${meetingId}`, "page");
}

export async function uploadAndAttachMeetingDocumentAction(meetingId: string, formData: FormData) {
  const user = await requirePermission("meetings.manage");
  const scopeContext = await getMutationScopeContext();
  const meeting = await db.meetingMinute.findUniqueOrThrow({ where: { id: meetingId } });
  assertTeamScope(scopeContext, meeting.teamId, "MeetingMinute");

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    throw new Error("No file provided");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let validated;
  try {
    validated = await validateUploadedFile(buffer);
  } catch (err) {
    if (err instanceof FileValidationError) throw new Error(err.message);
    throw err;
  }

  const category = await getOrCreateMeetingCategory();
  const storageKey = generateStorageKey(category.id, validated.ext);
  await uploadPrivateFile({ key: storageKey, buffer, mimeType: validated.mime });

  const docName = (formData.get("name") as string)?.trim() || file.name;

  const document = await db.document.create({
    data: {
      name: docName,
      categoryId: category.id,
      description: `Attachment for meeting minutes: ${meeting.title}`,
      documentDate: meeting.date,
      classification: "RESTRICTED",
      department: "Administration / الإدارة",
      storageKey,
      mimeType: validated.mime,
      sizeBytes: buffer.byteLength,
      originalName: file.name,
      ownerId: user.id,
      uploadedById: user.id,
      teamId: meeting.teamId || null,
      status: "APPROVED"
    }
  });

  await db.meetingAttachment.upsert({
    where: { meetingId_documentId: { meetingId, documentId: document.id } },
    update: {},
    create: { meetingId, documentId: document.id }
  });

  await writeAuditLog({
    userId: user.id,
    action: "meeting.upload_attach",
    entityType: "MeetingMinute",
    entityId: meetingId,
    changes: { after: { documentId: document.id, originalName: file.name } }
  });

  revalidatePath(`/[locale]/dashboard/meeting-minutes/${meetingId}`, "page");
  return { documentId: document.id };
}

