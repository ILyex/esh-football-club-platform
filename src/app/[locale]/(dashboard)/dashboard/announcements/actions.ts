"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { announcementSchema } from "@/lib/validations/announcement";
import { writeAuditLog } from "@/lib/audit";
import { getMutationScopeContext, assertTeamScope, assertDualTeamScope } from "@/lib/mutation-guards";
import { validateUploadedImage, generatePublicStorageKey, uploadPublicFile, deletePublicFile } from "@/lib/storage";
import { revalidatePath } from "next/cache";

async function extractAllImages(formData: FormData): Promise<string[]> {
  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    const single = formData.get("image");
    if (single instanceof File && single.size > 0) files.push(single);
  }
  const urls: string[] = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { mime, ext } = await validateUploadedImage(buffer);
    const key = generatePublicStorageKey("announcements", ext);
    const url = await uploadPublicFile({ key, buffer, mimeType: mime });
    urls.push(url);
  }
  return urls;
}

export async function createAnnouncementAction(formData: FormData) {
  const user = await requirePermission("announcements.manage");
  const scopeContext = await getMutationScopeContext();

  const raw = Object.fromEntries(formData.entries());
  const parsed = announcementSchema.parse(raw);
  assertTeamScope(scopeContext, parsed.teamId || null, "Announcement");

  const uploadedUrls = await extractAllImages(formData);
  const imageUrl = uploadedUrls[0] ?? null;
  const imageUrls = uploadedUrls;

  const announcement = await db.announcement.create({
    data: {
      priority: parsed.priority,
      teamId: parsed.teamId || null,
      imageUrl,
      imageUrls,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      homepageVisibility: parsed.homepageVisibility,
      status: parsed.status,
      createdById: user.id,
      translations: {
        create: [
          { locale: "ar", title: parsed.titleAr, content: parsed.contentAr },
          { locale: "fr", title: parsed.titleFr, content: parsed.contentFr }
        ]
      }
    }
  });

  await writeAuditLog({
    userId: user.id,
    action: "announcement.create",
    entityType: "Announcement",
    entityId: announcement.id,
    changes: { after: parsed }
  });
  revalidatePath("/[locale]/dashboard/announcements", "page");
  revalidatePath("/[locale]", "page"); // homepage announcements section
  return { id: announcement.id };
}

export async function updateAnnouncementAction(announcementId: string, formData: FormData) {
  const user = await requirePermission("announcements.manage");
  const scopeContext = await getMutationScopeContext();
  const before = await db.announcement.findUniqueOrThrow({ where: { id: announcementId } });

  const raw = Object.fromEntries(formData.entries());
  const parsed = announcementSchema.parse(raw);
  assertDualTeamScope(scopeContext, before.teamId, parsed.teamId || null, "Announcement");

  const newUploadedUrls = await extractAllImages(formData);
  const removedImages = formData.getAll("removedImages").map(String);

  for (const removedUrl of removedImages) {
    await deletePublicFile(removedUrl).catch(() => {});
  }

  const remainingImages = (before.imageUrls || []).filter((u) => !removedImages.includes(u));
  const combinedImageUrls = [...remainingImages, ...newUploadedUrls];
  const newImageUrl = combinedImageUrls[0] ?? (newUploadedUrls[0] ?? before.imageUrl);

  const announcement = await db.announcement.update({
    where: { id: announcementId },
    data: {
      priority: parsed.priority,
      teamId: parsed.teamId || null,
      imageUrl: newImageUrl,
      imageUrls: combinedImageUrls,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      homepageVisibility: parsed.homepageVisibility,
      status: parsed.status,
      translations: {
        upsert: [
          {
            where: { announcementId_locale: { announcementId, locale: "ar" } },
            update: { title: parsed.titleAr, content: parsed.contentAr },
            create: { locale: "ar", title: parsed.titleAr, content: parsed.contentAr }
          },
          {
            where: { announcementId_locale: { announcementId, locale: "fr" } },
            update: { title: parsed.titleFr, content: parsed.contentFr },
            create: { locale: "fr", title: parsed.titleFr, content: parsed.contentFr }
          }
        ]
      }
    }
  });

  await writeAuditLog({
    userId: user.id,
    action: "announcement.update",
    entityType: "Announcement",
    entityId: announcement.id,
    changes: { before, after: parsed }
  });
  revalidatePath("/[locale]/dashboard/announcements", "page");
  revalidatePath("/[locale]", "page");
  return { id: announcement.id };
}

export async function archiveAnnouncementAction(announcementId: string) {
  const user = await requirePermission("announcements.manage");
  const scopeContext = await getMutationScopeContext();
  const before = await db.announcement.findUniqueOrThrow({ where: { id: announcementId } });
  assertTeamScope(scopeContext, before.teamId, "Announcement");

  const announcement = await db.announcement.update({ where: { id: announcementId }, data: { status: "ARCHIVED" } });

  await writeAuditLog({ userId: user.id, action: "announcement.archive", entityType: "Announcement", entityId: announcement.id });
  revalidatePath("/[locale]/dashboard/announcements", "page");
  revalidatePath("/[locale]", "page");
}

export async function setAnnouncementStatusAction(announcementId: string, status: "PUBLISHED" | "DRAFT") {
  const user = await requirePermission("announcements.manage");
  const scopeContext = await getMutationScopeContext();
  const before = await db.announcement.findUniqueOrThrow({ where: { id: announcementId } });
  assertTeamScope(scopeContext, before.teamId, "Announcement");

  await db.announcement.update({
    where: { id: announcementId },
    data: { status }
  });

  await writeAuditLog({
    userId: user.id,
    action: `announcement.${status === "PUBLISHED" ? "publish" : "hide"}`,
    entityType: "Announcement",
    entityId: announcementId
  });

  revalidatePath("/[locale]/dashboard/announcements", "page");
  revalidatePath("/[locale]", "page");
}

export async function deleteAnnouncementAction(announcementId: string) {
  const user = await requirePermission("announcements.manage");
  const scopeContext = await getMutationScopeContext();
  const before = await db.announcement.findUniqueOrThrow({ where: { id: announcementId } });
  assertTeamScope(scopeContext, before.teamId, "Announcement");

  if (before.imageUrl) await deletePublicFile(before.imageUrl).catch(() => {});
  for (const u of before.imageUrls || []) {
    await deletePublicFile(u).catch(() => {});
  }

  await db.announcement.delete({ where: { id: announcementId } });

  await writeAuditLog({
    userId: user.id,
    action: "announcement.delete",
    entityType: "Announcement",
    entityId: announcementId
  });

  revalidatePath("/[locale]/dashboard/announcements", "page");
  revalidatePath("/[locale]", "page");
}
