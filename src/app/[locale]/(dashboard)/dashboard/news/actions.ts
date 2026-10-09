"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { newsSchema } from "@/lib/validations/news";
import { writeAuditLog } from "@/lib/audit";
import { slugify } from "@/lib/utils";
import { validateUploadedMedia, generatePublicStorageKey, uploadPublicFile, deletePublicFile } from "@/lib/storage";
import { isVideoUrl } from "@/lib/media-utils";
import { revalidatePath } from "next/cache";

async function uniqueNewsSlug(locale: string, title: string, excludeNewsId?: string): Promise<string> {
  const base = slugify(title);
  let slug = base;
  let suffix = 1;
  while (
    await db.newsTranslation.findFirst({
      where: { locale, slug, ...(excludeNewsId ? { newsId: { not: excludeNewsId } } : {}) }
    })
  ) {
    slug = `${base}-${++suffix}`;
  }
  return slug;
}

async function extractAllMedia(formData: FormData): Promise<string[]> {
  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    const single = formData.get("featuredImage");
    if (single instanceof File && single.size > 0) files.push(single);
  }
  const urls: string[] = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { mime, ext } = await validateUploadedMedia(buffer);
    const key = generatePublicStorageKey("news", ext);
    const url = await uploadPublicFile({ key, buffer, mimeType: mime });
    urls.push(url);
  }
  return urls;
}

export async function createNewsAction(formData: FormData) {
  const user = await requirePermission("news.create");
  const raw = Object.fromEntries(formData.entries());
  const parsed = newsSchema.parse(raw);
  const uploadedUrls = await extractAllMedia(formData);
  // Pick first image for poster/thumbnail if available, else first media item
  const firstImage = uploadedUrls.find((u) => !isVideoUrl(u));
  const featuredImageUrl = firstImage ?? uploadedUrls[0] ?? undefined;
  const imageUrls = uploadedUrls;

  const [slugAr, slugFr] = await Promise.all([uniqueNewsSlug("ar", parsed.titleAr), uniqueNewsSlug("fr", parsed.titleFr)]);

  const news = await db.news.create({
    data: {
      authorId: user.id,
      category: parsed.category,
      tags: parsed.tags ? parsed.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      status: parsed.status,
      featuredImageUrl,
      imageUrls,
      publishedAt: parsed.status === "PUBLISHED" ? new Date() : null,
      scheduledFor: parsed.status === "SCHEDULED" ? parsed.scheduledFor : null,
      translations: {
        create: [
          { locale: "ar", title: parsed.titleAr, slug: slugAr, content: parsed.contentAr },
          { locale: "fr", title: parsed.titleFr, slug: slugFr, content: parsed.contentFr }
        ]
      }
    }
  });

  await writeAuditLog({ userId: user.id, action: "news.create", entityType: "News", entityId: news.id, changes: { after: parsed } });
  revalidatePath("/[locale]/dashboard/news", "page");
  revalidatePath("/[locale]/news", "page");
  revalidatePath("/[locale]", "page");
  return { id: news.id };
}

export async function updateNewsAction(newsId: string, formData: FormData) {
  const user = await requirePermission("news.update");
  const before = await db.news.findUniqueOrThrow({ where: { id: newsId }, include: { translations: true } });

  const raw = Object.fromEntries(formData.entries());
  const parsed = newsSchema.parse(raw);
  const newUploadedUrls = await extractAllMedia(formData);
  const removedImages = formData.getAll("removedImages").map(String);

  // Compute remaining previous images
  const remainingImages = (before.imageUrls || []).filter((u) => !removedImages.includes(u));
  const combinedImageUrls = [...remainingImages, ...newUploadedUrls];
  const firstImage = combinedImageUrls.find((u) => !isVideoUrl(u));
  const newFeaturedImageUrl = firstImage ?? combinedImageUrls[0] ?? (newUploadedUrls[0] ?? before.featuredImageUrl);

  // Delete removed files from storage
  for (const removedUrl of removedImages) {
    await deletePublicFile(removedUrl).catch(() => {});
  }

  const currentAr = before.translations.find((t) => t.locale === "ar");
  const currentFr = before.translations.find((t) => t.locale === "fr");
  const slugAr = currentAr?.title === parsed.titleAr ? currentAr.slug : await uniqueNewsSlug("ar", parsed.titleAr, newsId);
  const slugFr = currentFr?.title === parsed.titleFr ? currentFr.slug : await uniqueNewsSlug("fr", parsed.titleFr, newsId);

  const news = await db.news.update({
    where: { id: newsId },
    data: {
      category: parsed.category,
      tags: parsed.tags ? parsed.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      status: parsed.status,
      featuredImageUrl: newFeaturedImageUrl,
      imageUrls: combinedImageUrls,
      // Publishing is an explicit action: always stamp the current time so a
      // stale/future date from an earlier schedule cannot hide the article.
      publishedAt: parsed.status === "PUBLISHED" ? new Date() : null,
      scheduledFor: parsed.status === "SCHEDULED" ? parsed.scheduledFor : null,
      translations: {
        upsert: [
          {
            where: { newsId_locale: { newsId, locale: "ar" } },
            update: { title: parsed.titleAr, slug: slugAr, content: parsed.contentAr },
            create: { locale: "ar", title: parsed.titleAr, slug: slugAr, content: parsed.contentAr }
          },
          {
            where: { newsId_locale: { newsId, locale: "fr" } },
            update: { title: parsed.titleFr, slug: slugFr, content: parsed.contentFr },
            create: { locale: "fr", title: parsed.titleFr, slug: slugFr, content: parsed.contentFr }
          }
        ]
      }
    }
  });

  await writeAuditLog({ userId: user.id, action: "news.update", entityType: "News", entityId: news.id, changes: { before, after: parsed } });
  revalidatePath("/[locale]/dashboard/news", "page");
  revalidatePath("/[locale]/news", "page");
  revalidatePath(`/[locale]/news/${slugAr}`, "page");
  revalidatePath(`/[locale]/news/${slugFr}`, "page");
  revalidatePath("/[locale]", "page");
  return { id: news.id };
}

export async function setNewsStatusAction(newsId: string, status: "PUBLISHED" | "DRAFT" | "ARCHIVED") {
  const user = await requirePermission("news.publish");
  const before = await db.news.findUniqueOrThrow({ where: { id: newsId } });

  const news = await db.news.update({
    where: { id: newsId },
    data: { status, publishedAt: status === "PUBLISHED" ? new Date() : null }
  });

  await writeAuditLog({ userId: user.id, action: `news.${status.toLowerCase()}`, entityType: "News", entityId: news.id });
  revalidatePath("/[locale]/dashboard/news", "page");
  revalidatePath("/[locale]/news", "page");
  revalidatePath("/[locale]", "page");
}

export async function deleteNewsAction(newsId: string) {
  const user = await requirePermission("news.delete");
  const news = await db.news.findUniqueOrThrow({ where: { id: newsId } });

  if (news.featuredImageUrl) {
    await deletePublicFile(news.featuredImageUrl).catch(() => {});
  }

  await db.news.delete({ where: { id: newsId } });

  await writeAuditLog({
    userId: user.id,
    action: "news.delete",
    entityType: "News",
    entityId: newsId
  });

  revalidatePath("/[locale]/dashboard/news", "page");
  revalidatePath("/[locale]/news", "page");
  revalidatePath("/[locale]", "page");
}
