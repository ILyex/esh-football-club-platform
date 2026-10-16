import type { ReactNode } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getPublicClubSettings } from "@/lib/public/club";
import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicAnalyticsTracker } from "@/components/public/public-analytics-tracker";
import { PublicMediaProtection } from "@/components/public/public-media-protection";
import { PublicParentBackNavigation } from "@/components/public/public-parent-back-navigation";
import { getClubBrandStyle } from "@/lib/branding";
import { MatchPushOptIn } from "@/components/public/match-push-opt-in";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "ar"
      ? "الجمعية الرياضية أمل سيدي حسني لكرة القدم"
      : "Association Sportive Espoir Sidi Hosni de Football"
  };
}

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
  const clubDisplayName = locale === "ar"
    ? "الجمعية الرياضية أمل سيدي حسني لكرة القدم"
    : "Association Sportive Espoir Sidi Hosni de Football";

  const headerLabels = {
    home: tNav("home"),
    club: tNav("club"),
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
    <PublicMediaProtection>
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-club-primary selection:text-white" style={getClubBrandStyle(club.primaryColor, club.secondaryColor)}>
      <PublicParentBackNavigation />
      <PublicAnalyticsTracker />
      <PublicHeader
        locale={locale}
        clubName={clubDisplayName}
        clubShortName={clubDisplayName}
        labels={headerLabels}
      />
      <MatchPushOptIn locale={locale} />
      <main className="flex-1">{children}</main>
      <section aria-label={locale === "ar" ? "الشراكة الرسمية" : "Partenaire officiel"} className="border-y border-border/70 bg-card/35 px-3 py-4 sm:px-6 sm:py-5">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 sm:flex-row sm:gap-6">
          <div className="sponsor-identity flex items-center text-center sm:text-start">
            <div className="border-s-2 border-club-primary ps-3">
              <p className="text-base font-black leading-tight text-club-primary sm:text-lg">{locale === "ar" ? "تحت رعاية" : "Sous le patronage de"}</p>
            </div>
          </div>
          <div dir="ltr" className="sponsor-lockup group inline-flex items-center gap-3 rounded-xl border border-border/80 border-s-2 border-s-club-primary bg-background/60 px-3 py-2.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-club-primary/50 hover:shadow-md sm:gap-4 sm:px-4 sm:py-3">
            <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-border/80 bg-[#111214] p-1.5 sm:h-14 sm:w-14">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/branding/apc-sidi-hosni-logo.png" alt="APC Sidi Hosni" className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105" />
            </span>
            <span className="h-9 w-px bg-border" aria-hidden="true" />
            <span className="flex flex-col leading-none text-start">
              <span className="text-sm font-black tracking-[0.22em] text-club-primary sm:text-base">APC</span>
              <span className="mt-1.5 text-[10px] font-bold tracking-[0.16em] text-muted-foreground sm:text-xs">SIDI HOSNI</span>
            </span>
          </div>
        </div>
      </section>
      <PublicFooter locale={locale} club={club} clubDisplayName={clubDisplayName} labels={footerLabels} />
    </div>
    </PublicMediaProtection>
  );
}
