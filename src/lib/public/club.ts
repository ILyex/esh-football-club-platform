import "server-only";
import { db } from "@/lib/db";
import { readSocialReels, type SocialReel } from "@/lib/social-reels";
import { normalizePublicMediaUrl } from "@/lib/media-utils";

// ============================================================================
// PUBLIC CLUB SETTINGS DATA ACCESS
// ----------------------------------------------------------------------------
// Strictly projects public-safe settings. Never leaks internal IDs or audit fields.
// ============================================================================

export interface PublicClubSettings {
  name: string;
  shortName: string;
  logoUrl: string | null;
  homepageHeroImageUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  description: string | null;
  stadium: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  socialLinks: Record<string, string> | null;
  socialReels: SocialReel[];
  defaultLocale: string;
}

export async function getPublicClubSettings(): Promise<PublicClubSettings> {
  const settings = await db.clubSettings.findUnique({
    where: { id: "singleton" },
    select: {
      name: true,
      shortName: true,
      logoUrl: true,
      homepageHeroImageUrl: true,
      primaryColor: true,
      secondaryColor: true,
      description: true,
      stadium: true,
      contactEmail: true,
      contactPhone: true,
      address: true,
      socialLinks: true,
      defaultLocale: true
    }
  });

  if (!settings) {
    return {
      name: "الجمعية الرياضية أمل سيدي حسني لكرة القدم",
      shortName: "ESH",
      logoUrl: "/branding/esh-logo-128.png",
      homepageHeroImageUrl: null,
      primaryColor: "#B31B1B",
      secondaryColor: "#111111",
      description: "الجمعية الرياضية أمل سيدي حسني لكرة القدم — تيارت، بلدية سيدي حسني.",
      stadium: "الملعب البلدي طاهري حسني – سيدي حسني",
      contactEmail: null,
      contactPhone: null,
      address: "الملعب البلدي طاهري حسني – سيدي حسني",
      socialLinks: null,
      socialReels: [],
      defaultLocale: "ar"
    };
  }

  const rawSocialLinks = settings.socialLinks && typeof settings.socialLinks === "object" && !Array.isArray(settings.socialLinks)
    ? settings.socialLinks as Record<string, unknown>
    : {};
  const socialLinks = Object.fromEntries(["facebook", "instagram", "tiktok"].flatMap((key) =>
    typeof rawSocialLinks[key] === "string" ? [[key, rawSocialLinks[key] as string]] : []
  ));
  return {
    ...settings,
    // Keep the association crest identical across public pages, match cards and metadata.
    logoUrl: "/branding/esh-logo-128.png",
    homepageHeroImageUrl: normalizePublicMediaUrl(settings.homepageHeroImageUrl),
    socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : null,
    socialReels: readSocialReels(rawSocialLinks)
  };
}
