import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Trophy, Calendar, MapPin, User, ChevronRight, ChevronLeft, Shield } from "lucide-react";
import { getPublicMatchDetail } from "@/lib/public/matches";
import { TacticalPitch } from "@/components/football/tactical-pitch";
import { cn } from "@/lib/utils";
import { frenchPublicCategory, frenchPublicText } from "@/lib/public/locale-text";

export default async function PublicMatchDetailPage({
  params
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const isRtl = locale === "ar";
  const BreadcrumbChevron = isRtl ? ChevronLeft : ChevronRight;

  const [tPublic, match] = await Promise.all([
    getTranslations({ locale, namespace: "publicSite" }),
    getPublicMatchDetail(id)
  ]);

  if (!match) {
    notFound();
  }

  const formattedDate = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(match.matchDate);

  const formattedTime = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(match.matchDate);

  const statusLabel = tPublic(`matchStatus.${match.status}`);
  const homeTeamName = locale === "ar" ? match.homeTeamName : frenchPublicText(match.homeTeamName, match.isHomeFixture ? "Association Sportive Espoir Sidi Hosni de Football" : "Adversaire");
  const awayTeamName = locale === "ar" ? match.awayTeamName : frenchPublicText(match.awayTeamName, match.isHomeFixture ? "Adversaire" : "Association Sportive Espoir Sidi Hosni de Football");

  const statusTone =
    match.status === "LIVE"
      ? "bg-red-500 text-white"
      : match.status === "FINISHED"
      ? "bg-emerald-600 text-white"
      : match.status === "SCHEDULED"
      ? "bg-blue-600 text-white"
      : "bg-amber-600 text-white";

  const eventTypeLabel = (type: string) => {
    return tPublic(`eventTypes.${type}`) || type;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      {/* Breadcrumbs */}
      <nav className="mb-8 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Link href={`/${locale}/matches`} className="hover:text-club-primary transition-colors">
          {tPublic("matches.title")}
        </Link>
        <BreadcrumbChevron className="h-3.5 w-3.5" />
        <span className="font-semibold text-foreground">
          {homeTeamName} vs {awayTeamName}
        </span>
      </nav>

      {/* Main Scoreboard Header */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {/* Top Info Bar */}
        <div className="flex flex-wrap items-center justify-between border-b border-border/80 bg-muted/40 px-6 py-3 text-xs">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Trophy className="h-4 w-4 text-club-primary" />
            <span>{locale === "ar" ? match.competitionName : frenchPublicText(match.competitionName, "Compétition officielle")}</span>
            {match.teamCategory && (
              <span className="rounded-md bg-club-primary/10 px-2 py-0.5 font-mono text-[11px] text-club-primary">
                {locale === "ar" ? match.teamCategory : frenchPublicCategory(match.teamCategory)}
              </span>
            )}
          </div>
          <span className={`rounded-full px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider ${statusTone}`}>
            {statusLabel}
          </span>
        </div>

        {/* Teams and Score Area */}
        <div className="px-6 py-10 sm:py-14">
          <div className="grid grid-cols-3 items-center text-center">
            {/* Home Team */}
            <div className="flex flex-col items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-background shadow-xs sm:h-20 sm:w-20">
                <Shield className="h-8 w-8 text-club-primary sm:h-10 sm:w-10" />
              </div>
              <h2 className="mt-3 text-lg font-extrabold text-foreground sm:text-2xl">
                {homeTeamName}
              </h2>
              {match.isHomeFixture && (
                <span className="mt-1 rounded-md bg-club-primary/10 px-2 py-0.5 text-[11px] font-semibold text-club-primary">
                  {locale === "ar" ? "نادينا" : "Notre Club"}
                </span>
              )}
            </div>

            {/* Score or Kickoff Time */}
            <div className="flex flex-col items-center justify-center">
              {match.status === "SCHEDULED" ? (
                <div className="space-y-1">
                  <span className="font-mono text-2xl font-black text-foreground sm:text-4xl">
                    {formattedTime}
                  </span>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {locale === "ar" ? "توقيت المباراة" : "Coup d'envoi"}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="font-mono text-4xl font-black text-foreground sm:text-6xl tabular-nums">
                    <span>{match.homeScore ?? 0}</span>
                    <span className="mx-2 text-muted-foreground">-</span>
                    <span>{match.awayScore ?? 0}</span>
                  </div>
                  {match.status === "LIVE" && (
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                  )}
                </div>
              )}
            </div>

            {/* Away Team */}
            <div className="flex flex-col items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-background shadow-xs sm:h-20 sm:w-20">
                <Shield className="h-8 w-8 text-muted-foreground/60 sm:h-10 sm:w-10" />
              </div>
              <h2 className="mt-3 text-lg font-extrabold text-foreground sm:text-2xl">
                {awayTeamName}
              </h2>
              {!match.isHomeFixture && (
                <span className="mt-1 rounded-md bg-club-primary/10 px-2 py-0.5 text-[11px] font-semibold text-club-primary">
                  {locale === "ar" ? "نادينا" : "Notre Club"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Details Footer */}
        <div className="flex flex-wrap items-center justify-center gap-6 border-t border-border/80 bg-muted/20 px-6 py-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-club-primary" />
            <span>{formattedDate}</span>
          </div>
          {match.stadium && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-club-primary" />
              <span>{locale === "ar" ? match.stadium : frenchPublicText(match.stadium, "Stade Municipal Sidi Hosni")}</span>
            </div>
          )}
          {match.refereeName && (
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-club-primary" />
              <span>
                {tPublic("matches.referee")}: {locale === "ar" ? match.refereeName : frenchPublicText(match.refereeName, "Non communiqué")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Match Report Summary */}
      {(locale === "ar" ? match.matchReport : frenchPublicText(match.matchReport, "")) && (
        <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-xs">
          <h3 className="text-lg font-bold text-foreground mb-3">
            {locale === "ar" ? "تقرير المباراة" : "Résumé du match"}
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
            {locale === "ar" ? match.matchReport : frenchPublicText(match.matchReport, "")}
          </p>
        </div>
      )}

      {/* Match Events Timeline */}
      {match.events.length > 0 && (
        <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-xs">
          <h3 className="text-lg font-bold text-foreground mb-4">
            {tPublic("matches.events")}
          </h3>

          <div className="space-y-3">
            {match.events.map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-4 rounded-xl border border-border/60 bg-muted/30 p-3 text-sm"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card font-mono text-xs font-black text-club-primary border border-border">
                  {event.minute}&apos;
                </span>
                <div className="flex-1">
                  <span className="font-bold text-foreground">{locale === "ar" ? (event.playerName !== "—" ? event.playerName : event.staffName || "—") : frenchPublicText(event.playerName !== "—" ? event.playerName : event.staffName || "—", "Joueur")}</span>
                  <span className="ms-2 text-xs font-semibold text-muted-foreground">
                    ({eventTypeLabel(event.type)})
                  </span>
                  {(locale === "ar" ? event.notes : frenchPublicText(event.notes, "")) && (
                    <p className="text-xs text-muted-foreground mt-0.5">{locale === "ar" ? event.notes : frenchPublicText(event.notes, "")}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Official Lineups & Tactical Pitch (Locked Spec A.5) */}
      {(match.startingLineup.length > 0 || match.substitutes.length > 0) && (
        <div className="mt-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold tracking-tight text-foreground">
              {locale === "ar" ? "التشكيلة الرسمية والرسم التكتيكي" : "Composition Officielle & Schéma Tactique"}
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
            {/* Tactical Pitch Column (Locked Spec A.5: dir="ltr" internally) */}
            {match.startingLineup.length > 0 && (
              <div className="lg:col-span-5 rounded-2xl border border-border bg-card p-4 shadow-xs">
                <TacticalPitch
                  startingLineup={match.startingLineup}
                  teamName={match.isHomeFixture ? homeTeamName : awayTeamName}
                  formation="4-3-3"
                  isClubTeam={true}
                  locale={locale}
                />
              </div>
            )}

            {/* Roster Columns */}
            <div className={cn("grid grid-cols-1 gap-6 sm:grid-cols-2", match.startingLineup.length > 0 ? "lg:col-span-7" : "lg:col-span-12")}>
              {/* Starting XI */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
                <h4 className="text-base font-bold text-foreground mb-4">
                  {tPublic("matches.startingLineup")}
                </h4>
                {match.startingLineup.length > 0 ? (
                  <ul className="divide-y divide-border/60">
                    {match.startingLineup.map((player) => (
                      <li key={player.playerId} className="flex items-center justify-between py-2.5 text-sm">
                        <div className="flex items-center gap-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted font-mono text-xs font-bold text-foreground">
                            {player.shirtNumber ?? "-"}
                          </span>
                          {player.playerSlug ? (
                            <Link
                              href={`/${locale}/team/${(match.teamCategory || "senior").toLowerCase()}/players/${player.playerSlug}`}
                              className="font-medium text-foreground hover:text-club-primary transition-colors"
                            >
                              {locale === "ar" ? player.playerName : frenchPublicText(player.playerName, "Joueur")}
                            </Link>
                          ) : (
                            <span className="font-medium text-foreground">{locale === "ar" ? player.playerName : frenchPublicText(player.playerName, "Joueur")}</span>
                          )}
                        </div>
                        {player.position && (
                          <span className="text-xs font-semibold text-muted-foreground">
                          {locale === "ar" ? player.position : frenchPublicText(player.position, "Poste non communiqué")}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs italic text-muted-foreground">
                    {tPublic("matches.noLineups")}
                  </p>
                )}
              </div>

          {/* Substitutes */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
            <h3 className="text-lg font-bold text-foreground mb-4">
              {tPublic("matches.substitutes")}
            </h3>
            {match.substitutes.length > 0 ? (
              <ul className="divide-y divide-border/60">
                {match.substitutes.map((player) => (
                  <li key={player.playerId} className="flex items-center justify-between py-2.5 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted font-mono text-xs font-bold text-foreground">
                        {player.shirtNumber ?? "-"}
                      </span>
                      {player.playerSlug ? (
                        <Link
                          href={`/${locale}/team/${(match.teamCategory || "senior").toLowerCase()}/players/${player.playerSlug}`}
                          className="font-medium text-foreground hover:text-club-primary transition-colors"
                        >
                          {locale === "ar" ? player.playerName : frenchPublicText(player.playerName, "Joueur")}
                        </Link>
                      ) : (
                        <span className="font-medium text-foreground">{locale === "ar" ? player.playerName : frenchPublicText(player.playerName, "Joueur")}</span>
                      )}
                    </div>
                    {player.position && (
                      <span className="text-xs font-semibold text-muted-foreground">
                      {locale === "ar" ? player.position : frenchPublicText(player.position, "Poste non communiqué")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs italic text-muted-foreground">
                {tPublic("matches.noLineups")}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
      )}
    </div>
  );
}
