"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { albumSchema } from "@/lib/validations/album";
import { writeAuditLog } from "@/lib/audit";
import { validateUploadedMedia, generatePublicStorageKey, uploadPublicFile, deletePublicFile } from "@/lib/storage";
import { getMutationScopeContext, assertTeamScope, assertDualTeamScope } from "@/lib/mutation-guards";
import { isVideoUrl } from "@/lib/media-utils";
import { revalidatePath } from "next/cache";

export async function createAlbumAction(formData: FormData) {
  const user = await requirePermission("gallery.manage");
  const scopeContext = await getMutationScopeContext();
  const raw = Object.fromEntries(formData.entries());
  const parsed = albumSchema.parse(raw);
  assertTeamScope(scopeContext, parsed.teamId || null, "Album");

  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);

  const album = await db.album.create({
    data: {
      name: parsed.name,
      description: parsed.description,
      category: parsed.category,
      teamId: parsed.teamId || null,
      published: parsed.published,
      createdById: user.id
    }
  });

  let firstImageUrl: string | null = null;
  let firstAnyUrl: string | null = null;
  let order = 0;
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { mime, ext, isVideo } = await validateUploadedMedia(buffer);
    const key = generatePublicStorageKey("gallery", ext);
    const url = await uploadPublicFile({ key, buffer, mimeType: mime });
    if (!firstAnyUrl) firstAnyUrl = url;
    if (!firstImageUrl && !isVideo) firstImageUrl = url;

    await db.media.create({
      data: {
        albumId: album.id,
        url,
        storageKey: key,
        order: order++
      }
    });
  }

  const coverImageUrl = firstImageUrl || firstAnyUrl;
  if (coverImageUrl) {
    await db.album.update({ where: { id: album.id }, data: { coverImageUrl } });
  }

  await writeAuditLog({ userId: user.id, action: "album.create", entityType: "Album", entityId: album.id, changes: { after: parsed } });
  revalidatePath("/[locale]/dashboard/gallery", "page");
  revalidatePath("/[locale]/gallery", "page");
  revalidatePath("/[locale]", "page");
  return { id: album.id };
}

export async function updateAlbumAction(albumId: string, formData: FormData) {
  const user = await requirePermission("gallery.manage");
  const scopeContext = await getMutationScopeContext();
  const before = await db.album.findUniqueOrThrow({ where: { id: albumId } });

  const raw = Object.fromEntries(formData.entries());
  const parsed = albumSchema.parse(raw);
  assertDualTeamScope(scopeContext, before.teamId, parsed.teamId || null, "Album");

  const album = await db.album.update({
    where: { id: albumId },
    data: {
      name: parsed.name,
      description: parsed.description,
      category: parsed.category,
      teamId: parsed.teamId || null,
      published: parsed.published
    }
  });

  await writeAuditLog({ userId: user.id, action: "album.update", entityType: "Album", entityId: album.id, changes: { before, after: parsed } });
  revalidatePath("/[locale]/dashboard/gallery", "page");
  revalidatePath(`/[locale]/dashboard/gallery/${albumId}`, "page");
  revalidatePath("/[locale]/gallery", "page");
  revalidatePath(`/[locale]/gallery/${albumId}`, "page");
  revalidatePath("/[locale]", "page");
}

export async function uploadMediaAction(albumId: string, formData: FormData) {
  const user = await requirePermission("gallery.manage");
  const scopeContext = await getMutationScopeContext();
  const album = await db.album.findUniqueOrThrow({ where: { id: albumId } });
  assertTeamScope(scopeContext, album.teamId, "Album");

  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return;

  const caption = String(formData.get("caption") ?? "");
  const currentMax = await db.media.aggregate({ where: { albumId }, _max: { order: true } });
  let order = (currentMax._max.order ?? -1) + 1;

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { mime, ext, isVideo } = await validateUploadedMedia(buffer);
    const key = generatePublicStorageKey("gallery", ext);
    const url = await uploadPublicFile({ key, buffer, mimeType: mime });

    const media = await db.media.create({ data: { albumId, url, storageKey: key, caption: caption || undefined, order: order++ } });
    await writeAuditLog({ userId: user.id, action: "media.upload", entityType: "Media", entityId: media.id });
  }

  // Use the first uploaded media as the album cover if it doesn't have one yet.
  if (!album.coverImageUrl) {
    const firstMedia = await db.media.findFirst({ where: { albumId }, orderBy: { order: "asc" } });
    if (firstMedia) await db.album.update({ where: { id: albumId }, data: { coverImageUrl: firstMedia.url } });
  }

  revalidatePath(`/[locale]/dashboard/gallery/${albumId}`, "page");
  revalidatePath("/[locale]/gallery", "page");
  revalidatePath(`/[locale]/gallery/${albumId}`, "page");
  revalidatePath("/[locale]", "page");
}

export async function deleteMediaAction(albumId: string, mediaId: string) {
  const user = await requirePermission("gallery.manage");
  const scopeContext = await getMutationScopeContext();
  const media = await db.media.findUniqueOrThrow({ where: { id: mediaId }, include: { album: true } });
  if (media.albumId !== albumId) {
    throw new Error("mediaAlbumMismatch");
  }
  assertTeamScope(scopeContext, media.album.teamId, "Album");

  await db.media.delete({ where: { id: mediaId } });
  await deletePublicFile(media.storageKey).catch(() => {});

  await writeAuditLog({ userId: user.id, action: "media.delete", entityType: "Media", entityId: mediaId });
  revalidatePath(`/[locale]/dashboard/gallery/${albumId}`, "page");
  revalidatePath("/[locale]/gallery", "page");
  revalidatePath(`/[locale]/gallery/${albumId}`, "page");
  revalidatePath("/[locale]", "page");
}

export async function setAlbumCoverAction(albumId: string, coverImageUrl: string) {
  const user = await requirePermission("gallery.manage");
  const scopeContext = await getMutationScopeContext();
  const album = await db.album.findUniqueOrThrow({ where: { id: albumId } });
  assertTeamScope(scopeContext, album.teamId, "Album");

  await db.album.update({
    where: { id: albumId },
    data: { coverImageUrl }
  });

  await writeAuditLog({ userId: user.id, action: "album.setCover", entityType: "Album", entityId: albumId });
  revalidatePath(`/[locale]/dashboard/gallery/${albumId}`, "page");
  revalidatePath("/[locale]/dashboard/gallery", "page");
  revalidatePath("/[locale]/gallery", "page");
  revalidatePath(`/[locale]/gallery/${albumId}`, "page");
}

export async function deleteAlbumAction(albumId: string) {
  const user = await requirePermission("gallery.manage");
  const scopeContext = await getMutationScopeContext();
  const album = await db.album.findUniqueOrThrow({ where: { id: albumId }, include: { media: true } });
  assertTeamScope(scopeContext, album.teamId, "Album");

  for (const m of album.media) {
    await deletePublicFile(m.storageKey).catch(() => {});
  }

  await db.album.delete({ where: { id: albumId } });
  await writeAuditLog({ userId: user.id, action: "album.delete", entityType: "Album", entityId: albumId });

  revalidatePath("/[locale]/dashboard/gallery", "page");
  revalidatePath("/[locale]/gallery", "page");
  revalidatePath("/[locale]", "page");
}
