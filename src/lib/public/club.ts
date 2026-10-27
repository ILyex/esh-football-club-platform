import "server-only";
import { unstable_cache } from "next/cache";
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
  websiteImages: Record<string, string>;
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

const DEFAULT_PUBLIC_CLUB_SETTINGS: PublicClubSettings = {
  name: "الجمعية الرياضية أمل سيدي حسني لكرة القدم",
  shortName: "ESH",
  logoUrl: "/branding/esh-logo-128.png",
  homepageHeroImageUrl: null,
  websiteImages: {},
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

async function loadPublicClubSettings(): Promise<PublicClubSettings> {
  let settings;
  try {
    settings = await db.clubSettings.findUnique({
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
  } catch (error) {
    const reasonName = error instanceof Error ? error.name : "UnknownError";
    console.error(`[public-site] Club settings query failed (${reasonName})`);
    return DEFAULT_PUBLIC_CLUB_SETTINGS;
  }

  if (!settings) {
    return DEFAULT_PUBLIC_CLUB_SETTINGS;
  }

  const rawSocialLinks = settings.socialLinks && typeof settings.socialLinks === "object" && !Array.isArray(settings.socialLinks)
    ? settings.socialLinks as Record<string, unknown>
    : {};
  const socialLinks = Object.fromEntries(["facebook", "instagram", "tiktok"].flatMap((key) =>
    typeof rawSocialLinks[key] === "string" ? [[key, rawSocialLinks[key] as string]] : []
  ));
  const rawWebsiteImages = rawSocialLinks.websiteImages && typeof rawSocialLinks.websiteImages === "object" && !Array.isArray(rawSocialLinks.websiteImages)
    ? rawSocialLinks.websiteImages as Record<string, unknown> : {};
  const websiteImages = Object.fromEntries(Object.entries(rawWebsiteImages).flatMap(([key, value]) =>
    typeof value === "string" ? [[key, normalizePublicMediaUrl(value) ?? value]] : []
  ));
  return {
    ...settings,
    // Use the saved official crest consistently across public pages. Older
    // installs without a configured crest keep the bundled club asset.
    logoUrl: normalizePublicMediaUrl(settings.logoUrl) || "/branding/esh-logo-128.png",
    homepageHeroImageUrl: normalizePublicMediaUrl(settings.homepageHeroImageUrl),
    websiteImages,
    socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : null,
    socialReels: readSocialReels(rawSocialLinks)
  };
}

// Public branding changes infrequently. A short shared cache avoids repeating
// the settings query in both the public layout and page while keeping edits fresh.
export const getPublicClubSettings = unstable_cache(
  loadPublicClubSettings,
  ["public-club-settings-v1"],
  { revalidate: 30, tags: ["public-club-settings"] }
);
