import Link from "next/link";
import { Shield, MapPin, Mail, Phone } from "lucide-react";
import { PublicClubSettings } from "@/lib/public/club";

interface PublicFooterProps {
  locale: string;
  club: PublicClubSettings;
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

export function PublicFooter({ locale, club, labels }: PublicFooterProps) {
  const currentYear = new Date().getFullYear();
  const hasContact = Boolean(club.contactEmail || club.contactPhone);

  return (
    <footer className="border-t border-border bg-card/60 dark:bg-[#111214] text-card-foreground">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-6 sm:py-12 lg:py-16">
        <div className={`grid grid-cols-1 gap-7 md:gap-8 ${hasContact ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
          {/* Club Info Column */}
          <div className={`space-y-3 md:space-y-4 ${hasContact ? "md:col-span-2" : "md:col-span-2"}`}>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-border bg-background shadow-sm">
                {club.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={club.logoUrl} alt={locale === "ar" ? club.name : "Association Sportive Espoir Sidi Hosni de Football"} className="h-full w-full object-cover" />
                ) : (
                  <Shield className="h-6 w-6 text-club-primary" />
                )}
              </div>
              <div className="min-w-0 text-end">
                <h3 className="whitespace-nowrap text-[14px] font-bold leading-snug tracking-tight text-foreground sm:text-lg">
                  {locale === "ar" ? club.name : "Association Sportive Espoir Sidi Hosni de Football"}
                </h3>
                <p className="mt-1 text-xs font-semibold tracking-wider text-muted-foreground">
                  <span dir="ltr" className="inline-block tabular-nums font-mono font-bold">
                    ESH • 2018 — ∞
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-col space-y-2 pt-1 text-xs leading-5 text-muted-foreground">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-club-primary" />
                <span>
                  {locale === "ar"
                ? (club.stadium || "الملعب البلدي لبلدية سيدي حسني")
                : "Stade communal de la commune de Sidi Hosni, wilaya de Tiaret, Algérie"}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Navigation Links */}
          <div className="space-y-3 md:space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">{labels.quickLinks}</h4>
            <ul className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm text-muted-foreground sm:grid-cols-3 md:grid-cols-1">
              <li>
                <Link href={`/${locale}`} className="transition-colors hover:text-club-primary">
                  {labels.home}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/team`} className="transition-colors hover:text-club-primary">
                  {labels.team}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/matches`} className="transition-colors hover:text-club-primary">
                  {labels.matches}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/competitions`} className="transition-colors hover:text-club-primary">
                  {labels.competitions}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/news`} className="transition-colors hover:text-club-primary">
                  {labels.news}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/gallery`} className="transition-colors hover:text-club-primary">
                  {labels.gallery}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact & Admin Portal */}
          {hasContact && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">{labels.contact}</h4>
            <div className="space-y-2 text-sm leading-5 text-muted-foreground">
              {club.contactEmail && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <a href={`mailto:${club.contactEmail}`} className="hover:text-club-primary">
                    {club.contactEmail}
                  </a>
                </div>
              )}
              {club.contactPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <a href={`tel:${club.contactPhone}`} className="hover:text-club-primary">
                    {club.contactPhone}
                  </a>
                </div>
              )}
            </div>
          </div>
          )}
        </div>

        {/* Bottom Bar: Copyright, Attribution & Theme Controls */}
        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-border/80 pt-5 text-center text-xs leading-5 text-muted-foreground sm:mt-12 sm:flex-row sm:gap-4 sm:pt-6">
          <p>
            © {currentYear} {locale === "ar" ? club.name : "Association Sportive Espoir Sidi Hosni de Football"}. {labels.allRightsReserved}.
          </p>
          <div className="flex items-center gap-4">
            <span className="font-medium text-foreground">{labels.memberAffiliation}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
