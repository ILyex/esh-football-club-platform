import Link from "next/link";
import { Calendar, MapPin, Trophy, Shield } from "lucide-react";
import { PublicMatchItem } from "@/lib/public/matches";
import { frenchPublicCategory, frenchPublicText, localizedClubName } from "@/lib/public/locale-text";
import { MatchOperationalStatus } from "@/components/matches/match-operational-status";

interface MatchCardProps {
  match: PublicMatchItem;
  locale: string;
  labels: {
    scheduled: string;
    live: string;
    finished: string;
    postponed: string;
    cancelled: string;
    details: string;
    home: string;
    away: string;
  };
}

export function MatchCard({ match, locale, labels }: MatchCardProps) {
  const isFinished = match.status === "FINISHED";
  const isLive = match.status === "LIVE";
  const winnerName = match.winnerSide === "HOME"
    ? localizedClubName(match.homeTeamName, locale, locale === "fr" ? "Club Espoir Sidi Hosni" : "نادي أمل سيدي حسني")
    : match.winnerSide === "AWAY"
      ? localizedClubName(match.awayTeamName, locale, locale === "fr" ? "Nom du club adverse" : "الفريق المنافس")
      : null;
  const categoryLabel = locale === "ar"
    ? ({ SENIOR: "الأكابر", U20: "U20", U17: "U17", U15: "U15" } as Record<string, string>)[match.teamCategory ?? ""] ?? match.teamCategory
    : match.teamCategory ? frenchPublicCategory(match.teamCategory) : null;

  const formattedDate = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(match.matchDate);

  const formattedTime = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(match.matchDate);

  return (
    <article className="group flex min-h-[270px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-club-primary/50 hover:shadow-lg sm:min-h-[300px]">
      {/* Top Header: Competition & Status Badge */}
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4 text-xs">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2 font-bold text-foreground">
            <Trophy className="h-3.5 w-3.5 shrink-0 text-club-secondary" />
            <span className="truncate">{locale === "ar" ? match.competitionName : frenchPublicText(match.competitionName, "Compétition officielle")}</span>
            {match.teamCategory && (
              <span className="inline-flex shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {categoryLabel}
              </span>
            )}
          </div>
        </div>
        <MatchOperationalStatus
          status={match.status}
          matchDate={match.matchDate}
          locale={locale}
          variant="card"
          labels={{ SCHEDULED: labels.scheduled, LIVE: labels.live, FINISHED: labels.finished, POSTPONED: labels.postponed, CANCELLED: labels.cancelled }}
          hasExtraTime={match.hasExtraTime}
          hasPenaltyShootout={match.hasPenaltyShootout}
          homeScore={match.homeScore}
          awayScore={match.awayScore}
          addedTime={match.addedTime}
        />
      </div>

      {/* Main Scoreboard Area */}
      <div className="grid flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 border-y border-border/60 bg-muted/20 px-2 py-4 sm:gap-2 sm:px-4 sm:py-6">
        {/* Home Team */}
        <div className="col-span-1 flex min-w-0 flex-col items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl border border-club-primary/20 bg-club-primary/10 shadow-xs transition-transform group-hover:scale-105 sm:mb-3 sm:h-14 sm:w-14">
            <Shield className="h-6 w-6 text-club-primary sm:h-7 sm:w-7" />
          </div>
          <span className="line-clamp-2 w-full break-words text-[11px] font-extrabold leading-4 text-foreground sm:text-[13px] sm:leading-5">
            {localizedClubName(match.homeTeamName, locale, match.isHomeFixture ? (locale === "fr" ? "Club Espoir Sidi Hosni" : "نادي أمل سيدي حسني") : (locale === "fr" ? "Nom du club adverse" : "الفريق المنافس"))}
          </span>
          <span className="mt-1 rounded-full bg-club-primary/10 px-2 py-0.5 text-[10px] font-bold text-club-primary">
            {labels.home}
          </span>
        </div>

        {/* Middle Score or Kickoff Time */}
        <div className="col-span-1 flex flex-col items-center justify-center text-center">
          <span className="mb-2 line-clamp-2 max-w-20 text-[9px] font-bold leading-3 text-muted-foreground sm:max-w-none sm:text-[10px] sm:leading-normal sm:uppercase sm:tracking-wider">
            {isLive ? (locale === "ar" ? "النتيجة الحالية" : "Score en direct") : (locale === "ar" ? "موعد المباراة" : "Coup d’envoi")}
          </span>
          {isFinished || isLive ? (
            <div className="flex items-center justify-center gap-1 rounded-xl border border-border bg-card px-2 py-2 text-base font-black tracking-tight text-foreground shadow-sm font-mono tabular-nums sm:gap-1.5 sm:px-3 sm:text-lg">
              <span className="min-w-4 text-center">{match.homeScore ?? 0}</span>
              <span className="text-muted-foreground text-xs font-normal">-</span>
              <span className="min-w-4 text-center">{match.awayScore ?? 0}</span>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card px-2 py-2 text-[11px] font-bold font-mono text-muted-foreground shadow-sm sm:px-3 sm:text-xs">
              {formattedTime}
            </div>
          )}
          {isLive && (
            <span className="relative mt-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
          )}
        </div>

        {/* Away Team */}
        <div className="col-span-1 flex min-w-0 flex-col items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card shadow-xs transition-transform group-hover:scale-105 sm:mb-3 sm:h-14 sm:w-14">
            <Shield className="h-6 w-6 text-muted-foreground sm:h-7 sm:w-7" />
          </div>
          <span className="line-clamp-2 w-full break-words text-[11px] font-extrabold leading-4 text-foreground sm:text-[13px] sm:leading-5">
            {localizedClubName(match.awayTeamName, locale, match.isHomeFixture ? (locale === "fr" ? "Nom du club adverse" : "الفريق المنافس") : (locale === "fr" ? "Club Espoir Sidi Hosni" : "نادي أمل سيدي حسني"))}
          </span>
          <span className="mt-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            {labels.away}
          </span>
        </div>
        {winnerName && (
          <div className="col-span-3 flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{locale === "ar" ? `الفائز: ${winnerName}` : `Vainqueur : ${winnerName}`}</span>
            {match.decidedByPenalties && (
              <span dir="ltr" className="rounded-md bg-emerald-500/10 px-2 py-0.5 font-mono tabular-nums">
                {locale === "ar" ? "ترجيح" : "TAB"} {match.homePenaltyScore ?? 0}–{match.awayPenaltyScore ?? 0}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer Info & Match Center Link */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-xs text-muted-foreground">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5 truncate">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>{formattedDate}</span>
          </div>
          {match.stadium && (
            <div className="hidden min-w-0 items-center gap-1.5 truncate sm:flex">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{locale === "ar" ? match.stadium : frenchPublicText(match.stadium, "Stade communal Taheri Hosni – Sidi Hosni")}</span>
            </div>
          )}
        </div>

        <Link
          href={`/${locale}/matches/${match.id}`}
          className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg border border-club-primary/20 bg-club-primary/10 px-3 py-1.5 font-bold text-club-primary transition-colors hover:bg-club-primary hover:text-white"
        >
          <span>{labels.details}</span>
          <span>{locale === "ar" ? "←" : "→"}</span>
        </Link>
      </div>
    </article>
  );
}
