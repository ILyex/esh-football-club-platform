"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { playerSchema } from "@/lib/validations/player";
import { writeAuditLog } from "@/lib/audit";
import { getMutationScopeContext, assertTeamScope, assertDualTeamScope } from "@/lib/mutation-guards";
import { slugify } from "@/lib/utils";
import {
  validateUploadedImage,
  generatePublicStorageKey,
  uploadPublicFile,
  deletePublicFile,
  deletePrivateFile,
  validateUploadedFile,
  generateStorageKey,
  uploadPrivateFile
} from "@/lib/storage";
import { revalidatePath } from "next/cache";
import { isConfirmedPositiveDrugTest, verifyDocument } from "@/lib/ai/document-verifier";

async function extractPlayerPhoto(formData: FormData): Promise<string | undefined> {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return undefined;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { mime, ext } = await validateUploadedImage(buffer);
  const key = generatePublicStorageKey("players", ext);
  return uploadPublicFile({ key, buffer, mimeType: mime });
}

async function savePlayerAttachedDocument(params: {
  playerId: string;
  teamId: string | null;
  file: File;
  type: "CNI" | "CONTRACT" | "BIRTH_CERTIFICATE" | "DRUG_TEST";
  playerName: string;
  userId: string;
}): Promise<boolean> {
  if (!(params.file instanceof File) || params.file.size === 0) return false;
  const buffer = Buffer.from(await params.file.arrayBuffer());
  const { mime, ext } = await validateUploadedFile(buffer);
  let verificationStatus: "APPROVED" | "PENDING_REVIEW" = "PENDING_REVIEW";
  let positiveDrugTest = false;

  // ── Document Verification (AI + Rules) ──────────────────────────────────
  {
    const otherPlayers = params.teamId
      ? await db.player.findMany({
          where: { teamId: params.teamId, id: { not: params.playerId } },
          select: { firstName: true, lastName: true, firstNameFr: true, lastNameFr: true }
        })
      : [];

    const targetPlayer = await db.player.findUniqueOrThrow({
      where: { id: params.playerId },
      select: { firstName: true, lastName: true, firstNameFr: true, lastNameFr: true }
    });
    const docKindByType: Record<typeof params.type, "IDENTITY" | "CONTRACT" | "BIRTH_CERTIFICATE" | "DRUG_TEST"> = {
      CNI: "IDENTITY",
      CONTRACT: "CONTRACT",
      BIRTH_CERTIFICATE: "BIRTH_CERTIFICATE",
      DRUG_TEST: "DRUG_TEST"
    };

    const verification = await verifyDocument(buffer, mime, {
      kind: docKindByType[params.type],
      player: targetPlayer,
      otherPlayers
    });

    if (verification.verdict === "REJECT") {
      const errorCodes = verification.findings
        .filter((f) => f.severity === "error")
        .map((f) => f.code)
        .join(", ");
      positiveDrugTest = params.type === "DRUG_TEST" && isConfirmedPositiveDrugTest(verification);
      const docLabel: Record<string, string> = {
        CNI: "بطاقة التعريف الوطنية",
        CONTRACT: "عقد اللاعب",
        BIRTH_CERTIFICATE: "شهادة الميلاد",
        DRUG_TEST: "وثيقة فحص المخدرات"
      };
      if (!positiveDrugTest) throw new Error(
        `VERIFY_REJECT|${errorCodes}|تعذّر قبول ${docLabel[params.type] || "الوثيقة"} — ${
          errorCodes.includes("WRONG_DOCUMENT_TYPE")
            ? "نوع الملف لا يطابق الوثيقة المطلوبة؛ تحقق من الملف المرفوع واختر الوثيقة الصحيحة"
            : errorCodes.includes("OTHER_PLAYER")
              ? "الوثيقة غير مطابقة لمعلومات اللاعب؛ الاسم الظاهر يعود إلى لاعب آخر"
              : errorCodes.includes("NAME_MISSING")
                ? "الوثيقة غير مطابقة لمعلومات اللاعب؛ لم يظهر اسم اللاعب المسجل فيها"
                : errorCodes.includes("DRUG_TEST_POSITIVE")
                  ? "نتيجة فحص المخدرات إيجابية؛ لم تُرفق لأن هوية صاحب الوثيقة لم تتطابق مع اللاعب"
                  : "يرجى التحقق من محتوى الملف"
        }`
      );
    }
    verificationStatus = verification.verdict === "ACCEPT" && !positiveDrugTest ? "APPROVED" : "PENDING_REVIEW";
  }
  // ── End verification ─────────────────────────────────────────────────────

  const categoryMap: Record<string, string> = {
    CNI: "registration",
    CONTRACT: "contract",
    BIRTH_CERTIFICATE: "certificate",
    DRUG_TEST: "certificate"
  };
  const categoryKey = categoryMap[params.type] || "administrative";
  let category = await db.documentCategory.findFirst({
    where: { OR: [{ key: categoryKey }, { key: "administrative" }, { key: "other" }] }
  });
  if (!category) {
    category = await db.documentCategory.create({
      data: { key: categoryKey, name: categoryKey }
    });
  }

  const namePrefixMap: Record<string, string> = {
    CNI: "بطاقة التعريف الوطنية",
    CONTRACT: "عقد اللاعب",
    BIRTH_CERTIFICATE: "شهادة الميلاد",
    DRUG_TEST: "وثيقة فحص المخدرات"
  };
  const docPrefix = namePrefixMap[params.type];
  const docName = `${docPrefix} - ${params.playerName}`;
  const storageKey = generateStorageKey(`players/${params.type.toLowerCase()}`, ext);
  await uploadPrivateFile({ key: storageKey, buffer, mimeType: mime });

  try {
    // Replace previous document of the same type for this player
    const existing = await db.document.findFirst({
      where: {
        relatedPlayerId: params.playerId,
        name: { startsWith: docPrefix }
      }
    });

    const document = existing
      ? await db.document.update({
          where: { id: existing.id },
          data: {
            name: docName,
            documentDate: new Date(),
            ...(positiveDrugTest ? { description: "verification:DRUG_TEST_POSITIVE" } : {}),
            storageKey,
            mimeType: mime,
            sizeBytes: buffer.byteLength,
            originalName: params.file.name,
            uploadedById: params.userId,
            status: verificationStatus
          }
        })
      : await db.document.create({
          data: {
            name: docName,
            categoryId: category.id,
            documentDate: new Date(),
            ...(positiveDrugTest ? { description: "verification:DRUG_TEST_POSITIVE" } : {}),
            storageKey,
            mimeType: mime,
            sizeBytes: buffer.byteLength,
            originalName: params.file.name,
            ownerId: params.userId,
            uploadedById: params.userId,
            relatedPlayerId: params.playerId,
            teamId: params.teamId,
            classification: "RESTRICTED",
            status: verificationStatus
          }
        });
    if (positiveDrugTest) await writeAuditLog({
      userId: params.userId,
      action: "document.drug_test_positive_detected",
      entityType: "Document",
      entityId: document.id,
      changes: { status: "PENDING_REVIEW", relatedPlayerId: params.playerId }
    }).catch(() => {});
    return positiveDrugTest;
  } catch (error) {
    // Storage is outside the database transaction: remove the uploaded object
    // if its document row could not be saved, while preserving the player.
    await deletePrivateFile(storageKey).catch(() => {});
    throw error;
  }
}

export async function createPlayerAction(formData: FormData) {
  const user = await requirePermission("players.create");
  const scopeContext = await getMutationScopeContext();

  const raw = Object.fromEntries(formData.entries());
  const parsed = playerSchema.parse(raw);
  assertTeamScope(scopeContext, parsed.teamId, "Player");

  if (parsed.teamId) {
    const assignedTeam = await db.team.findUnique({ where: { id: parsed.teamId } });
    if (assignedTeam && assignedTeam.birthYearFrom != null) {
      const birthYear = parsed.dateOfBirth.getUTCFullYear();
      if (birthYear < assignedTeam.birthYearFrom) {
        throw new Error(
          `لا يمكن تسجيل اللاعب في هذه الفئة: سنة ميلاد اللاعب (${birthYear}) أكبر من الفئة العمرية المسموح بها (${assignedTeam.category}) التي تبدأ من سنة ${assignedTeam.birthYearFrom}.`
        );
      }
    }
  }

  const photoUrl = await extractPlayerPhoto(formData);

  const baseSlug = slugify(`${parsed.firstName}-${parsed.lastName}`);
  let slug = baseSlug;
  let suffix = 1;
  while (await db.player.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${++suffix}`;
  }

  const player = await db.player.create({
    data: {
      slug,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      firstNameFr: parsed.firstNameFr,
      lastNameFr: parsed.lastNameFr,
      position: parsed.position,
      nationality: parsed.nationality,
      dateOfBirth: parsed.dateOfBirth,
      teamId: parsed.teamId,
      shirtNumber: parsed.shirtNumber,
      height: parsed.height,
      weight: parsed.weight,
      previousTeam: parsed.previousTeam,
      placeOfBirth: parsed.placeOfBirth,
      bloodGroup: parsed.bloodGroup,
      birthCertificateNumber: parsed.birthCertificateNumber,
      licenceNumber: parsed.licenceNumber,
      preferredFoot: parsed.preferredFoot,
      joiningDate: parsed.joiningDate,
      status: parsed.status,
      internalNotes: parsed.internalNotes,
      photoUrl,
      translations: {
        create: [
          ...(parsed.biographyAr ? [{ locale: "ar", biography: parsed.biographyAr }] : []),
          ...(parsed.biographyFr ? [{ locale: "fr", biography: parsed.biographyFr }] : [])
        ]
      }
    },
    include: { team: true }
  });

  let positiveDrugTestDetected = false;
  const attachmentFailures: string[] = [];
  const attachments = [
    { field: "cniFile", type: "CNI" as const },
    { field: "contractFile", type: "CONTRACT" as const },
    { field: "birthCertificateFile", type: "BIRTH_CERTIFICATE" as const }
  ];

  for (const attachment of attachments) {
    const file = formData.get(attachment.field);
    if (!(file instanceof File) || file.size === 0) continue;
    try {
      positiveDrugTestDetected = (await savePlayerAttachedDocument({
        playerId: player.id,
        teamId: player.teamId,
        file,
        type: attachment.type,
        playerName: `${player.firstName} ${player.lastName}`,
        userId: user.id
      })) || positiveDrugTestDetected;
    } catch {
      // Player creation is the primary operation. A rejected or temporarily
      // unavailable attachment must not roll back a valid player profile.
      attachmentFailures.push(attachment.field);
    }
  }

  await writeAuditLog({
    userId: user.id,
    action: "player.create",
    entityType: "Player",
    entityId: player.id,
    changes: { after: parsed }
  }).catch(() => {});

  const categorySlug = player.team?.category?.toLowerCase();
  revalidatePath("/[locale]/dashboard/players", "page");
  revalidatePath("/[locale]/dashboard/documents", "page");
  revalidatePath("/[locale]/team", "page");
  if (categorySlug) {
    revalidatePath(`/[locale]/team/${categorySlug}`, "page");
    revalidatePath(`/[locale]/team/${categorySlug}/players/${player.slug}`, "page");
  }
  return { id: player.id, positiveDrugTestDetected, attachmentFailures };
}

export async function updatePlayerAction(playerId: string, formData: FormData) {
  const user = await requirePermission("players.update");
  const medicalUpload = formData.get("drugTestFile");
  if (medicalUpload instanceof File && medicalUpload.size > 0) {
    throw new Error("ارفع الفحوصات الطبية من الملف الطبي للاعب.");
  }
  const scopeContext = await getMutationScopeContext();
  const before = await db.player.findUniqueOrThrow({ where: { id: playerId } });

  const raw = Object.fromEntries(formData.entries());
  const parsed = playerSchema.parse(raw);
  assertDualTeamScope(scopeContext, before.teamId, parsed.teamId, "Player");

  if (parsed.teamId) {
    const assignedTeam = await db.team.findUnique({ where: { id: parsed.teamId } });
    if (assignedTeam && assignedTeam.birthYearFrom != null) {
      const birthYear = parsed.dateOfBirth.getUTCFullYear();
      if (birthYear < assignedTeam.birthYearFrom) {
        throw new Error(
          `لا يمكن تسجيل اللاعب في هذه الفئة: سنة ميلاد اللاعب (${birthYear}) أكبر من الفئة العمرية المسموح بها (${assignedTeam.category}) التي تبدأ من سنة ${assignedTeam.birthYearFrom}.`
        );
      }
    }
  }

  const removePhoto = formData.get("removePhoto") === "true";
  const newPhotoUrl = await extractPlayerPhoto(formData);

  const player = await db.$transaction(async (tx) => {
    const updated = await tx.player.update({
      where: { id: playerId },
      data: {
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        firstNameFr: parsed.firstNameFr,
        lastNameFr: parsed.lastNameFr,
        position: parsed.position,
        nationality: parsed.nationality,
        dateOfBirth: parsed.dateOfBirth,
        teamId: parsed.teamId,
        shirtNumber: parsed.shirtNumber,
        height: parsed.height,
        weight: parsed.weight,
        previousTeam: parsed.previousTeam,
        placeOfBirth: parsed.placeOfBirth,
        bloodGroup: parsed.bloodGroup,
        birthCertificateNumber: parsed.birthCertificateNumber,
        licenceNumber: parsed.licenceNumber,
        preferredFoot: parsed.preferredFoot,
        joiningDate: parsed.joiningDate,
        status: parsed.status,
        internalNotes: parsed.internalNotes,
        ...(newPhotoUrl ? { photoUrl: newPhotoUrl } : removePhoto ? { photoUrl: null } : {})
      },
      include: { team: true }
    });

    for (const [translationLocale, biography] of [["ar", parsed.biographyAr], ["fr", parsed.biographyFr]] as const) {
      const normalizedBiography = biography?.trim() ?? "";
      if (normalizedBiography) {
        await tx.playerTranslation.upsert({
          where: { playerId_locale: { playerId, locale: translationLocale } },
          create: { playerId, locale: translationLocale, biography: normalizedBiography },
          update: { biography: normalizedBiography }
        });
      } else {
        await tx.playerTranslation.deleteMany({ where: { playerId, locale: translationLocale } });
      }
    }

    await writeAuditLog({
      userId: user.id,
      action: "player.update",
      entityType: "Player",
      entityId: updated.id,
      changes: { before, after: parsed }
    }, tx);

    return updated;
  });

  let positiveDrugTestDetected = false;
  const cniFile = formData.get("cniFile");
  if (cniFile instanceof File && cniFile.size > 0) {
    positiveDrugTestDetected = (await savePlayerAttachedDocument({
      playerId: player.id,
      teamId: player.teamId,
      file: cniFile,
      type: "CNI",
      playerName: `${player.firstName} ${player.lastName}`,
      userId: user.id
    })) || positiveDrugTestDetected;
  }

  const contractFile = formData.get("contractFile");
  if (contractFile instanceof File && contractFile.size > 0) {
    positiveDrugTestDetected = (await savePlayerAttachedDocument({
      playerId: player.id,
      teamId: player.teamId,
      file: contractFile,
      type: "CONTRACT",
      playerName: `${player.firstName} ${player.lastName}`,
      userId: user.id
    })) || positiveDrugTestDetected;
  }

  const birthCertificateFile = formData.get("birthCertificateFile");
  if (birthCertificateFile instanceof File && birthCertificateFile.size > 0) {
    positiveDrugTestDetected = (await savePlayerAttachedDocument({
      playerId: player.id,
      teamId: player.teamId,
      file: birthCertificateFile,
      type: "BIRTH_CERTIFICATE",
      playerName: `${player.firstName} ${player.lastName}`,
      userId: user.id
    })) || positiveDrugTestDetected;
  }

  if (newPhotoUrl && before.photoUrl) {
    await deletePublicFile(before.photoUrl).catch(() => {});
  }

  const categorySlug = player.team?.category?.toLowerCase();
  revalidatePath("/[locale]/dashboard/players", "page");
  revalidatePath(`/[locale]/dashboard/players/${playerId}`, "page");
  revalidatePath("/[locale]/dashboard/documents", "page");
  revalidatePath("/[locale]/team", "page");
  if (categorySlug) {
    revalidatePath(`/[locale]/team/${categorySlug}`, "page");
    revalidatePath(`/[locale]/team/${categorySlug}/players/${player.slug}`, "page");
  }
  return { id: player.id, positiveDrugTestDetected };
}

// Spec section 20 asks for Delete AND Archive. We implement "delete" from the
// UI as an archive (soft delete) by default — real hard-delete is reserved
// for Super Admin only and is a separate, explicitly-named action so it is
// never triggered accidentally.
export async function archivePlayerAction(playerId: string) {
  const user = await requirePermission("players.archive");
  const scopeContext = await getMutationScopeContext();
  const player = await db.player.findUniqueOrThrow({ where: { id: playerId }, include: { team: true } });
  assertTeamScope(scopeContext, player.teamId, "Player");

  const updated = await db.player.update({ where: { id: playerId }, data: { status: "ARCHIVED" } });

  await writeAuditLog({ userId: user.id, action: "player.archive", entityType: "Player", entityId: updated.id });
  const categorySlug = player.team?.category?.toLowerCase();
  revalidatePath("/[locale]/dashboard/players", "page");
  revalidatePath("/[locale]/team", "page");
  if (categorySlug) {
    revalidatePath(`/[locale]/team/${categorySlug}`, "page");
  }
}

export async function restorePlayerAction(playerId: string) {
  const user = await requirePermission("players.archive");
  const scopeContext = await getMutationScopeContext();
  const player = await db.player.findUniqueOrThrow({ where: { id: playerId }, include: { team: true } });
  assertTeamScope(scopeContext, player.teamId, "Player");
  if (player.status !== "ARCHIVED") return;

  const updated = await db.player.update({ where: { id: playerId }, data: { status: "ACTIVE" } });
  await writeAuditLog({ userId: user.id, action: "player.restore", entityType: "Player", entityId: updated.id });
  revalidatePath("/[locale]/dashboard/players", "page");
  revalidatePath("/[locale]/team", "page");
}

export async function hardDeletePlayerAction(playerId: string) {
  const user = await requirePermission("players.delete"); // granted to Super Admin only in seed data
  const scopeContext = await getMutationScopeContext();
  const player = await db.player.findUniqueOrThrow({ where: { id: playerId }, include: { team: true } });
  assertTeamScope(scopeContext, player.teamId, "Player");

  // Preserve historical match events while removing the player's live profile.
  // Explicitly detach restrictive foreign keys first so deletion cost and
  // behavior do not depend on an implicit database cascade.
  await db.$transaction(async (tx) => {
    await tx.matchEvent.updateMany({
      where: { playerId },
      data: {
        playerId: null,
        playerName: `${player.firstName} ${player.lastName}`,
        playerNameFr: [player.firstNameFr, player.lastNameFr].filter(Boolean).join(" ") || null
      }
    });
    await tx.matchShootoutKick.updateMany({ where: { playerId }, data: { playerId: null } });
    await tx.contract.updateMany({ where: { playerId }, data: { playerId: null } });
    await tx.correspondence.updateMany({ where: { relatedPlayerId: playerId }, data: { relatedPlayerId: null } });
    await tx.matchLineup.deleteMany({ where: { playerId } });
    await tx.trainingAttendance.deleteMany({ where: { playerId } });
    await tx.player.delete({ where: { id: playerId } });
  }, { timeout: 15000 });

  // Object storage is outside the database transaction. Delete it after the
  // profile commit so a slow storage provider cannot prevent the UI action.
  if (player.photoUrl) await deletePublicFile(player.photoUrl).catch(() => {});

  await writeAuditLog({ userId: user.id, action: "player.delete", entityType: "Player", entityId: playerId });
  const categorySlug = player.team?.category?.toLowerCase();
  revalidatePath("/[locale]/dashboard/players", "page");
  revalidatePath("/[locale]/team", "page");
  if (categorySlug) {
    revalidatePath(`/[locale]/team/${categorySlug}`, "page");
  }
}

export async function removePlayerPhotoAction(playerId: string) {
  const user = await requirePermission("players.update");
  const scopeContext = await getMutationScopeContext();
  const player = await db.player.findUniqueOrThrow({ where: { id: playerId }, include: { team: true } });
  assertTeamScope(scopeContext, player.teamId, "Player");

  if (player.photoUrl) {
    await deletePublicFile(player.photoUrl).catch(() => {});
  }

  await db.player.update({
    where: { id: playerId },
    data: { photoUrl: null }
  });

  await writeAuditLog({
    userId: user.id,
    action: "player.photo.delete",
    entityType: "Player",
    entityId: playerId,
    changes: { before: { photoUrl: player.photoUrl }, after: { photoUrl: null } }
  });

  const categorySlug = player.team?.category?.toLowerCase();
  revalidatePath("/[locale]/dashboard/players", "page");
  revalidatePath(`/[locale]/dashboard/players/${playerId}`, "page");
  revalidatePath("/[locale]/team", "page");
  if (categorySlug) {
    revalidatePath(`/[locale]/team/${categorySlug}`, "page");
    revalidatePath(`/[locale]/team/${categorySlug}/players/${player.slug}`, "page");
  }

  return { success: true };
}
