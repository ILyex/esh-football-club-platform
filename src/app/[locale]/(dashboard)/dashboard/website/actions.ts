"use server";

import { requirePermission } from "@/lib/permissions";
import { getWebsiteAnalytics } from "@/lib/analytics";
import { isAIConfigured, runAICompletion } from "@/lib/ai/provider";
import { AIError } from "@/lib/ai/types";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { generatePublicStorageKey, uploadPublicFile, validateUploadedImage, validateUploadedBannerImage, validateUploadedMedia } from "@/lib/storage";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { identifySocialReel, readSocialReels, type SocialReel } from "@/lib/social-reels";
import { resolveSocialReelMetadata } from "@/lib/social-reel-metadata";

const websiteSocialLinksSchema = z.object({
  facebookUrl: z.string().url().max(300).optional().or(z.literal("")),
  instagramUrl: z.string().url().max(300).optional().or(z.literal("")),
  tiktokUrl: z.string().url().max(300).optional().or(z.literal(""))
});

export async function updateWebsiteSocialLinksAction(formData: FormData): Promise<{ success: boolean; changed?: boolean; error?: string }> {
  const user = await requirePermission("settings.manage");
  const parsed = websiteSocialLinksSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { success: false, error: "تحقق من صحة روابط المنصات قبل الحفظ." };

  const before = await db.clubSettings.findUnique({ where: { id: "singleton" }, select: { socialLinks: true } });
  const socialLinks = {
    ...(before?.socialLinks && typeof before.socialLinks === "object" && !Array.isArray(before.socialLinks) ? before.socialLinks as Record<string, unknown> : {}),
    facebook: parsed.data.facebookUrl || undefined,
    instagram: parsed.data.instagramUrl || undefined,
    tiktok: parsed.data.tiktokUrl || undefined
  };
  const normalize = (value: unknown) => typeof value === "string" ? value : "";
  const unchanged = normalize((before?.socialLinks as Record<string, unknown> | null)?.facebook) === normalize(socialLinks.facebook)
    && normalize((before?.socialLinks as Record<string, unknown> | null)?.instagram) === normalize(socialLinks.instagram)
    && normalize((before?.socialLinks as Record<string, unknown> | null)?.tiktok) === normalize(socialLinks.tiktok);
  if (unchanged) return { success: true, changed: false };
  await db.clubSettings.update({ where: { id: "singleton" }, data: { socialLinks: socialLinks as unknown as Prisma.InputJsonObject } });
  await writeAuditLog({ userId: user.id, action: "website.social_links.update", entityType: "ClubSettings", entityId: "singleton", changes: { before: before?.socialLinks ?? null, after: socialLinks } });
  revalidatePath("/[locale]", "layout");
  revalidatePath("/[locale]/dashboard/website/reels", "page");
  return { success: true };
}

const socialReelsInputSchema = z.array(z.object({
  id: z.string().min(1).max(80),
  url: z.string().url().max(500),
  title: z.string().trim().min(1).max(160)
})).max(24);

export async function getSocialReelMetadataAction(value: string): Promise<{
  success: boolean;
  url?: string;
  title?: string;
  id?: string;
  platform?: SocialReel["platform"];
  error?: string;
}> {
  await requirePermission("settings.manage");
  let submitted: URL;
  try {
    submitted = new URL(value.trim());
  } catch {
    return { success: false, error: "أدخل رابط فيديو صحيحاً." };
  }
  const host = submitted.hostname.toLowerCase().replace(/^www\./, "");
  const platform: SocialReel["platform"] | null =
    host === "tiktok.com" || host === "vm.tiktok.com" ? "tiktok"
      : host === "instagram.com" ? "instagram"
        : host === "facebook.com" || host === "m.facebook.com" || host === "fb.watch" ? "facebook"
          : null;
  if (submitted.protocol !== "https:" || !platform) {
    return { success: false, error: "أدخل رابط HTTPS عاماً من TikTok أو Instagram أو Facebook." };
  }

  try {
    const metadata = await resolveSocialReelMetadata(submitted.toString(), platform);
    const detected = identifySocialReel(metadata.url);
    if (!detected || detected.platform !== platform) {
      return { success: false, error: "لم نتمكن من تحديد الفيديو من الرابط. استخدم رابط الريل المباشر." };
    }
    return { success: true, ...metadata, id: `${platform}-${detected.id}`, platform };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "تعذر جلب عنوان الفيديو من المنصة." };
  }
}

async function normalizeFacebookReelUrl(value: string): Promise<string> {
  let submitted = new URL(value);
  const host = submitted.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== "facebook.com" || !/^\/share\/(?:r|v)\/[A-Za-z0-9_-]+\/?$/i.test(submitted.pathname)) return value;

  // SECURITY FIX: Validate each redirect destination before requesting it to prevent SSRF.
  const allowedHosts = new Set(["facebook.com", "m.facebook.com"]);
  let response: Response | null = null;
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    const currentHost = submitted.hostname.toLowerCase().replace(/^www\./, "");
    if (submitted.protocol !== "https:" || submitted.username || submitted.password || !allowedHosts.has(currentHost)) {
      throw new Error("رابط مشاركة Facebook أعاد توجيهاً إلى مضيف غير مسموح.");
    }
    response = await fetch(submitted, {
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; ClubWebsite/1.0)" },
      cache: "no-store"
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get("location");
    await response.body?.cancel().catch(() => undefined);
    if (!location || redirects === 5) throw new Error("تعذر تتبع رابط مشاركة Facebook.");
    submitted = new URL(location, submitted);
  }
  if (!response?.ok) {
    throw new Error("تعذر الوصول إلى رابط مشاركة Facebook. تأكد أن الفيديو عام ثم أعد نسخ رابط الريل المباشر.");
  }

  const resolved = submitted;
  const detected = identifySocialReel(resolved.toString());
  if (detected?.platform !== "facebook" || !/^\d+$/.test(detected.id)) {
    throw new Error("لم نتمكن من استخراج رابط الريل المباشر من Facebook. استخدم خيار نسخ رابط الريل نفسه.");
  }

  const canonicalPath = resolved.pathname.match(/\/(?:reel|videos)\/\d+/i)?.[0];
  if (!canonicalPath) {
    throw new Error("رابط Facebook لا يشير إلى ريل أو فيديو مباشر.");
  }
  return `https://www.facebook.com${canonicalPath}/`;
}

export async function updateWebsiteSocialReelsAction(formData: FormData): Promise<{ success: boolean; changed?: boolean; error?: string; reels?: SocialReel[] }> {
  const user = await requirePermission("settings.manage");
  let input: unknown;
  try {
    input = JSON.parse(String(formData.get("reels") ?? "[]"));
  } catch {
    return { success: false, error: "قائمة الفيديوهات غير صالحة." };
  }
  const parsed = socialReelsInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "تحقق من روابط الفيديو قبل الحفظ." };

  const reels: SocialReel[] = [];
  for (const item of parsed.data) {
    let normalizedUrl = item.url;
    try {
      normalizedUrl = await normalizeFacebookReelUrl(item.url);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "تعذر التحقق من رابط Facebook." };
    }
    const detected = identifySocialReel(normalizedUrl);
    if (!detected) return { success: false, error: "الرابط غير مدعوم. أضف رابط فيديو من TikTok أو Instagram أو Facebook." };
    reels.push({ ...item, id: `${detected.platform}-${detected.id}`, url: normalizedUrl, platform: detected.platform, createdAt: new Date().toISOString() });
  }

  const before = await db.clubSettings.findUnique({ where: { id: "singleton" }, select: { socialLinks: true } });
  const current = before?.socialLinks && typeof before.socialLinks === "object" && !Array.isArray(before.socialLinks)
    ? before.socialLinks as Record<string, unknown>
    : {};
  const previousReels = readSocialReels(current);
  const savedReels = reels.map((reel) => {
    const previous = previousReels.find((candidate) => candidate.id === reel.id);
    return previous ? { ...reel, createdAt: previous.createdAt } : reel;
  });
  const previousComparable = previousReels.map(({ id, url, title }) => ({ id, url, title }));
  const nextComparable = savedReels.map(({ id, url, title }) => ({ id, url, title }));
  if (JSON.stringify(previousComparable) === JSON.stringify(nextComparable)) return { success: true, changed: false };
  const socialLinks = { ...current, reels: savedReels };
  await db.clubSettings.update({ where: { id: "singleton" }, data: { socialLinks: socialLinks as unknown as Prisma.InputJsonObject } });
  await writeAuditLog({
    userId: user.id,
    action: "website.social_reels.update",
    entityType: "ClubSettings",
    entityId: "singleton",
    changes: { beforeCount: previousReels.length, afterCount: savedReels.length }
  });
  revalidatePath("/[locale]", "layout");
  revalidatePath("/[locale]/gallery", "page");
  revalidatePath("/[locale]/dashboard/website/reels", "page");
  return { success: true, reels: savedReels };
}

export async function updateHomepageHeroImageAction(formData: FormData): Promise<{ success: boolean; imageUrl?: string; error?: string; warning?: string }> {
  const user = await requirePermission("settings.manage");
  const file = formData.get("heroImage");
  if (!(file instanceof File) || file.size === 0) return { success: false, error: "اختر صورة صالحة أولاً." };
  if (file.size > 20 * 1024 * 1024) return { success: false, error: "حجم فيديو الهيدر يجب ألا يتجاوز 20 ميغابايت. الصور بحد أقصى 8 ميغابايت." };
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { mime, ext, isVideo } = await validateUploadedMedia(buffer);
    if (isVideo && mime !== "video/mp4") return { success: false, error: "صيغة فيديو الهيدر المدعومة هي MP4 لضمان تشغيله على الهواتف والمتصفحات." };
    const imageUrl = await uploadPublicFile({
      key: generatePublicStorageKey("branding/site-hero", ext), buffer, mimeType: mime
    });
    const before = await db.clubSettings.findUnique({ where: { id: "singleton" }, select: { homepageHeroImageUrl: true } });
    await db.clubSettings.update({ where: { id: "singleton" }, data: { homepageHeroImageUrl: imageUrl } });
    await writeAuditLog({
      userId: user.id,
      action: "website.hero_media.update",
      entityType: "ClubSettings",
      entityId: "singleton",
      changes: { before: before?.homepageHeroImageUrl ?? null, after: imageUrl, mediaType: isVideo ? "video" : "image" }
    });
    revalidatePath("/[locale]", "layout");
    revalidatePath("/[locale]/dashboard/website/images", "page");
    return { success: true, imageUrl };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "تعذر حفظ الصورة." };
  }
}

export async function updateDashboardWelcomeBannerAction(formData: FormData): Promise<{ success: boolean; imageUrl?: string; error?: string; warning?: string }> {
  const user = await requirePermission("settings.manage");
  const file = formData.get("bannerImage");
  if (!(file instanceof File) || file.size === 0) return { success: false, error: "اختر صورة أو فيديو صالحاً أولاً." };
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { mime, ext } = await validateUploadedBannerImage(buffer);
    const imageUrl = await uploadPublicFile({
      key: generatePublicStorageKey("branding/dashboard-welcome", ext), buffer, mimeType: mime
    });
    const before = await db.clubSettings.findUnique({ where: { id: "singleton" }, select: { dashboardWelcomeBannerUrl: true } });
    await db.clubSettings.update({ where: { id: "singleton" }, data: { dashboardWelcomeBannerUrl: imageUrl } });
    await writeAuditLog({
      userId: user.id,
      action: "website.dashboard_banner.update",
      entityType: "ClubSettings",
      entityId: "singleton",
      changes: { before: before?.dashboardWelcomeBannerUrl ?? null, after: imageUrl }
    });
    revalidatePath("/[locale]/dashboard", "page");
    revalidatePath("/[locale]/dashboard/website/images", "page");
    return { success: true, imageUrl };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "تعذر حفظ صورة البانر." };
  }
}

const websiteImageSlots = {
  teamSenior: { storageKey: "team-senior", label: "فريق الأكابر" },
  teamU20: { storageKey: "team-u20", label: "فريق U20" },
  teamU17: { storageKey: "team-u17", label: "فريق U17" },
  teamU15: { storageKey: "team-u15", label: "فريق U15" },
  introPoster: { storageKey: "intro-poster", label: "ملصق فيديو التعريف" }
} as const;

export type WebsiteImageSlot = keyof typeof websiteImageSlots;

export async function updateWebsiteImageSlotAction(formData: FormData): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  const user = await requirePermission("settings.manage");
  const slot = formData.get("slot");
  const file = formData.get("image");
  if (typeof slot !== "string" || !(slot in websiteImageSlots)) return { success: false, error: "نوع الصورة غير مدعوم." };
  if (!(file instanceof File) || file.size === 0) return { success: false, error: "اختر صورة أو فيديو صالحاً أولاً." };
  // Vercel rejects function requests over 4.5MB before they reach Next.js.
  // Keep a margin for multipart/server-action overhead so users get a clear error.
  const onVercel = process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
  if (onVercel && file.size > 4 * 1024 * 1024) {
    return { success: false, error: "حجم الملف على الاستضافة الحالية يجب ألا يتجاوز 4 ميغابايت." };
  }
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { mime, ext } = await validateUploadedMedia(buffer);
    const config = websiteImageSlots[slot as WebsiteImageSlot];
    const imageUrl = await uploadPublicFile({ key: generatePublicStorageKey(`branding/${config.storageKey}`, ext), buffer, mimeType: mime });
    const before = await db.clubSettings.findUnique({ where: { id: "singleton" }, select: { socialLinks: true } });
    const current = before?.socialLinks && typeof before.socialLinks === "object" && !Array.isArray(before.socialLinks)
      ? before.socialLinks as Record<string, unknown> : {};
    const currentWebsiteImages = current.websiteImages && typeof current.websiteImages === "object" && !Array.isArray(current.websiteImages)
      ? current.websiteImages as Record<string, unknown> : {};
    const websiteImages = { ...currentWebsiteImages, [slot]: imageUrl };
    await db.clubSettings.update({ where: { id: "singleton" }, data: { socialLinks: { ...current, websiteImages } as Prisma.InputJsonObject } });
    await writeAuditLog({ userId: user.id, action: "website.image.update", entityType: "ClubSettings", entityId: "singleton", changes: { slot, label: config.label, before: currentWebsiteImages[slot] ?? null, after: imageUrl } });
    revalidatePath("/[locale]", "layout");
    revalidatePath("/[locale]/team", "page");
    revalidatePath("/[locale]/team/[category]", "page");
    revalidatePath("/[locale]/dashboard/website/images", "page");
    return { success: true, imageUrl };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "تعذر حفظ الصورة." };
  }
}

export async function summarizeWebsiteAnalytics(): Promise<{ ok: true; summary: string; aiFallback?: "quota" | "unavailable" } | { ok: false; error: string }> {
  await requirePermission("news.view");
  if (!isAIConfigured()) return { ok: false, error: "الذكاء الاصطناعي غير متاح حالياً." };
  const analytics = await getWebsiteAnalytics();
  const hasCaptchaData = Object.values(analytics.captcha).some((count) => count > 0);
  if (!analytics.hasData && !hasCaptchaData) return { ok: false, error: "لا توجد أحداث مسجلة لتحليلها بعد." };

  const facts = {
    periodDays: 14,
    visitors: analytics.totalVisitors,
    pageViews: analytics.totalPageViews,
    clicks: analytics.totalClicks,
    daily: analytics.dailyTraffic,
    topPages: analytics.topPages,
    devices: analytics.deviceBreakdown.map(({ device, visits }) => ({ device, visits })),
    referrers: analytics.referrerBreakdown,
    captcha: analytics.captcha
  };
  try {
    const summary = await runAICompletion({
      system: "أنت مساعد تحليلي محلي. لخّص البيانات الرقمية الموثقة التي يرسلها النظام فقط. لا تخترع أرقاماً أو نسباً أو أسباباً، واذكر بوضوح أي استنتاج وصفي محدود. أجب بالعربية في ثلاث نقاط قصيرة.",
      input: `لخّص هذه الإحصاءات المسجلة فقط، ولا تضف أي أرقام غير موجودة:\n${JSON.stringify(facts)}`,
      maxTokens: 220,
      // Local models can need several seconds to load into memory on the
      // first request. The previous 8s limit aborted valid analyses midway.
      timeoutMs: 30_000
    });
    return { ok: true, summary };
  } catch (error) {
    const fallbackSummary = `خلال آخر 14 يوماً: ${analytics.totalVisitors} زائراً فريداً، و${analytics.totalPageViews} مشاهدة صفحة، و${analytics.totalClicks} نقرة. هذه أرقام مسجلة مباشرة؛ لا يتوفر تحليل إضافي حالياً.`;
    return {
      ok: true,
      summary: fallbackSummary,
      aiFallback: error instanceof AIError && error.code === "AI_QUOTA_EXHAUSTED" ? "quota" : "unavailable"
    };
  }
}
