"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { trainingSessionSchema, attendanceSchema, bulkAttendanceSchema } from "@/lib/validations/training";
import { writeAuditLog } from "@/lib/audit";
import { getMutationScopeContext, assertTeamScope, assertDualTeamScope } from "@/lib/mutation-guards";
import { revalidatePath } from "next/cache";
import { combineAlgeriaDateAndTime } from "@/lib/dates/algeria";

import {
  validateUploadedFile,
  uploadPrivateFile,
  deletePrivateFile,
  generateStorageKey,
  FileValidationError
} from "@/lib/storage";

async function syncCalendarEvent(trainingId: string, title: string, start: Date, end: Date, location: string | undefined, teamId: string | null) {
  await db.calendarEvent.upsert({
    where: { relatedTrainingId: trainingId },
    update: { title, startDateTime: start, endDateTime: end, location, teamId },
    create: { title, type: "TRAINING", startDateTime: start, endDateTime: end, location, teamId, relatedTrainingId: trainingId }
  });
}

export async function createTrainingSessionAction(formData: FormData) {
  const user = await requirePermission("training.manage");
  const scopeContext = await getMutationScopeContext();

  const raw = Object.fromEntries(formData.entries());
  const parsed = trainingSessionSchema.parse(raw);
  assertTeamScope(scopeContext, parsed.teamId, "TrainingSession");

  const start = combineAlgeriaDateAndTime(parsed.date, parsed.startTime);
  const end = combineAlgeriaDateAndTime(parsed.date, parsed.endTime);

  const session = await db.trainingSession.create({
    data: {
      date: parsed.date,
      teamId: parsed.teamId,
      startTime: start,
      endTime: end,
      location: parsed.location,
      coachId: parsed.coachId || null,
      notes: parsed.notes,
      status: parsed.status
    }
  });

  await syncCalendarEvent(session.id, "Training", start, end, parsed.location, parsed.teamId);

  await writeAuditLog({
    userId: user.id,
    action: "training.create",
    entityType: "TrainingSession",
    entityId: session.id,
    changes: { after: parsed }
  });
  revalidatePath("/[locale]/dashboard/training", "page");
  revalidatePath("/[locale]/dashboard/calendar", "page");
  revalidatePath("/[locale]", "page");
  return { id: session.id };
}

export async function updateTrainingSessionAction(sessionId: string, formData: FormData) {
  const user = await requirePermission("training.manage");
  const scopeContext = await getMutationScopeContext();
  const before = await db.trainingSession.findUniqueOrThrow({ where: { id: sessionId } });

  const raw = Object.fromEntries(formData.entries());
  const parsed = trainingSessionSchema.parse(raw);
  assertDualTeamScope(scopeContext, before.teamId, parsed.teamId, "TrainingSession");

  const start = combineAlgeriaDateAndTime(parsed.date, parsed.startTime);
  const end = combineAlgeriaDateAndTime(parsed.date, parsed.endTime);

  const session = await db.trainingSession.update({
    where: { id: sessionId },
    data: {
      date: parsed.date,
      teamId: parsed.teamId,
      startTime: start,
      endTime: end,
      location: parsed.location,
      coachId: parsed.coachId || null,
      notes: parsed.notes,
      status: parsed.status
    }
  });

  await syncCalendarEvent(session.id, "Training", start, end, parsed.location, parsed.teamId);

  await writeAuditLog({
    userId: user.id,
    action: "training.update",
    entityType: "TrainingSession",
    entityId: session.id,
    changes: { before, after: parsed }
  });
  revalidatePath("/[locale]/dashboard/training", "page");
  revalidatePath("/[locale]/dashboard/calendar", "page");
  revalidatePath(`/[locale]/dashboard/training/${sessionId}`, "page");
  revalidatePath("/[locale]", "page");
  return { id: session.id };
}

export async function deleteTrainingSessionAction(sessionId: string) {
  const user = await requirePermission("training.manage");
  const scopeContext = await getMutationScopeContext();
  const before = await db.trainingSession.findUniqueOrThrow({ where: { id: sessionId } });
  assertTeamScope(scopeContext, before.teamId, "TrainingSession");

  await db.$transaction(async (tx) => {
    await tx.calendarEvent.deleteMany({ where: { relatedTrainingId: sessionId } });
    await tx.trainingSession.delete({ where: { id: sessionId } });
  }); // TrainingAttendance cascades with the session.

  await writeAuditLog({ userId: user.id, action: "training.delete", entityType: "TrainingSession", entityId: sessionId });
  revalidatePath("/[locale]/dashboard/training", "page");
  revalidatePath("/[locale]/dashboard/calendar", "page");
  revalidatePath("/[locale]", "page");
}

export async function setAttendanceAction(sessionId: string, formData: FormData) {
  const user = await requirePermission("training.manage");
  const scopeContext = await getMutationScopeContext();
  const session = await db.trainingSession.findUniqueOrThrow({ where: { id: sessionId } });
  assertTeamScope(scopeContext, session.teamId, "TrainingSession");

  const raw = Object.fromEntries(formData.entries());
  const parsed = attendanceSchema.parse(raw);

  const player = await db.player.findUniqueOrThrow({ where: { id: parsed.playerId } });
  assertTeamScope(scopeContext, player.teamId, "Player");
  if (player.status !== "ACTIVE") throw new Error("playerNotActive");

  await db.trainingAttendance.upsert({
    where: { trainingId_playerId: { trainingId: sessionId, playerId: parsed.playerId } },
    update: { status: parsed.status },
    create: { trainingId: sessionId, playerId: parsed.playerId, status: parsed.status }
  });

  await writeAuditLog({
    userId: user.id,
    action: "training.attendance.set",
    entityType: "TrainingAttendance",
    entityId: `${sessionId}:${parsed.playerId}`,
    changes: { after: parsed }
  });
  revalidatePath(`/[locale]/dashboard/training/${sessionId}`, "page");
  revalidatePath(`/[locale]/dashboard/players/${parsed.playerId}`, "page");
  revalidatePath("/[locale]/dashboard/players", "page");
}

export async function saveBulkAttendanceAction(
  sessionId: string,
  records: Array<{ playerId: string; status: "PRESENT" | "ABSENT" | "INJURED" | "EXCUSED" }>
) {
  const user = await requirePermission("training.manage");
  const scopeContext = await getMutationScopeContext();
  const session = await db.trainingSession.findUniqueOrThrow({ where: { id: sessionId } });
  assertTeamScope(scopeContext, session.teamId, "TrainingSession");

  const validated = bulkAttendanceSchema.parse({ attendances: records });

  await db.$transaction(async (tx) => {
    for (const item of validated.attendances) {
      await tx.trainingAttendance.upsert({
        where: { trainingId_playerId: { trainingId: sessionId, playerId: item.playerId } },
        update: { status: item.status },
        create: { trainingId: sessionId, playerId: item.playerId, status: item.status }
      });
    }

    await writeAuditLog(
      {
        userId: user.id,
        action: "training.attendance.bulk_save",
        entityType: "TrainingAttendance",
        entityId: sessionId,
        changes: { count: validated.attendances.length, records: validated.attendances }
      },
      tx
    );
  });

  revalidatePath(`/[locale]/dashboard/training/${sessionId}`, "page");
  for (const item of validated.attendances) {
    revalidatePath(`/[locale]/dashboard/players/${item.playerId}`, "page");
  }
  revalidatePath("/[locale]/dashboard/players", "page");
  return { success: true, count: validated.attendances.length };
}

export async function uploadTrainingScannedSheetAction(sessionId: string, formData: FormData) {
  const user = await requirePermission("training.manage");
  const scopeContext = await getMutationScopeContext();
  const session = await db.trainingSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { team: true }
  });
  assertTeamScope(scopeContext, session.teamId, "TrainingSession");

  const file = formData.get("scannedSheetFile") as File | null;
  if (!file || file.size === 0) {
    throw new Error("No file uploaded");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let validated;
  try {
    validated = await validateUploadedFile(buffer);
  } catch (err) {
    if (err instanceof FileValidationError) {
      throw new Error(err.message);
    }
    throw err;
  }

  let category = await db.documentCategory.findFirst({
    where: {
      OR: [
        { key: "training_attendance" },
        { name: { contains: "Présence" } },
        { name: { contains: "Reports" } },
        { name: { contains: "Other" } }
      ]
    }
  });

  if (!category) {
    category = await db.documentCategory.findFirst();
  }

  if (!category) {
    category = await db.documentCategory.create({
      data: {
        key: "training_attendance",
        name: "Training Attendance / محاضر حضور التدريب"
      }
    });
  }

  const storageKey = generateStorageKey("training-attendance", validated.ext);
  await uploadPrivateFile({ key: storageKey, buffer, mimeType: validated.mime });

  // Remove existing older scanned sheets for this session if any
  const existingDocs = await db.document.findMany({
    where: { description: { contains: `TRAINING_ATTENDANCE:${sessionId}` } }
  });
  for (const oldDoc of existingDocs) {
    try {
      await deletePrivateFile(oldDoc.storageKey);
    } catch (e) {
      console.warn("Could not delete previous storage key:", oldDoc.storageKey, e);
    }
    await db.document.delete({ where: { id: oldDoc.id } });
  }

  const teamName = session.team?.name || session.team?.category || "التدريب";
  const doc = await db.document.create({
    data: {
      name: `ورقة حضور تدريب رسمية موقعة — ${teamName} (${new Date(session.date).toLocaleDateString("fr-DZ")})`,
      description: `TRAINING_ATTENDANCE:${sessionId}`,
      categoryId: category.id,
      classification: "INTERNAL",
      storageKey,
      mimeType: validated.mime,
      sizeBytes: buffer.byteLength,
      originalName: file.name,
      ownerId: user.id,
      uploadedById: user.id,
      teamId: session.teamId || null,
      documentDate: session.date,
      status: "APPROVED"
    }
  });

  await writeAuditLog({
    userId: user.id,
    action: "training.scanned_sheet.upload",
    entityType: "Document",
    entityId: doc.id,
    changes: {
      sessionId,
      documentId: doc.id,
      fileName: file.name,
      sizeBytes: buffer.byteLength
    }
  });

  revalidatePath(`/[locale]/dashboard/training/${sessionId}`, "page");
  return { success: true, documentId: doc.id };
}

export async function deleteTrainingScannedSheetAction(sessionId: string, documentId: string) {
  const user = await requirePermission("training.manage");
  const scopeContext = await getMutationScopeContext();
  const session = await db.trainingSession.findUniqueOrThrow({ where: { id: sessionId } });
  assertTeamScope(scopeContext, session.teamId, "TrainingSession");

  const doc = await db.document.findUniqueOrThrow({ where: { id: documentId } });
  if (!doc.description?.includes(`TRAINING_ATTENDANCE:${sessionId}`)) {
    throw new Error("Document does not belong to this training session");
  }

  try {
    await deletePrivateFile(doc.storageKey);
  } catch (e) {
    console.warn("Could not delete storage key:", doc.storageKey, e);
  }

  await db.document.delete({ where: { id: documentId } });

  await writeAuditLog({
    userId: user.id,
    action: "training.scanned_sheet.delete",
    entityType: "Document",
    entityId: documentId,
    changes: { sessionId, documentId }
  });

  revalidatePath(`/[locale]/dashboard/training/${sessionId}`, "page");
  return { success: true };
}
