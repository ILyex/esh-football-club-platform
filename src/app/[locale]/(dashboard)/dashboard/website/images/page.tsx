import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions";
import { WebsiteAppearanceManager } from "@/components/dashboard/website-appearance-manager";
import { DashboardWelcomeBannerManager } from "@/components/dashboard/dashboard-welcome-banner-manager";
import { WebsiteImageSlotsManager } from "@/components/dashboard/website-image-slots-manager";

export default async function WebsiteImagesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requirePagePermission("settings.manage", locale);
  const settings = await db.clubSettings.findUnique({
    where: { id: "singleton" },
    select: { homepageHeroImageUrl: true, dashboardWelcomeBannerUrl: true, socialLinks: true }
  });
  const socialLinks = settings?.socialLinks && typeof settings.socialLinks === "object" && !Array.isArray(settings.socialLinks)
    ? settings.socialLinks as Record<string, unknown> : {};
  const websiteImages = socialLinks.websiteImages && typeof socialLinks.websiteImages === "object" && !Array.isArray(socialLinks.websiteImages)
    ? socialLinks.websiteImages as Record<string, string> : {};

  return (
    <div className="space-y-6">
      <header className="border-b border-border/70 pb-4">
        <h1 className="text-xl font-extrabold text-foreground">{locale === "ar" ? "إدارة صور الموقع" : "Gestion des images du site"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{locale === "ar" ? "حدّث صور واجهة الموقع وبانر الترحيب بلوحة الإدارة." : "Modifiez les images du site public et la bannière d’accueil du tableau de bord."}</p>
      </header>
      <WebsiteAppearanceManager locale={locale} currentImageUrl={settings?.homepageHeroImageUrl ?? null} />
      <DashboardWelcomeBannerManager locale={locale} currentImageUrl={settings?.dashboardWelcomeBannerUrl ?? null} />
      <WebsiteImageSlotsManager images={websiteImages} />
    </div>
  );
}
