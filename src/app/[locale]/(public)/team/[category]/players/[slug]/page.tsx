import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { User, ChevronRight, ChevronLeft, Trophy, Calendar, Flag, Activity } from "lucide-react";
import { getPublicPlayerBySlug } from "@/lib/public/teams";
import { getPlayerDisplayName } from "@/lib/utils";

export default async function PublicPlayerProfilePage({
  params
}: {
  params: Promise<{ locale: string; category: string; slug: string }>;
}) {
  const { locale, category, slug } = await params;
  const isRtl = locale === "ar";
  const BreadcrumbChevron = isRtl ? ChevronLeft : ChevronRight;

  const [tPublic, player] = await Promise.all([
    getTranslations({ locale, namespace: "publicSite" }),
    getPublicPlayerBySlug(slug, locale)
  ]);

  if (!player) {
    notFound();
  }

  const formattedDob = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(player.dateOfBirth);

  const positionLabel = tPublic(`positions.${player.position}`);
  const footLabel = player.preferredFoot
    ? tPublic(`foot.${player.preferredFoot}`) || player.preferredFoot
    : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      {/* Breadcrumbs */}
      <nav className="mb-8 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Link href={`/${locale}/team`} className="hover:text-club-primary transition-colors">
          {tPublic("teams.title")}
        </Link>
        <BreadcrumbChevron className="h-3.5 w-3.5" />
        <Link
          href={`/${locale}/team/${category.toLowerCase()}`}
          className="hover:text-club-primary transition-colors uppercase"
        >
          {category}
        </Link>
        <BreadcrumbChevron className="h-3.5 w-3.5" />
        <span className="font-semibold text-foreground">
          {getPlayerDisplayName(player, locale)}
        </span>
      </nav>

      {/* Main Profile Grid */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {/* Left Card: Photo & Squad Number */}
        <div className="flex flex-col items-center rounded-2xl border border-border bg-card p-6 shadow-xs text-center">
          <div className="relative aspect-square w-48 overflow-hidden rounded-2xl bg-muted/60 shadow-inner">
            {player.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={player.photoUrl}
                alt={getPlayerDisplayName(player, locale)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-radial from-muted/50 to-muted/80 text-muted-foreground/30">
                <User className="h-24 w-24" />
              </div>
            )}

            {player.shirtNumber && (
              <div className="absolute top-3 end-3 flex h-10 w-10 items-center justify-center rounded-xl bg-card/95 font-mono text-base font-black text-foreground shadow-md backdrop-blur-xs">
                {player.shirtNumber}
              </div>
            )}
          </div>

          <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-foreground">
            {getPlayerDisplayName(player, locale)}
          </h1>

          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-club-primary/10 px-3 py-1 text-xs font-bold text-club-primary">
            {positionLabel}
          </div>

          {/* Quick Stats Banner */}
          <div className="mt-6 grid w-full grid-cols-2 gap-3 border-t border-border/80 pt-6">
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-2xl font-black text-foreground">{player.stats.appearances}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">
                {tPublic("player.appearances")}
              </p>
            </div>
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-2xl font-black text-club-primary">{player.stats.goals}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">
                {tPublic("player.goals")}
              </p>
            </div>
          </div>
        </div>

        {/* Right Area: Player Attributes & Biography */}
        <div className="space-y-6 md:col-span-2">
          {/* Attributes Table / Grid */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
            <h2 className="text-lg font-bold text-foreground mb-4">
              {tPublic("player.profile")}
            </h2>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <div className="border-b border-border/60 pb-3">
                <dt className="text-xs font-semibold text-muted-foreground">
                  {tPublic("player.nationality")}
                </dt>
                <dd className="mt-1 text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Flag className="h-3.5 w-3.5 text-club-primary" />
                  <span>{player.nationality}</span>
                </dd>
              </div>

              <div className="border-b border-border/60 pb-3">
                <dt className="text-xs font-semibold text-muted-foreground">
                  {locale === "ar" ? "السن الرياضي" : "Âge sportif"}
                </dt>
                <dd className="mt-1 text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>
                    {player.age} {tPublic("player.years")}
                  </span>
                </dd>
              </div>

              {player.height && (
                <div className="border-b border-border/60 pb-3">
                  <dt className="text-xs font-semibold text-muted-foreground">
                    {tPublic("player.height")}
                  </dt>
                  <dd className="mt-1 text-sm font-bold text-foreground">
                    {player.height} cm
                  </dd>
                </div>
              )}

              {footLabel && (
                <div className="border-b border-border/60 pb-3">
                  <dt className="text-xs font-semibold text-muted-foreground">
                    {tPublic("player.dominantFoot")}
                  </dt>
                  <dd className="mt-1 text-sm font-bold text-foreground">
                    {footLabel}
                  </dd>
                </div>
              )}

              {player.team && (
                <div className="border-b border-border/60 pb-3">
                  <dt className="text-xs font-semibold text-muted-foreground">
                    {locale === "ar" ? "الفئة الحالية" : "Équipe actuelle"}
                  </dt>
                  <dd className="mt-1 text-sm font-bold text-foreground">
                    {player.team.name} ({player.team.category})
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Player Biography / Description */}
          {player.biography && (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
              <h2 className="text-lg font-bold text-foreground mb-3">
                {tPublic("player.bio")}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                {player.biography}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
