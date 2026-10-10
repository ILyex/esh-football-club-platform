import Link from "next/link";
import { Shield, MapPin, Mail, Phone, Youtube, Globe2, Home, Users, CalendarDays, Trophy, Newspaper, Images, Landmark } from "lucide-react";
import { PublicClubSettings } from "@/lib/public/club";
import { FacebookBrandIcon, InstagramBrandIcon, TikTokBrandIcon } from "@/components/public/social-brand-icons";
import { ClubLogo } from "@/components/shared/club-logo";

interface PublicFooterProps {
  locale: string;
  club: PublicClubSettings;
  clubDisplayName: string;
  labels: {
    quickLinks: string;
    contact: string;
    home: string;
    team: string;
    matches: string;
    competitions: string;
    news: string;
    gallery: string;
    allRightsReserved: string;
    memberAffiliation: string;
  };
}

export function PublicFooter({ locale, club, clubDisplayName, labels }: PublicFooterProps) {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-card/60 dark:bg-[#111214] text-card-foreground">
      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-12 lg:py-16">
        <div className="relative z-10 grid grid-cols-1 items-start gap-6 pt-2 md:grid-cols-2 md:gap-8 lg:grid-cols-[1.4fr_0.8fr_0.9fr_0.9fr]">
          {/* Club Info Column */}
          <div className="order-1 min-w-0 space-y-3 text-start md:order-1 md:space-y-4">
            <div className={`flex w-full min-w-0 items-center gap-3 ${locale === "ar" ? "justify-end" : "justify-start"}`} dir={locale === "ar" ? "rtl" : "ltr"}>
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-background shadow-sm sm:h-12 sm:w-12">
                {club.logoUrl ? (
                  <ClubLogo src={club.logoUrl} fallbackSrc="/branding/esh-logo-128.png" alt={clubDisplayName} className="h-full w-full object-cover" />
                ) : (
                  <Shield className="h-6 w-6 text-club-primary" />
                )}
              </div>
              <div className="min-w-0 flex-1 text-start md:text-start">
                <h3 className={`club-name text-[14px] font-extrabold leading-snug tracking-tight text-foreground transition-colors sm:text-sm ${locale === "fr" ? "line-clamp-2 whitespace-normal break-words sm:line-clamp-none sm:whitespace-nowrap" : "whitespace-nowrap"}`}>
                  {clubDisplayName}
                </h3>
                <span dir="ltr" className="block w-fit max-w-full self-start whitespace-nowrap text-[11px] font-medium leading-tight text-muted-foreground sm:text-[11px]">
                  ESH • 2018 — ∞
                </span>
                <div className="mt-2 flex items-start gap-1.5 text-start text-[11px] leading-5 text-muted-foreground sm:text-xs">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-club-primary" />
                  <span>{locale === "ar" ? "الملعب البلدي لبلدية سيدي حسني" : "Stade communal de Sidi Hosni"}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Contact details */}
          <div className="order-3 min-w-0 space-y-2.5 text-start md:order-3 md:space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">{labels.contact}</h4>
            <div className="space-y-1 text-xs leading-5 text-muted-foreground sm:text-sm">
              {club.contactPhone && (
                <div className="flex items-center justify-center gap-2 md:justify-start">
                  <Phone className="h-4 w-4 shrink-0 text-club-primary" />
                  <a href={`tel:${club.contactPhone}`} className="inline-flex min-h-9 items-center hover:text-club-primary">{club.contactPhone}</a>
                </div>
              )}
              {club.contactEmail && (
                <div className="flex items-center justify-center gap-2 md:justify-start">
                  <Mail className="h-4 w-4 shrink-0 text-club-primary" />
                  <a href={`mailto:${club.contactEmail}`} className="inline-flex min-h-9 min-w-0 items-center break-all hover:text-club-primary">{club.contactEmail}</a>
                </div>
              )}
            </div>
          </div>

          {/* Quick Navigation Links */}
          <div className="order-4 min-w-0 space-y-2.5 md:order-4 md:space-y-3">
            <h4 className="text-start text-xs font-bold uppercase tracking-wider text-foreground">{labels.quickLinks}</h4>
            <ul className="flex w-full items-center justify-between gap-1 text-muted-foreground sm:grid sm:grid-cols-2 sm:justify-items-start sm:gap-x-4 sm:gap-y-1 md:grid-cols-1">
              <li>
                <Link href={`/${locale}`} aria-label={labels.home} title={labels.home} className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:text-club-primary sm:h-10 sm:w-auto sm:justify-start sm:gap-1.5">
                  <Home className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">{labels.home}</span>
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/team`} aria-label={labels.team} title={labels.team} className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:text-club-primary sm:h-10 sm:w-auto sm:justify-start sm:gap-1.5">
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">{labels.team}</span>
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/matches`} aria-label={labels.matches} title={labels.matches} className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:text-club-primary sm:h-10 sm:w-auto sm:justify-start sm:gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">{labels.matches}</span>
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/competitions`} aria-label={labels.competitions} title={labels.competitions} className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:text-club-primary sm:h-10 sm:w-auto sm:justify-start sm:gap-1.5">
                  <Trophy className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">{labels.competitions}</span>
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/news`} aria-label={labels.news} title={labels.news} className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:text-club-primary sm:h-10 sm:w-auto sm:justify-start sm:gap-1.5">
                  <Newspaper className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">{labels.news}</span>
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/gallery`} aria-label={labels.gallery} title={labels.gallery} className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:text-club-primary sm:h-10 sm:w-auto sm:justify-start sm:gap-1.5">
                  <Images className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">{labels.gallery}</span>
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/club`} aria-label={locale === "ar" ? "عن الجمعية" : "À propos"} title={locale === "ar" ? "عن الجمعية" : "À propos"} className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:text-club-primary sm:h-10 sm:w-auto sm:justify-start sm:gap-1.5">
                  <Landmark className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">{locale === "ar" ? "عن الجمعية" : "À propos"}</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Social media */}
          <div className="order-2 min-w-0 space-y-2.5 text-start md:order-2 md:space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">{locale === "ar" ? "تابعنا" : "Suivez-nous"}</h4>
            <div className="flex w-full items-center justify-center gap-3 text-start sm:grid sm:grid-cols-1 sm:gap-y-0">
              {Object.entries(club.socialLinks ?? {}).filter(([network, url]) => network !== "website" && Boolean(url)).map(([network, url]) => {
                const Icon = network.toLowerCase().includes("facebook") ? FacebookBrandIcon : network.toLowerCase().includes("instagram") ? InstagramBrandIcon : network.toLowerCase().includes("tiktok") ? TikTokBrandIcon : network.toLowerCase().includes("youtube") ? Youtube : Globe2;
                const platformLabel = network.toLowerCase().includes("facebook")
                  ? (locale === "ar" ? "فيسبوك" : "Facebook")
                  : network.toLowerCase().includes("instagram")
                    ? (locale === "ar" ? "إنستغرام" : "Instagram")
                    : network.toLowerCase().includes("tiktok")
                      ? (locale === "ar" ? "تيك توك" : "TikTok")
                      : network;
                const hoverColor = network.toLowerCase().includes("facebook")
                  ? "hover:text-[#1877F2]"
                  : network.toLowerCase().includes("instagram")
                    ? "hover:text-[#E4405F]"
                    : network.toLowerCase().includes("tiktok")
                      ? "hover:text-[#FE2C55]"
                      : "hover:text-club-primary";
                return (
                  <a key={network} href={url} target="_blank" rel="noreferrer" aria-label={platformLabel} title={platformLabel} dir={locale === "ar" ? "rtl" : "ltr"} className={`inline-flex h-8 w-auto items-center justify-start gap-1 text-[10px] font-bold text-muted-foreground no-underline transition-colors sm:h-10 sm:w-full sm:text-xs ${hoverColor}`}>
                    <Icon className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                    <span dir={locale === "ar" ? "rtl" : "ltr"}>{platformLabel}</span>
                  </a>
                );
              })}
              {Object.entries(club.socialLinks ?? {}).filter(([network, url]) => network !== "website" && Boolean(url)).length === 0 && <span className="text-xs text-muted-foreground">{locale === "ar" ? "تابعونا قريبًا" : "Bientôt sur les réseaux"}</span>}
            </div>
          </div>

        </div>

        {/* Bottom Bar: Copyright, Attribution & Theme Controls */}
        <div className="footer-identity mt-6 flex flex-col items-center justify-between gap-2 border-t border-border/80 pt-4 text-center text-[10px] leading-5 text-muted-foreground sm:mt-12 sm:flex-row sm:gap-4 sm:pt-6 sm:text-xs">
          <p dir={locale === "ar" ? "rtl" : "ltr"}>
            {locale === "ar" ? (
              <><span className="club-name">{clubDisplayName}</span>. {labels.allRightsReserved}. <bdi dir="ltr">© {currentYear}</bdi></>
            ) : (
              <>© {currentYear} <span className="club-name">{clubDisplayName}</span>. {labels.allRightsReserved}.</>
            )}
          </p>
          <div className="flex items-center gap-4">
            <span className="font-medium text-foreground">{labels.memberAffiliation}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
