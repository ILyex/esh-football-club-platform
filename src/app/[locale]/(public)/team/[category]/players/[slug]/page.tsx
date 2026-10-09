import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { User, Calendar, Flag, BadgeCheck, ShieldCheck, Target, Ruler, Footprints, UsersRound, FileText } from "lucide-react";
import { getPublicPlayerBySlug } from "@/lib/public/teams";
import { SafeImage } from "@/components/shared/safe-image";
import { getPlayerDisplayName } from "@/lib/utils";
import { frenchPublicPersonName, localizedNationality, frenchPublicText } from "@/lib/public/locale-text";
import { PublicPageHeading } from "@/components/public/public-page-heading";

export default async function PublicPlayerProfilePage({
  params
}: {
  params: Promise<{ locale: string; category: string; slug: string }>;
}) {
  const { locale, category, slug } = await params;

  const [tPublic, tTeams, player] = await Promise.all([
    getTranslations({ locale, namespace: "publicSite" }),
    getTranslations({ locale, namespace: "teams" }),
    getPublicPlayerBySlug(slug, locale)
  ]);

  if (!player) {
    notFound();
  }

  const formattedJoiningDate = player.joiningDate
    ? new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "long",
        year: "numeric"
      }).format(player.joiningDate)
    : null;

  const positionLabel = tPublic(`positions.${player.position}`);
  const playerName = locale === "ar" ? getPlayerDisplayName(player, locale) : frenchPublicPersonName(player);
  const categoryLabel = tTeams(`categories.${player.team?.category ?? category.toUpperCase()}`);
  const biography = locale === "ar" ? player.biography?.trim() : frenchPublicText(player.biography, "").trim();
  const footLabel = player.preferredFoot
    ? tPublic(`foot.${player.preferredFoot}`) || player.preferredFoot
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <PublicPageHeading
        locale={locale}
        backHref={`/${locale}/team/${category.toLowerCase()}`}
        backLabel={categoryLabel}
        icon={<User />}
        eyebrow={locale === "ar" ? `ملف لاعب · ${categoryLabel}` : `Profil joueur · ${categoryLabel}`}
        title={playerName}
        className="mb-6"
      />
      {/* Main Profile Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8">
        {/* Left Card: Photo & Squad Number */}
        <div className="flex flex-col items-center rounded-2xl border border-border bg-card p-5 text-center shadow-xs sm:p-6">
          <div className="relative aspect-square w-48 overflow-hidden rounded-2xl bg-muted/60 shadow-inner">
            {player.photoUrl ? (
              <SafeImage
                src={player.photoUrl}
                fallbackSrc="/branding/person-placeholder.svg"
                alt={playerName}
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

          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-club-primary/10 px-3 py-1 text-xs font-bold text-club-primary">
            {positionLabel}
          </div>

          {/* Quick Stats Banner */}
          <div className="mt-6 grid w-full grid-cols-2 gap-3 border-t border-border/80 pt-6">
            <div className="flex h-24 min-w-0 flex-col items-center justify-center rounded-xl bg-muted/40 p-3">
              <div className="mb-1 flex items-center justify-center gap-1.5 text-club-primary">
                <BadgeCheck className="h-4 w-4" />
                <p className="text-2xl font-black text-foreground">{player.stats.appearances}</p>
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {tPublic("player.appearances")}
              </p>
            </div>
            <div className="flex h-24 min-w-0 flex-col items-center justify-center rounded-xl bg-muted/40 p-3">
              <div className="mb-1 flex items-center justify-center gap-1.5 text-club-primary">
                {player.position === "GOALKEEPER" ? <ShieldCheck className="h-4 w-4" /> : <Target className="h-4 w-4" />}
                <p className="text-2xl font-black text-club-primary">
                  {player.position === "GOALKEEPER" ? player.stats.cleanSheets : player.stats.goals}
                </p>
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {player.position === "GOALKEEPER"
                  ? (locale === "ar" ? "كلين شيت" : "Clean sheets")
                  : tPublic("player.goals")}
              </p>
            </div>
          </div>
        </div>

        {/* Right Area: Player Attributes & Biography */}
        <div className="space-y-6 md:col-span-2">
          {/* Attributes Table / Grid */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-foreground">
              <User className="h-5 w-5 text-club-primary" />
              {tPublic("player.profile")}
            </h2>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <div className="border-b border-border/60 pb-3">
                <dt className="text-xs font-semibold text-muted-foreground">
                  {tPublic("player.nationality")}
                </dt>
                <dd className="mt-1 text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Flag className="h-3.5 w-3.5 text-club-primary" />
                  <span>{localizedNationality(player.nationality, locale)}</span>
                </dd>
              </div>

              <div className="border-b border-border/60 pb-3">
                <dt className="text-xs font-semibold text-muted-foreground">
                  {locale === "ar" ? "تاريخ الانضمام" : "Date d’adhésion"}
                </dt>
                <dd className="mt-1 flex items-center gap-1.5 text-sm font-bold text-foreground">
                  <Calendar className="h-3.5 w-3.5 text-club-primary" />
                  <span>{formattedJoiningDate ?? (locale === "ar" ? "غير محدد" : "Non renseigné")}</span>
                </dd>
              </div>

              <div className="border-b border-border/60 pb-3">
                <dt className="text-xs font-semibold text-muted-foreground">
                  {locale === "ar" ? "السن" : "Âge"}
                </dt>
                <dd className="mt-1 text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-club-primary" />
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
                  <dd className="mt-1 flex items-center gap-1.5 text-sm font-bold text-foreground">
                    <Ruler className="h-3.5 w-3.5 text-club-primary" />
                    {player.height} cm
                  </dd>
                </div>
              )}

              {footLabel && (
                <div className="border-b border-border/60 pb-3">
                  <dt className="text-xs font-semibold text-muted-foreground">
                    {tPublic("player.dominantFoot")}
                  </dt>
                  <dd className="mt-1 flex items-center gap-1.5 text-sm font-bold text-foreground">
                    <Footprints className="h-3.5 w-3.5 text-club-primary" />
                    {footLabel}
                  </dd>
                </div>
              )}

              {player.team && (
                <div className="border-b border-border/60 pb-3">
                  <dt className="text-xs font-semibold text-muted-foreground">
                    {locale === "ar" ? "الفئة الحالية" : "Équipe actuelle"}
                  </dt>
                  <dd className="mt-1 flex items-center gap-1.5 text-sm font-bold text-foreground">
                    <UsersRound className="h-3.5 w-3.5 text-club-primary" />
                    {categoryLabel}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Player Biography / Description */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-foreground">
              <FileText className="h-5 w-5 text-club-primary" />
              {tPublic("player.bio")}
            </h2>
            <p className={`line-clamp-4 max-h-24 overflow-hidden whitespace-pre-line text-sm leading-relaxed ${biography ? "text-muted-foreground" : "text-muted-foreground/70"}`}>
              {biography || (locale === "ar" ? "لم تتم إضافة نبذة عن اللاعب بعد." : "La biographie du joueur n’a pas encore été ajoutée.")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
