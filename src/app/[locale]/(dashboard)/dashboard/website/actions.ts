"use server";

import { requirePermission } from "@/lib/permissions";
import { getWebsiteAnalytics } from "@/lib/analytics";
import { isAIConfigured, runAICompletion } from "@/lib/ai/provider";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { generatePublicStorageKey, uploadPublicFile, validateUploadedImage, validateUploadedBannerImage } from "@/lib/storage";
import { revalidatePath } from "next/cache";

export async function updateHomepageHeroImageAction(formData: FormData): Promise<{ success: boolean; imageUrl?: string; error?: string; warning?: string }> {
  const user = await requirePermission("settings.manage");
  const file = formData.get("heroImage");
  if (!(file instanceof File) || file.size === 0) return { success: false, error: "اختر صورة صالحة أولاً." };
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { mime, ext } = await validateUploadedImage(buffer);
    const imageUrl = await uploadPublicFile({
      key: generatePublicStorageKey("branding/site-hero", ext), buffer, mimeType: mime
    });
    const before = await db.clubSettings.findUnique({ where: { id: "singleton" }, select: { homepageHeroImageUrl: true } });
    await db.clubSettings.update({ where: { id: "singleton" }, data: { homepageHeroImageUrl: imageUrl } });
    await writeAuditLog({
      userId: user.id,
      action: "website.hero_image.update",
      entityType: "ClubSettings",
      entityId: "singleton",
      changes: { before: before?.homepageHeroImageUrl ?? null, after: imageUrl }
    });
    revalidatePath("/[locale]", "layout");
    revalidatePath("/[locale]/dashboard/website", "page");
    return { success: true, imageUrl };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "تعذر حفظ الصورة." };
  }
}

export async function updateDashboardWelcomeBannerAction(formData: FormData): Promise<{ success: boolean; imageUrl?: string; error?: string; warning?: string }> {
  const user = await requirePermission("settings.manage");
  const file = formData.get("bannerImage");
  if (!(file instanceof File) || file.size === 0) return { success: false, error: "اختر صورة صالحة أولاً." };
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
    revalidatePath("/[locale]/dashboard/website", "page");
    return { success: true, imageUrl };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "تعذر حفظ صورة البانر." };
  }
}

export async function summarizeWebsiteAnalytics(): Promise<{ ok: true; summary: string } | { ok: false; error: string }> {
  await requirePermission("news.view");
  if (!isAIConfigured()) return { ok: false, error: "الذكاء المحلي غير مهيأ حالياً." };
  const analytics = await getWebsiteAnalytics();
  if (!analytics.hasData) return { ok: false, error: "لا توجد أحداث مسجلة لتحليلها بعد." };

  const facts = {
    periodDays: 14,
    visitors: analytics.totalVisitors,
    pageViews: analytics.totalPageViews,
    clicks: analytics.totalClicks,
    daily: analytics.dailyTraffic,
    topPages: analytics.topPages,
    devices: analytics.deviceBreakdown.map(({ device, visits }) => ({ device, visits })),
    referrers: analytics.referrerBreakdown
  };
  try {
    const summary = await runAICompletion({
      system: "أنت مساعد تحليلي محلي. لخّص البيانات الرقمية الموثقة التي يرسلها النظام فقط. لا تخترع أرقاماً أو نسباً أو أسباباً، واذكر بوضوح أي استنتاج وصفي محدود. أجب بالعربية في ثلاث نقاط قصيرة.",
      input: `لخّص هذه الإحصاءات المسجلة فقط، ولا تضف أي أرقام غير موجودة:\n${JSON.stringify(facts)}`,
      maxTokens: 220,
      timeoutMs: 8000
    });
    return { ok: true, summary };
  } catch {
    return { ok: false, error: "تعذر الاتصال بالذكاء المحلي. الأرقام المسجلة ما زالت متاحة." };
  }
}
