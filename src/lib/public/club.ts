import "server-only";
import { db } from "@/lib/db";

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
      name: "أمل سيدي حسني",
      shortName: "أمل سيدي حسني",
      logoUrl: "/branding/esh-logo.jpg",
      homepageHeroImageUrl: null,
      primaryColor: "#B31B1B",
      secondaryColor: "#111111",
      description: "ESH SIDI HOSNI — Club de football fondé à Sidi Hosni, Tiaret.",
      stadium: "Stade Communal de Sidi Hosni",
      contactEmail: null,
      contactPhone: null,
      address: "Sidi Hosni, W. Tiaret, Algérie",
      socialLinks: null,
      defaultLocale: "ar"
    };
  }

  return {
    ...settings,
    socialLinks: (settings.socialLinks as Record<string, string>) ?? null
  };
}
