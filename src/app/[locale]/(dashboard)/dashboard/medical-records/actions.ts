"use server";

import { PlayerMedicalRecordType, PlayerMedicalStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { assertTeamScope, getMutationScopeContext } from "@/lib/mutation-guards";
import { deletePrivateFile, generateStorageKey, uploadPrivateFile, validateUploadedFile } from "@/lib/storage";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { enqueueMedicalDocumentCheck } from "@/lib/ai/medical-document-check-job";
import { processQueuedJobAfterResponse } from "@/lib/jobs/after-response";

const labels: Record<PlayerMedicalRecordType, string> = {
  INSURANCE_POLICY: "وثيقة تأمين لاعب",
  MEDICAL_CLEARANCE: "شهادة الأهلية الطبية",
  ANTI_DOPING_CONSENT: "موافقة فحص مكافحة المنشطات",
  DRUG_TEST_RESULT: "كشف تعاطي المخدرات",
  LAB_ANALYSIS: "تحليل مخبري",
  OTHER: "وثيقة طبية أخرى"
};
const allowedMedicalTypes: PlayerMedicalRecordType[] = ["MEDICAL_CLEARANCE", "DRUG_TEST_RESULT", "LAB_ANALYSIS"];

function optionalDate(value: FormDataEntryValue | null): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("أحد التواريخ غير صالح.");
  return date;
}

export async function createPlayerMedicalRecordAction(playerId: string, formData: FormData) {
  const locale = formData.get("locale") === "fr" ? "fr" : "ar";
  const user = await requirePermission("medical.records.manage");
  const scopeContext = await getMutationScopeContext();
  const player = await db.player.findUnique({ where: { id: playerId }, select: { id: true, teamId: true, firstName: true, lastName: true, dateOfBirth: true } });
  if (!player) throw new Error("اللاعب غير موجود.");
  assertTeamScope(scopeContext, player.teamId, "Player", { allowClubWide: true });

  const typeValue = String(formData.get("type") || "");
  if (!allowedMedicalTypes.includes(typeValue as PlayerMedicalRecordType)) {
    throw new Error("نوع الملف الطبي غير صالح.");
  }
  const type = typeValue as PlayerMedicalRecordType;
  const title = String(formData.get("title") || labels[type]).trim().slice(0, 120);
  const provider = String(formData.get("provider") || "").trim().slice(0, 120) || null;
  const issuedAt = optionalDate(formData.get("issuedAt"));
  const expiresAt = optionalDate(formData.get("expiresAt"));
  if (expiresAt) expiresAt.setUTCHours(23, 59, 59, 999);
  if (issuedAt && expiresAt && expiresAt < issuedAt) throw new Error("تاريخ الانتهاء يسبق تاريخ الإصدار.");
  const statusValue = String(formData.get("status") || "PENDING");
  if (!Object.values(PlayerMedicalStatus).includes(statusValue as PlayerMedicalStatus)) throw new Error("الحالة الطبية غير صالحة.");
  const status = type === "MEDICAL_CLEARANCE" ? statusValue as PlayerMedicalStatus : "PENDING";
  let consentAuthority: "PLAYER" | "LEGAL_GUARDIAN" | null = null;
  let consentAuthorityName: string | null = null;
  let consentRecordedAt: Date | null = null;
  if (type === "ANTI_DOPING_CONSENT") {
    const years = (Date.now() - player.dateOfBirth.getTime()) / (365.2425 * 24 * 60 * 60 * 1000);
    const isMinor = years < 19;
    const authority = String(formData.get("consentAuthority") || "");
    consentAuthorityName = String(formData.get("consentAuthorityName") || "").trim().slice(0, 120) || null;
    if ((isMinor && authority !== "LEGAL_GUARDIAN") || (!isMinor && authority !== "PLAYER")) {
      throw new Error(isMinor ? "يلزم تسجيل موافقة الولي القانوني للاعب دون 19 سنة." : "يلزم تسجيل موافقة اللاعب البالغ." );
    }
    if (isMinor && !consentAuthorityName) throw new Error("أدخل اسم الولي القانوني كما يظهر في وثيقة الموافقة.");
    consentAuthority = authority as "PLAYER" | "LEGAL_GUARDIAN";
    consentRecordedAt = new Date();
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("أرفق الوثيقة المطلوبة.");

  const buffer = Buffer.from(await file.arrayBuffer());
  const { mime, ext } = await validateUploadedFile(buffer);
  const storageKey = generateStorageKey("medical", ext);
  await uploadPrivateFile({ key: storageKey, buffer, mimeType: mime });
  let documentId: string | null = null;
  let recordId: string | null = null;
  try {
    let category = await db.documentCategory.findFirst({ where: { key: "certificate" } });
    if (!category) category = await db.documentCategory.create({ data: { key: "certificate", name: "شهادات طبية" } });
    const document = await db.document.create({
      data: {
        name: `${labels[type]} - ${player.firstName} ${player.lastName}`,
        categoryId: category.id,
        documentDate: issuedAt ?? new Date(),
        classification: "RESTRICTED",
        status: "PENDING_REVIEW",
        storageKey,
        mimeType: mime,
        sizeBytes: buffer.byteLength,
        originalName: file.name.slice(0, 255),
        ownerId: user.id,
        uploadedById: user.id,
        relatedPlayerId: player.id,
        teamId: player.teamId
      }
    });
    documentId = document.id;
    const record = await db.playerMedicalRecord.create({
      data: { playerId, documentId, type, title, issuedAt, expiresAt, status, provider, consentAuthority, consentAuthorityName, consentRecordedAt, createdById: user.id }
    });
    recordId = record.id;
    const checkJob = await enqueueMedicalDocumentCheck(db, record.id, user.id);
    processQueuedJobAfterResponse(checkJob.type);
    await writeAuditLog({
      userId: user.id,
      action: "medical_record.created",
      entityType: "PlayerMedicalRecord",
      entityId: record.id,
      changes: { playerId, type, status, documentId }
    });
  } catch (error) {
    if (recordId) await db.playerMedicalRecord.delete({ where: { id: recordId } }).catch(() => {});
    if (documentId) await db.document.delete({ where: { id: documentId } }).catch(() => {});
    await deletePrivateFile(storageKey).catch(() => {});
    throw error;
  }
  revalidatePath("/[locale]/dashboard/medical-records", "page");
  revalidatePath("/[locale]/dashboard/players/[id]", "page");
  revalidatePath(`/${locale}/dashboard/medical-records/${playerId}`);
  redirect(`/${locale}/dashboard/medical-records/${playerId}?saved=1`);
}

export async function updatePlayerMedicalRecordAction(recordId: string, locale: string, formData: FormData) {
  const safeLocale = locale === "fr" ? "fr" : "ar";
  const user = await requirePermission("medical.records.manage");
  const scopeContext = await getMutationScopeContext();
  const record = await db.playerMedicalRecord.findUnique({ where: { id: recordId }, include: { player: { select: { id: true, teamId: true } } } });
  if (!record || !allowedMedicalTypes.includes(record.type)) throw new Error("الوثيقة الطبية غير موجودة أو نوعها غير مدعوم.");
  assertTeamScope(scopeContext, record.player.teamId, "Player", { allowClubWide: true });
  const title = String(formData.get("title") || "").trim().slice(0, 120);
  const provider = String(formData.get("provider") || "").trim().slice(0, 120) || null;
  if (!title) throw new Error("أدخل اسم الوثيقة.");
  const issuedAt = optionalDate(formData.get("issuedAt"));
  const expiresAt = optionalDate(formData.get("expiresAt"));
  if (expiresAt) expiresAt.setUTCHours(23, 59, 59, 999);
  if (issuedAt && expiresAt && expiresAt < issuedAt) throw new Error("تاريخ الانتهاء يسبق تاريخ الإصدار.");
  const statusValue = String(formData.get("status") || record.status);
  if (!( ["PENDING", "FIT", "TEMPORARILY_UNFIT", "UNFIT", "NOT_APPLICABLE"] as string[]).includes(statusValue)) throw new Error("الحالة الطبية غير صالحة.");
  const status = record.type === "MEDICAL_CLEARANCE" ? statusValue as PlayerMedicalStatus : "PENDING";
  await db.playerMedicalRecord.update({ where: { id: recordId }, data: { title, provider, issuedAt, expiresAt, status } });
  await writeAuditLog({ userId: user.id, action: "medical_record.updated", entityType: "PlayerMedicalRecord", entityId: recordId, changes: { playerId: record.player.id, title, provider, issuedAt, expiresAt, status } });
  revalidatePath(`/${safeLocale}/dashboard/medical-records/${record.player.id}`);
  revalidatePath(`/${safeLocale}/dashboard/medical-records/${record.player.id}/edit`);
  redirect(`/${safeLocale}/dashboard/medical-records/${record.player.id}/edit?updated=1`);
}

export async function updateMedicalClearanceStatusAction(recordId: string, locale: string, formData: FormData) {
  const safeLocale = locale === "fr" ? "fr" : "ar";
  const user = await requirePermission("medical.records.manage");
  const scopeContext = await getMutationScopeContext();
  const record = await db.playerMedicalRecord.findUnique({
    where: { id: recordId },
    include: { player: { select: { id: true, teamId: true } } }
  });
  if (!record || record.type !== "MEDICAL_CLEARANCE") throw new Error("شهادة الأهلية الطبية غير موجودة.");
  assertTeamScope(scopeContext, record.player.teamId, "Player", { allowClubWide: true });
  const value = String(formData.get("status") || "");
  if (!( ["PENDING", "FIT", "TEMPORARILY_UNFIT", "UNFIT"] as string[]).includes(value)) throw new Error("الحالة الطبية غير صالحة.");
  const updated = await db.playerMedicalRecord.update({ where: { id: recordId }, data: { status: value as PlayerMedicalStatus } });
  await writeAuditLog({
    userId: user.id,
    action: "medical_record.clearance_status_updated",
    entityType: "PlayerMedicalRecord",
    entityId: recordId,
    changes: { playerId: record.player.id, before: record.status, after: updated.status }
  });
  revalidatePath(`/${safeLocale}/dashboard/medical-records/${record.player.id}`);
  redirect(`/${safeLocale}/dashboard/medical-records/${record.player.id}?updated=1`);
}

export async function approveMedicalDocumentAction(recordId: string, locale: string, _formData: FormData) {
  const safeLocale = locale === "fr" ? "fr" : "ar";
  const user = await requirePermission("medical.records.manage");
  const scopeContext = await getMutationScopeContext();
  const record = await db.playerMedicalRecord.findUnique({
    where: { id: recordId },
    include: { player: { select: { id: true, teamId: true } }, document: { select: { id: true, status: true } } }
  });
  if (!record?.document) throw new Error("الوثيقة الطبية غير موجودة.");
  assertTeamScope(scopeContext, record.player.teamId, "Player", { allowClubWide: true });
  if (record.document.status !== "PENDING_REVIEW") throw new Error("الوثيقة ليست بانتظار الاعتماد.");
  await db.document.update({ where: { id: record.document.id }, data: { status: "APPROVED" } });
  await writeAuditLog({
    userId: user.id,
    action: "medical_document.approved",
    entityType: "Document",
    entityId: record.document.id,
    changes: { playerId: record.player.id, medicalRecordId: recordId }
  });
  revalidatePath(`/${safeLocale}/dashboard/medical-records/${record.player.id}`);
  redirect(`/${safeLocale}/dashboard/medical-records/${record.player.id}?updated=1`);
}
