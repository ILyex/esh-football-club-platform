import { formatAlgeriaTime } from "@/lib/dates/algeria";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Trophy, Calendar, MapPin, User, Shield, Target, CircleDot, CircleCheck, CircleX, Square, ArrowRightLeft, Sparkles, UsersRound } from "lucide-react";
import { getPublicMatchDetail } from "@/lib/public/matches";
import { getPublicClubSettings } from "@/lib/public/club";
import { TacticalPitch } from "@/components/football/lineup-pitch-board";
import { cn } from "@/lib/utils";
import { frenchCompetitionName, frenchPublicCategory, frenchPublicText, localizedClubName } from "@/lib/public/locale-text";
import { LiveMatchRefresh } from "@/components/public/live-match-refresh";
import { getRefereeRoleLabel, splitRefereeNames } from "@/lib/matches/referees";
import { MatchLiveClock } from "@/components/matches/match-live-clock";
import { MatchOperationalStatus } from "@/components/matches/match-operational-status";
import { MatchLineupCarousel } from "@/components/public/match-lineup-carousel";
import { PublicMatchSections } from "@/components/public/public-match-sections";
import { PublicPageHeading } from "@/components/public/public-page-heading";
import { OpponentCrest } from "@/components/public/opponent-crest";

export default async function PublicMatchDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ locale, id }, query] = await Promise.all([params, searchParams]);

  const [tPublic, match, clubSettings] = await Promise.all([
    getTranslations({ locale, namespace: "publicSite" }),
    getPublicMatchDetail(id),
    getPublicClubSettings()
  ]);

  if (!match) {
    notFound();
  }

  const formattedDate = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Algiers"
  }).format(match.matchDate);

  const formattedTime = formatAlgeriaTime(match.matchDate, locale);
  const kickoffRemaining = match.matchDate.getTime() - Date.now();
  const isNearKickoff = match.status === "SCHEDULED" && kickoffRemaining > 0 && kickoffRemaining <= 30 * 60 * 1000;
  const nextStatusRefreshAt = match.status === "SCHEDULED" && kickoffRemaining > 0
    ? match.matchDate.getTime() - (kickoffRemaining > 30 * 60 * 1000 ? 30 * 60 * 1000 : 0)
    : undefined;
  const showOfficialLineup = match.status === "LIVE" || isNearKickoff;
  const showMatchEvents = match.status === "LIVE" || match.status === "FINISHED";

  // Keep the public match center tied to the configured club record while
  // displaying the club's short sporting name instead of its legal entity name.
  const configuredClubName = clubSettings.name.trim();
  const isEspoirSidiHosni = /(?:أمل\s+سيدي\s+حسني|amal\s+sidi\s+hosni|espoir(?:e)?\s+sidi\s+hosni)/iu.test(configuredClubName);
  const clubName = isEspoirSidiHosni
    ? (locale === "ar" ? "نادي أمل سيدي حسني" : "Club Espoir Sidi Hosni")
    : localizedClubName(configuredClubName, locale, locale === "ar" ? configuredClubName : "Club");
  const homeLogoUrl = match.isHomeFixture ? clubSettings.logoUrl : match.opponentLogo;
  const awayLogoUrl = match.isHomeFixture ? match.opponentLogo : clubSettings.logoUrl;
  const homeTeamName = match.isHomeFixture
    ? clubName
    : localizedClubName(match.homeTeamName, locale, locale === "fr" ? "Nom du club adverse" : "الفريق المنافس");
  const awayTeamName = match.isHomeFixture
    ? localizedClubName(match.awayTeamName, locale, locale === "fr" ? "Nom du club adverse" : "الفريق المنافس")
    : clubName;
  const winnerName = match.winnerSide === "HOME" ? homeTeamName : match.winnerSide === "AWAY" ? awayTeamName : null;
  const categoryLabel = locale === "ar"
    ? ({ SENIOR: "الأكابر", U20: "U20", U17: "U17", U15: "U15" } as Record<string, string>)[match.teamCategory ?? ""] ?? match.teamCategory
    : match.teamCategory ? frenchPublicCategory(match.teamCategory) : null;

  const eventTypeLabel = (type: string) => {
    return tPublic(`eventTypes.${type}`) || type;
  };
  const eventTypeTone = (type: string) => {
    if (type === "PENALTY_MISSED") return "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400";
    if (type === "GOAL" || type === "PENALTY_GOAL" || type === "OWN_GOAL") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    if (type === "YELLOW_CARD") return "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400";
    if (type === "RED_CARD") return "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400";
    return "border-border bg-muted text-muted-foreground";
  };
  const eventTypeIcon = (type: string) => {
    if (type === "PENALTY_GOAL") return <CircleDot className="h-3.5 w-3.5" aria-hidden="true" />;
    if (type === "PENALTY_MISSED") return <CircleX className="h-3.5 w-3.5" aria-hidden="true" />;
    if (type === "GOAL" || type === "OWN_GOAL") return <Target className="h-3.5 w-3.5" aria-hidden="true" />;
    if (type === "YELLOW_CARD") return <Square className="h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-hidden="true" />;
    if (type === "RED_CARD") return <Square className="h-3.5 w-3.5 fill-red-500 text-red-600" aria-hidden="true" />;
    if (type === "SUBSTITUTION_IN" || type === "SUBSTITUTION_OUT") return <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden="true" />;
    return <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-7 px-3 py-7 sm:space-y-8 sm:px-6 sm:py-10">
      <LiveMatchRefresh
        enabled={match.status === "LIVE"}
        refreshAt={nextStatusRefreshAt}
      />
      <PublicPageHeading
        locale={locale}
        backHref={`/${locale}/matches`}
        backLabel={tPublic("matches.title")}
        icon={<Trophy />}
        eyebrow={locale === "ar" ? "تفاصيل المباراة" : "Détails du match"}
        title={`${homeTeamName} vs ${awayTeamName}`}
        description={`${locale === "ar" ? match.competitionName : frenchCompetitionName(match.competitionName)} · ${formattedDate} · ${formattedTime}`}
      />
      {/* Main Scoreboard Header */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {/* Top Info Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-muted/40 px-4 py-3 text-xs sm:px-6">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Trophy className="h-4 w-4 text-club-primary" />
            <span>{locale === "ar" ? match.competitionName : frenchCompetitionName(match.competitionName)}</span>
            {match.teamCategory && (
              <span className="rounded-md bg-club-primary/10 px-2 py-0.5 font-mono text-[11px] text-club-primary">
                {categoryLabel}
              </span>
            )}
          </div>
          <MatchOperationalStatus
            status={match.status}
            matchDate={match.matchDate}
            locale={locale}
            variant="detail"
            labels={{
              SCHEDULED: tPublic("matchStatus.SCHEDULED"),
              LIVE: tPublic("matchStatus.LIVE"),
              FINISHED: tPublic("matchStatus.FINISHED"),
              POSTPONED: tPublic("matchStatus.POSTPONED"),
              CANCELLED: tPublic("matchStatus.CANCELLED")
            }}
            hasExtraTime={match.hasExtraTime}
            hasPenaltyShootout={match.hasPenaltyShootout}
            homeScore={match.homeScore}
            awayScore={match.awayScore}
            addedTime={match.addedTime}
          />
        </div>

        {/* Teams and Score Area */}
        <div className="px-3 py-8 sm:px-6 sm:py-12">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-1 text-center sm:gap-x-4">
            {/* Home Team */}
            <div className="flex min-w-0 self-start flex-col items-center px-1 sm:px-2">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border bg-transparent shadow-xs sm:h-20 sm:w-20">
                {homeLogoUrl ? (
                  <OpponentCrest src={homeLogoUrl} alt={homeTeamName} className="h-full w-full rounded-full object-contain p-1.5" iconClassName="h-8 w-8 text-club-primary sm:h-10 sm:w-10" />
                ) : (
                  <Shield className="h-8 w-8 text-club-primary sm:h-10 sm:w-10" />
                )}
              </div>
              <h2 className="mt-3 w-full max-w-xs break-words text-base font-extrabold leading-snug text-foreground sm:text-xl lg:text-2xl">
                {homeTeamName}
              </h2>
              {match.isHomeFixture && (
                <span className="mt-2 max-w-full rounded-md bg-club-primary/10 px-2 py-0.5 text-[10px] font-semibold text-club-primary sm:text-[11px]">
                  {locale === "ar" ? "نادينا" : "Notre Club"}
                </span>
              )}
            </div>

            {/* Score or Kickoff Time */}
            <div className="flex min-w-0 flex-col items-center justify-center px-1">
              {match.status === "SCHEDULED" ? (
                <div className="space-y-1">
                  <span className="whitespace-nowrap font-mono text-xl font-black text-foreground sm:text-4xl">
                    {formattedTime}
                  </span>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {locale === "ar" ? "توقيت المباراة" : "Coup d'envoi"}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="whitespace-nowrap font-mono text-3xl font-black text-foreground sm:text-5xl lg:text-6xl tabular-nums">
                    <span>{match.homeScore ?? 0}</span>
                    <span className="mx-1 text-muted-foreground sm:mx-2">-</span>
                    <span>{match.awayScore ?? 0}</span>
                  </div>
                  {match.status === "LIVE" && (
                    <MatchLiveClock matchDate={match.matchDate} hasExtraTime={match.hasExtraTime} hasPenaltyShootout={match.hasPenaltyShootout} homeScore={match.homeScore} awayScore={match.awayScore} addedTime={match.addedTime} locale={locale} compact />
                  )}
                  {winnerName && (
                    <p className="mt-2 max-w-[180px] text-wrap text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      {locale === "ar" ? `الفائز: ${winnerName}` : `Vainqueur : ${winnerName}`}
                      {match.decidedByPenalties && <span className="mt-1 block font-mono" dir="ltr">({locale === "ar" ? "ترجيح" : "TAB"} {match.homePenaltyScore}–{match.awayPenaltyScore})</span>}
                    </p>
                  )}
                  {match.status === "FINISHED" && match.hasPenaltyShootout && !winnerName && match.homeScore === match.awayScore && (
                    <p className="mt-2 max-w-[180px] text-wrap text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                      {locale === "ar" ? "ركلات الترجيح لم تحسم بعد" : "Séance de tirs au but non départagée"}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Away Team */}
            <div className="flex min-w-0 self-start flex-col items-center px-1 sm:px-2">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border bg-transparent shadow-xs sm:h-20 sm:w-20">
                {awayLogoUrl ? (
                  <OpponentCrest src={awayLogoUrl} alt={awayTeamName} className="h-full w-full rounded-full object-contain p-1.5" iconClassName="h-8 w-8 text-muted-foreground/60 sm:h-10 sm:w-10" />
                ) : (
                  <Shield className="h-8 w-8 text-muted-foreground/60 sm:h-10 sm:w-10" />
                )}
              </div>
              <h2 className="mt-3 w-full max-w-xs break-words text-base font-extrabold leading-snug text-foreground sm:text-xl lg:text-2xl">
                {awayTeamName}
              </h2>
              {!match.isHomeFixture && (
                <span className="mt-2 max-w-full rounded-md bg-club-primary/10 px-2 py-0.5 text-[10px] font-semibold text-club-primary sm:text-[11px]">
                  {locale === "ar" ? "نادينا" : "Notre Club"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Details Footer */}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 border-t border-border/80 bg-muted/20 px-4 py-4 text-xs text-muted-foreground sm:px-6">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-club-primary" />
            <span>{formattedDate}</span>
          </div>
          {match.stadium && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-club-primary" />
              <span>{locale === "ar" ? match.stadium : frenchPublicText(match.stadium, "Stade communal Taheri Hosni – Sidi Hosni")}</span>
            </div>
          )}
          {splitRefereeNames(locale === "fr" ? match.refereeNameFr || match.refereeNameAr || match.refereeName : match.refereeNameAr || match.refereeNameFr || match.refereeName).map((referee, index) => (
            <div key={`${referee}-${index}`} className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-club-primary" />
              <span className="font-semibold">{getRefereeRoleLabel(index, locale)}:</span>
              <span>{locale === "ar" ? referee : frenchPublicText(referee, "Non communiqué")}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Match Report Summary */}
      {(locale === "ar" ? match.matchReport : frenchPublicText(match.matchReport, "")) && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
          <h3 className="text-lg font-bold text-foreground mb-3">
            {locale === "ar" ? "تقرير المباراة" : "Résumé du match"}
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
            {locale === "ar" ? match.matchReport : frenchPublicText(match.matchReport, "")}
          </p>
        </div>
      )}

      <PublicMatchSections
        locale={locale}
        canViewLineup={showOfficialLineup}
        showEvents={showMatchEvents}
        initialTab={query.tab === "lineup" ? "lineup" : "events"}
      >
      {/* Official Lineups & Tactical Pitch (Locked Spec A.5) */}
      {showOfficialLineup && (
        <div data-match-panel="lineup" className="min-w-0 space-y-4">
        {(match.startingLineup.length > 0 || match.substitutes.length > 0) ? (
        <section className="overflow-hidden rounded-3xl border border-border/80 bg-card/45 p-3 shadow-sm sm:p-5">
          <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-1 pb-4 sm:mb-5 sm:px-2">
            <div>
              <h3 className="text-lg font-extrabold tracking-tight text-foreground sm:text-xl">
                {locale === "ar" ? "التشكيلة الرسمية" : "Composition officielle"}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {locale === "ar" ? "الرسم التكتيكي وقائمة اللاعبين حسب المركز" : "Schéma tactique et joueurs classés par poste"}
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {match.startingLineup.length} {locale === "ar" ? "أساسي" : "titulaires"}
            </span>
          </header>

          <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.18fr)] xl:gap-5">
            {match.startingLineup.length > 0 && (
              <div className="mx-auto w-full max-w-[460px] rounded-2xl border border-border/70 bg-background/55 p-2.5 shadow-inner sm:p-3">
                <TacticalPitch startingLineup={match.startingLineup} isClubTeam locale={locale} />
              </div>
            )}

            <div className="min-w-0">
              <MatchLineupCarousel
                startingLineup={match.startingLineup}
                substitutes={match.substitutes}
                locale={locale}
                categorySlug={(match.teamCategory || "senior").toLowerCase()}
              />
            </div>
          </div>
        </section>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 px-4 py-8 text-center">
            <UsersRound className="mx-auto h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-foreground">
              {locale === "ar" ? "لم تُنشر التشكيلة الرسمية بعد" : "La composition officielle n’a pas encore été publiée"}
            </p>
          </div>
        )}
        </div>
      )}

      {/* Match Events Timeline */}
      <div data-match-panel="events" className="min-w-0 space-y-4">
      {showMatchEvents && match.events.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
          <h3 className="text-lg font-bold text-foreground mb-4">
            {tPublic("matches.events")}
          </h3>

          <div className="space-y-3">
            {match.events.map((event) => {
              const isOpponentEvent = event.side !== (match.isHomeFixture ? "HOME" : "AWAY");
              const eventTeamName = event.side === "HOME" ? homeTeamName : awayTeamName;
              const eventTeamLogo = event.side === "HOME" ? homeLogoUrl : awayLogoUrl;
              const eventPersonName = locale === "ar"
                ? (event.playerName !== "—" ? event.playerName : event.staffName || "—")
                : (event.playerName !== "—"
                  ? event.playerNameFr || event.playerName || "Joueur"
                  : event.staffNameFr || "Arbitre");
              return (
                <article
                  key={event.id}
                  dir={isOpponentEvent
                    ? (locale === "ar" ? "ltr" : "rtl")
                    : (locale === "ar" ? "rtl" : "ltr")}
                  className="flex min-w-0 flex-row items-center justify-between gap-2 rounded-2xl border border-border/60 bg-background/60 p-3.5 text-sm shadow-2xs transition-colors hover:border-club-primary/30 hover:bg-muted/30 sm:gap-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-club-primary/15 bg-club-primary/5 font-mono text-xs font-black text-club-primary">
                      {event.minute}&apos;
                    </span>
                    <div className="min-w-0 flex-1 text-start">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="inline-flex min-h-9 max-w-full items-center break-words font-bold leading-tight text-foreground">{eventPersonName}</span>
                        <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-bold", eventTypeTone(event.type))}>
                          {eventTypeIcon(event.type)}
                          <span>{eventTypeLabel(event.type)}</span>
                        </span>
                      </div>
                      {(locale === "ar" ? event.notes : frenchPublicText(event.notes, "")) && (
                        <p className="mt-1 break-words text-xs text-muted-foreground">{locale === "ar" ? event.notes : frenchPublicText(event.notes, "")}</p>
                      )}
                    </div>
                  </div>
                  <span
                    aria-label={eventTeamName}
                    title={eventTeamName}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center self-center overflow-hidden rounded-full border border-border/70 bg-transparent p-0 text-[11px] font-semibold text-muted-foreground sm:h-auto sm:w-auto sm:gap-1.5 sm:rounded-full sm:px-2.5 sm:py-1.5"
                  >
                    {eventTeamLogo ? (
                      <OpponentCrest src={eventTeamLogo} className="h-5 w-5 shrink-0 rounded-full object-contain sm:h-4 sm:w-4" iconClassName="h-3.5 w-3.5 shrink-0 text-club-primary" />
                    ) : (
                      <Shield className="h-3.5 w-3.5 shrink-0 text-club-primary" aria-hidden="true" />
                    )}
                    <span className="hidden truncate sm:inline">{eventTeamName}</span>
                  </span>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {showMatchEvents && match.events.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 px-4 py-8 text-center text-sm text-muted-foreground">
          {locale === "ar" ? "لا توجد أحداث مسجلة لهذه المباراة." : "Aucun événement n’a été enregistré pour ce match."}
        </div>
      )}
      {showOfficialLineup && !showMatchEvents && (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 px-4 py-8 text-center text-sm text-muted-foreground">
          {locale === "ar" ? "ستظهر أحداث المباراة عند انطلاقها." : "Les événements apparaîtront au coup d’envoi."}
        </div>
      )}

      {match.status !== "CANCELLED" && match.hasPenaltyShootout && match.shootoutKicks.length > 0 && (
        <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-xs">
          <h3 className="mb-4 text-lg font-bold text-foreground">{locale === "ar" ? "ركلات الترجيح" : "Tirs au but"}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["HOME", "AWAY"] as const).map((side) => <div key={side} className="rounded-xl border border-border/70 p-4">
              <h4 className="mb-3 font-bold">{side === "HOME" ? homeTeamName : awayTeamName}</h4>
              <ol className="space-y-2">{match.shootoutKicks.filter((kick) => kick.side === side).map((kick) => {
                const isOpponentKick = kick.side !== (match.isHomeFixture ? "HOME" : "AWAY");
                return <li key={kick.id} className={cn("flex items-center justify-between rounded-lg bg-background/60 px-3 py-2 text-sm", isOpponentKick && "flex-row-reverse")}>
                <span>{kick.attemptNumber}. {locale === "ar" ? kick.playerName : kick.playerNameFr || frenchPublicText(kick.playerName, "Joueur")}</span>
                <span className={kick.result === "SCORED" ? "inline-flex items-center gap-1 text-emerald-500" : "inline-flex items-center gap-1 text-red-500"}>{kick.result === "SCORED" ? <CircleCheck className="h-4 w-4" /> : <CircleX className="h-4 w-4" />}{kick.result === "SCORED" ? (locale === "ar" ? "سجل" : "Marqué") : (locale === "ar" ? "أضاع" : "Manqué")}</span>
              </li>;
              })}</ol>
            </div>)}
          </div>
        </section>
      )}
      </div>
      </PublicMatchSections>

    </div>
  );
}
