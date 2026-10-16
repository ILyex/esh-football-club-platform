"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { assertTeamScope, getMutationScopeContext } from "@/lib/mutation-guards";
import { deletePrivateFile, generateStorageKey, uploadPrivateFile, validateUploadedFile } from "@/lib/storage";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { enqueueTeamInsuranceCheck } from "@/lib/ai/team-insurance-check-job";
import { processQueuedJobAfterResponse } from "@/lib/jobs/after-response";

function parseDate(value: FormDataEntryValue | null): Date {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("أدخل تاريخ بداية ونهاية صالحين.");
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error("أحد التواريخ غير صالح.");
  return parsed;
}

export async function uploadTeamInsuranceAction(teamId: string, locale: string, formData: FormData) {
  const safeLocale = locale === "fr" ? "fr" : "ar";
  const user = await requirePermission("teams.manage");
  const scope = await getMutationScopeContext();
  const team = await db.team.findUnique({ where: { id: teamId }, select: { id: true, name: true, category: true } });
  if (!team) throw new Error("الفئة غير موجودة.");
  assertTeamScope(scope, team.id, "Team", { allowClubWide: true });

  const startDate = parseDate(formData.get("startDate"));
  const endDate = parseDate(formData.get("endDate"));
  if (endDate < startDate) throw new Error("تاريخ نهاية التأمين يسبق تاريخ بدايته.");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("أرفق وثيقة تأمين الفئة.");
  const buffer = Buffer.from(await file.arrayBuffer());
  const { mime, ext } = await validateUploadedFile(buffer);
  const storageKey = generateStorageKey("team-insurance", ext);
  await uploadPrivateFile({ key: storageKey, buffer, mimeType: mime });

  let documentId: string | null = null;
  let policyId: string | null = null;
  try {
    const policy = await db.$transaction(async (tx) => {
      let category = await tx.documentCategory.findFirst({ where: { key: "certificate" } });
      if (!category) category = await tx.documentCategory.create({ data: { key: "certificate", name: "وثائق التأمين الرياضي" } });
      const document = await tx.document.create({ data: {
        name: `${safeLocale === "ar" ? "تأمين فئة" : "Assurance catégorie"} ${team.category}`,
        categoryId: category.id,
        documentDate: startDate,
        description: `Team group insurance policy (${team.category})`,
        classification: "RESTRICTED",
        status: "PENDING_REVIEW",
        storageKey,
        mimeType: mime,
        sizeBytes: buffer.byteLength,
        originalName: file.name.slice(0, 255),
        ownerId: user.id,
        uploadedById: user.id,
        teamId: team.id
      } });
      documentId = document.id;
      const createdPolicy = await tx.teamInsurancePolicy.create({ data: { teamId: team.id, documentId: document.id, startDate, endDate, createdById: user.id } });
      policyId = createdPolicy.id;
      await enqueueTeamInsuranceCheck(tx, createdPolicy.id, user.id);
      return createdPolicy;
    });
    processQueuedJobAfterResponse("team.insurance_check");
    await writeAuditLog({ userId: user.id, action: "team.insurance_uploaded", entityType: "TeamInsurancePolicy", entityId: policy.id, changes: { teamId: team.id, category: team.category, documentId, startDate, endDate } });
  } catch (error) {
    if (policyId) await db.teamInsurancePolicy.delete({ where: { id: policyId } }).catch(() => {});
    if (documentId) await db.document.delete({ where: { id: documentId } }).catch(() => {});
    await deletePrivateFile(storageKey).catch(() => {});
    throw error;
  }
  revalidatePath("/[locale]/dashboard/teams", "page");
  revalidatePath(`/${safeLocale}/dashboard/teams`);
  redirect(`/${safeLocale}/dashboard/teams?insurance=queued`);
}
