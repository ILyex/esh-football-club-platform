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

  return (
    <footer className="border-t border-border bg-card/60 dark:bg-[#111214] text-card-foreground">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Club Info Column */}
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-border bg-background shadow-sm">
                {club.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={club.logoUrl} alt={locale === "ar" ? club.name : "ESH Sidi Hosni"} className="h-full w-full object-cover" />
                ) : (
                  <Shield className="h-6 w-6 text-club-primary" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight text-foreground">
                  {locale === "ar" ? "أمل سيدي حسني" : "ESH Sidi Hosni"}
                </h3>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                  <span dir={locale === "ar" ? "rtl" : "ltr"} className="tabular-nums font-mono font-bold">
                    {locale === "ar" ? "أمل سيدي حسني • 2018 — ∞" : "ESH SIDI HOSNI • 2018 — ∞"}
                  </span>
                </p>
              </div>
            </div>

            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              {locale === "ar"
                ? (club.description || "النادي الرياضي الهاوي أمل سيدي حسني — بلدية سيدي حسني، ولاية تيارت. التميز الرياضي وتكوين المواهب الشابة.")
                : "Club Sportif Amateur Espoir Sidi Hosni — Commune de Sidi Hosni, Wilaya de Tiaret. Excellence sportive et développement des talents."}
            </p>

            <div className="flex flex-col space-y-2 pt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-club-primary" />
                <span>
                  {locale === "ar"
                    ? (club.stadium || "الملعب البلدي بسيدي حسني، ولاية تيارت، الجزائر")
                    : "Stade Municipal de Sidi Hosni, Wilaya de Tiaret, Algérie"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  {locale === "ar" ? "المقر الرسمي:" : "Siège officiel :"}
                </span>
                <span>
                  {locale === "ar"
                    ? (club.address || "بلدية سيدي حسني، دائرة مدروسة، ولاية تيارت")
                    : "Commune de Sidi Hosni, Daïra de Medroussa, W. Tiaret"}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Navigation Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">{labels.quickLinks}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
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
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">{labels.contact}</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
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
        </div>

        {/* Bottom Bar: Copyright, Attribution & Theme Controls */}
        <div className="mt-12 border-t border-border/80 pt-6 text-center text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>
            © {currentYear} {locale === "ar" ? "أمل سيدي حسني" : "ESH Sidi Hosni"}. {labels.allRightsReserved}.
          </p>
          <div className="flex items-center gap-4">
            <span className="font-medium text-foreground">{labels.memberAffiliation}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
