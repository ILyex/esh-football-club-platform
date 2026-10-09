import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions";
import { readSocialReels } from "@/lib/social-reels";
import { WebsiteSocialLinksManager } from "@/components/dashboard/website-social-links-manager";
import { WebsiteSocialReelsManager } from "@/components/dashboard/website-social-reels-manager";
import { getSocialReelMetadataAction, updateWebsiteSocialLinksAction, updateWebsiteSocialReelsAction } from "../actions";

export default async function WebsiteReelsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requirePagePermission("settings.manage", locale);
  const websiteSettings = await db.clubSettings.findUnique({
    where: { id: "singleton" },
    select: { socialLinks: true }
  });
  const rawLinks = websiteSettings?.socialLinks && typeof websiteSettings.socialLinks === "object" && !Array.isArray(websiteSettings.socialLinks)
    ? websiteSettings.socialLinks as Record<string, unknown>
    : {};
  const socialLinks = {
    facebook: typeof rawLinks.facebook === "string" ? rawLinks.facebook : undefined,
    instagram: typeof rawLinks.instagram === "string" ? rawLinks.instagram : undefined,
    tiktok: typeof rawLinks.tiktok === "string" ? rawLinks.tiktok : undefined
  };

  return (
    <div className="space-y-6">
      <header className="border-b border-border/70 pb-4">
        <h1 className="text-xl font-extrabold text-foreground">{locale === "ar" ? "إدارة الريلز" : "Gestion des Reels"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{locale === "ar" ? "أدر روابط حسابات النادي ومقاطع الفيديو التي تظهر في الرئيسية والمعرض." : "Gérez les comptes du club et les vidéos affichées sur l’accueil et dans la galerie."}</p>
      </header>
      <WebsiteSocialLinksManager locale={locale} socialLinks={socialLinks} action={updateWebsiteSocialLinksAction} />
      <WebsiteSocialReelsManager locale={locale} reels={readSocialReels(websiteSettings?.socialLinks)} action={updateWebsiteSocialReelsAction} metadataAction={getSocialReelMetadataAction} />
    </div>
  );
}
