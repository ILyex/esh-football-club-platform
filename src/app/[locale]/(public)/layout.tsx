import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { getPublicClubSettings } from "@/lib/public/club";
import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicAnalyticsTracker } from "@/components/public/public-analytics-tracker";
import { getClubBrandStyle } from "@/lib/branding";

export default async function PublicLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const tNav = await getTranslations({ locale, namespace: "nav" });
  const tPublic = await getTranslations({ locale, namespace: "publicSite" });
  const club = await getPublicClubSettings();

  const headerLabels = {
    home: tNav("home"),
    team: tNav("team"),
    matches: tNav("matches"),
    competitions: tNav("competitions"),
    news: tNav("news"),
    gallery: tNav("gallery"),
    dashboard: tPublic("portal"),
    switchLocale: locale === "ar" ? "Passer en Français" : "Basculer en arabe",
    menu: tPublic("menu"),
    close: tPublic("close")
  };

  const footerLabels = {
    quickLinks: tPublic("footer.quickLinks"),
    contact: tPublic("footer.contact"),
    home: tNav("home"),
    team: tNav("team"),
    matches: tNav("matches"),
    competitions: tNav("competitions"),
    news: tNav("news"),
    gallery: tNav("gallery"),
    allRightsReserved: tPublic("footer.rights"),
    memberAffiliation: tPublic("footer.memberAffiliation")
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-club-primary selection:text-white" style={getClubBrandStyle(club.primaryColor, club.secondaryColor)}>
      <PublicAnalyticsTracker />
      <PublicHeader
        locale={locale}
        clubName={locale === "ar" ? "أمل سيدي حسني" : "ESH Sidi Hosni"}
        clubShortName={locale === "ar" ? "أمل سيدي حسني" : "ESH Sidi Hosni"}
        logoUrl={club.logoUrl}
        labels={headerLabels}
      />
      <div className="flex-1">{children}</div>
      <PublicFooter locale={locale} club={club} labels={footerLabels} />
    </div>
  );
}
