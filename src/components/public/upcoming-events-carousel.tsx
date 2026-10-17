"use client";

import { formatAlgeriaTime } from "@/lib/dates/algeria";
import { matchStadium } from "@/lib/matches/stadium";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Trophy,
  Calendar,
  MapPin,
  Clock,
  Activity,
  Radio,
  Shield,
  ListChecks,
  ChevronLeft,
  ChevronRight,
  UsersRound,
  CheckCircle2
} from "lucide-react";
import { MatchCountdown } from "@/components/public/match-countdown";
import { MatchLiveClock } from "@/components/matches/match-live-clock";
import { frenchPublicText, localizedClubName } from "@/lib/public/locale-text";
import { useSwipeCarousel } from "@/hooks/use-swipe-carousel";
import { getMatchClockState, type MatchAddedTimeSettings } from "@/lib/matches/clock";
import { OpponentCrest } from "@/components/public/opponent-crest";

export interface PublicMatchItemData {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
  matchDate: Date | string;
  stadium: string | null;
  competitionName: string;
  isHomeFixture: boolean;
  homeScore?: number | null;
  awayScore?: number | null;
  status?: string;
  hasExtraTime?: boolean;
  hasPenaltyShootout?: boolean;
  addedTime?: MatchAddedTimeSettings;
  teamCategory?: string | null;
  opponentLogo?: string | null;
}

export interface PublicTrainingItemData {
  id: string;
  teamCategory: string;
  teamName: string;
  date: Date | string;
  startTime: string;
  endTime?: string | null;
  location: string;
  notes?: string | null;
}

const CATEGORY_LABELS: Record<string, { ar: string; fr: string }> = {
  SENIOR: { ar: "الأكابر", fr: "Séniors" },
  U20: { ar: "U20", fr: "U20" },
  U17: { ar: "U17", fr: "U17" },
  U15: { ar: "U15", fr: "U15" }
};

export function getCategoryBadgeLabel(cat: string | null | undefined, locale: string): string {
  if (!cat) return locale === "ar" ? "الأكابر" : "Séniors";
  const mapped = CATEGORY_LABELS[cat.toUpperCase()];
  if (mapped) return locale === "ar" ? mapped.ar : mapped.fr;
  return cat;
}

function normalizeTrainingLabel(value: string): string {
  return value
    .replace(/\([^)]*\)/g, " ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .toLocaleLowerCase()
    .replace(/^(?:ال|les?|l)/, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function getTrainingPeriod(date: Date | string, startTime: string, endTime?: string | null) {
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Algiers", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date(date));
  const part = (type: Intl.DateTimeFormatPartTypes) => dateParts.find((item) => item.type === type)?.value ?? "0";
  const year = Number(part("year"));
  const month = Number(part("month"));
  const day = Number(part("day"));
  const toAlgiersTime = (time: string) => {
    const [hour = "0", minute = "0"] = time.split(":");
    // Algeria uses UTC+1; convert the local training schedule to an absolute instant.
    return new Date(Date.UTC(year, month - 1, day, Number(hour), Number(minute)) - 60 * 60 * 1000);
  };
  const startsAt = toAlgiersTime(startTime);
  let endsAt = toAlgiersTime(endTime || startTime);
  if (endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 24 * 60 * 60 * 1000);
  return { startsAt, endsAt };
}

function formatTrainingRemaining(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

// ============================================================================
// 1. UPCOMING MATCHES CAROUSEL
// ============================================================================
interface UpcomingMatchesCarouselProps {
  matches: PublicMatchItemData[];
  locale?: string;
}

export function UpcomingMatchesCarousel({
  matches,
  locale = "ar"
}: UpcomingMatchesCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoplayReset, setAutoplayReset] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const clockId = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(clockId);
  }, []);
  useEffect(() => {
    if (matches.length < 2) return;
    const intervalId = window.setInterval(() => {
      setCurrentIndex((index) => (index + 1) % matches.length);
    }, 28_000);
    return () => window.clearInterval(intervalId);
  }, [matches.length, autoplayReset]);
  const isRtl = locale === "ar";
  const PrevArrow = isRtl ? ChevronRight : ChevronLeft;
  const NextArrow = isRtl ? ChevronLeft : ChevronRight;

  const count = matches.length;
  const swipe = useSwipeCarousel(
    () => {
      setCurrentIndex((prev) => (prev + 1) % Math.max(count, 1));
      setAutoplayReset((value) => value + 1);
    },
    () => {
      setCurrentIndex((prev) => (prev - 1 + Math.max(count, 1)) % Math.max(count, 1));
      setAutoplayReset((value) => value + 1);
    }
  );

  if (count === 0) {
    return (
      <section className="relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-border bg-white dark:bg-card p-4 sm:p-8 shadow-sm">
        <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-border/70 pb-3 mb-6">
          <Trophy className="h-5 w-5 text-club-primary" />
          <h2 className="text-base sm:text-lg font-bold text-foreground">
            {locale === "ar" ? "المباريات القادمة" : "Prochains Matchs"}
          </h2>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <Calendar className="h-10 w-10 mb-3 opacity-30 text-club-primary" />
          <p className="text-sm font-semibold">
            {locale === "ar" ? "لا توجد مباريات قادمة" : "Aucun match prévu pour le moment"}
          </p>
        </div>
      </section>
    );
  }

  const currentMatch = matches[currentIndex] || matches[0]!;
  const matchDate = new Date(currentMatch.matchDate);
  const now = new Date(nowMs);
  const isCancelled = currentMatch.status === "CANCELLED";
  const currentClockState = getMatchClockState(
    currentMatch.matchDate,
    now,
    currentMatch.hasExtraTime ?? false,
    currentMatch.hasPenaltyShootout ?? false,
    currentMatch.homeScore,
    currentMatch.awayScore,
    currentMatch.addedTime
  );
  const isFinished = currentMatch.status === "FINISHED" ||
    ((currentMatch.status === "LIVE" || currentMatch.status === "IN_PROGRESS") && currentClockState.finished);
  const isImminent = !isCancelled && currentMatch.status === "SCHEDULED" &&
    matchDate.getTime() > now.getTime() && matchDate.getTime() - now.getTime() <= 30 * 60 * 1000;
  const isLive =
    !isCancelled && !isFinished && (currentMatch.status === "LIVE" || currentMatch.status === "IN_PROGRESS");
  const isPostponed = currentMatch.status === "POSTPONED" || isCancelled;
  const matchBadgeLabel = isLive
    ? (locale === "ar" ? "المباراة الحالية" : "Match en cours")
    : isFinished
      ? (locale === "ar" ? "انتهت المباراة" : "Match terminé")
      : isPostponed
        ? (locale === "ar" ? "مباراة مؤجلة" : "Match reporté")
        : isImminent
          ? (locale === "ar" ? "تبدأ قريبًا" : "Débute bientôt")
          : (locale === "ar" ? "المباراة القادمة" : "Prochain Match");
  const MatchBadgeIcon = isLive
    ? Radio
    : isFinished
      ? CheckCircle2
      : isImminent || isPostponed
        ? Clock
        : Calendar;
  const canOpenLineup = isImminent || isLive;
  // Events are meaningful only once a match has started or finished. Keep
  // scheduled fixtures focused on the kickoff countdown and match details.
  const canOpenEvents = isLive || isFinished;
  const statusLabel = isLive
    ? (locale === "ar" ? "مباشرة الآن" : "En direct")
    : isImminent
      ? (locale === "ar" ? "تبدأ قريبًا" : "Débute bientôt")
      : isPostponed
        ? (locale === "ar" ? "مؤجلة" : "Reportée")
        : isFinished
          ? (locale === "ar" ? "انتهت" : "Terminée")
          : (locale === "ar" ? "مبرمجة" : "Programmée");
  const StatusIcon = isLive ? Radio : isImminent || isPostponed ? Clock : isFinished ? CheckCircle2 : Calendar;
  const statusTone = isLive
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    : isImminent
      ? "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400"
      : isPostponed
      ? "border-white bg-blue-600 text-white"
        : "border-zinc-500/30 bg-zinc-500/10 text-zinc-600 dark:text-zinc-300";

  const categoryDisplay = getCategoryBadgeLabel(currentMatch.teamCategory, locale);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + count) % count);
    setAutoplayReset((value) => value + 1);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % count);
    setAutoplayReset((value) => value + 1);
  };
  return (
    <section {...swipe} className="public-match-card relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-border bg-white dark:bg-card p-3 sm:rounded-3xl sm:p-8 lg:p-10 shadow-lg dark:shadow-2xl transition-colors carousel-no-stroke select-none outline-none focus:outline-none">
      {/* Header bar: Title, Category Badge, and Slide Controls */}
      <div className="relative z-10 mb-4 flex flex-row flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-3 dark:border-border/70 sm:mb-6 sm:gap-3 sm:pb-4">
        <div className="flex w-fit max-w-full flex-nowrap items-center gap-1.5 sm:gap-2.5">
          <div
            aria-label={matchBadgeLabel}
            title={matchBadgeLabel}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-club-primary px-2.5 py-1.5 text-[10px] font-bold text-white shadow-xs select-none outline-none focus:outline-none focus:ring-0 sm:gap-2 sm:rounded-xl sm:px-3.5 sm:py-2 sm:text-sm"
          >
            <MatchBadgeIcon className={`h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4 ${isLive ? "animate-pulse" : ""}`} aria-hidden="true" />
            <span>{matchBadgeLabel}</span>
          </div>

          <span
            aria-label={categoryDisplay}
            title={categoryDisplay}
            className="inline-flex shrink-0 items-center rounded-lg border border-rose-500/25 bg-rose-500/10 px-2 py-1.5 text-[10px] font-bold text-rose-600 select-none outline-none focus:outline-none focus:ring-0 dark:text-rose-400 sm:rounded-xl sm:px-3.5 sm:py-2 sm:text-sm"
          >
            <span>{categoryDisplay}</span>
          </span>

          {!isFinished && (isLive || isImminent || isPostponed) && (
            <span
              aria-label={statusLabel}
              title={statusLabel}
              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border p-0 sm:h-auto sm:w-auto sm:gap-1.5 sm:rounded-xl sm:px-2.5 sm:py-1 sm:text-[11px] sm:font-bold ${statusTone}`}
            >
              <StatusIcon className={`h-3.5 w-3.5 ${isLive ? "animate-pulse" : ""}`} aria-hidden="true" />
              <span className="hidden sm:inline">{statusLabel}</span>
            </span>
          )}
        </div>

        {/* Match details and carousel controls */}
        <div className="contents select-none lg:flex lg:w-auto lg:flex-row lg:items-center lg:gap-2">
          <div className="flex items-center gap-1.5">
          {canOpenEvents && <Link
            href={`/${locale}/matches/${currentMatch.id}?tab=events`}
            aria-label={locale === "ar" ? "أحداث المباراة" : "Événements du match"}
            title={locale === "ar" ? "أحداث المباراة" : "Événements du match"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-500/35 bg-gradient-to-br from-rose-500/15 to-rose-500/5 p-0 text-rose-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-rose-500/60 hover:bg-rose-500/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 lg:h-11 lg:w-auto lg:gap-2 lg:px-3 lg:text-xs lg:font-bold dark:text-rose-400"
          >
            <ListChecks className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="hidden lg:inline">{locale === "ar" ? "أحداث المباراة" : "Événements"}</span>
          </Link>}
          {canOpenLineup && (
            <Link
              href={`/${locale}/matches/${currentMatch.id}?tab=lineup`}
              aria-label={locale === "ar" ? "تشكيلة المباراة" : "Composition du match"}
              title={locale === "ar" ? "تشكيلة المباراة" : "Composition du match"}
              className="relative z-[1] inline-flex h-9 w-9 transform-gpu items-center justify-center rounded-xl border border-emerald-500/35 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 p-0 text-emerald-700 shadow-sm transition duration-200 ease-out hover:-translate-y-1 hover:scale-[1.03] hover:border-emerald-500/60 hover:bg-emerald-500/20 hover:shadow-lg focus-visible:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 active:scale-95 dark:text-emerald-300 lg:h-11 lg:w-auto lg:gap-2 lg:px-3 lg:text-xs lg:font-bold"
            >
              <UsersRound className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="hidden lg:inline">{locale === "ar" ? "التشكيلة" : "Composition"}</span>
            </Link>
          )}
          </div>
          {count > 1 && (
            <div className="hidden shrink-0 items-center gap-1 lg:flex">
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrev}
                  aria-label={locale === "ar" ? "المباراة السابقة" : "Précédent"}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 dark:border-border/80 bg-zinc-50 dark:bg-muted/40 text-foreground hover:bg-zinc-100 dark:hover:bg-muted transition-colors shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary/40 active:scale-95 sm:h-11 sm:w-11"
                >
                  <PrevArrow className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  aria-label={locale === "ar" ? "المباراة التالية" : "Suivant"}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 dark:border-border/80 bg-zinc-50 dark:bg-muted/40 text-foreground hover:bg-zinc-100 dark:hover:bg-muted transition-colors shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary/40 active:scale-95 sm:h-11 sm:w-11"
                >
                  <NextArrow className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Sliding Match Track */}
      <div className="relative z-10 overflow-hidden w-full">
        <div
          className="flex w-full transition-transform duration-700 ease-in-out will-change-transform"
          style={{
            transform: isRtl
              ? `translateX(${currentIndex * 100}%)`
              : `translateX(-${currentIndex * 100}%)`
          }}
        >
          {matches.map((m) => {
            const mDate = new Date(m.matchDate);
            const shortMatchDate = new Intl.DateTimeFormat(locale, {
              weekday: "short",
              day: "numeric",
              month: "short",
              timeZone: "Africa/Algiers"
            }).format(mDate);
            const mCancelled = m.status === "CANCELLED";
            const mClockState = getMatchClockState(
              m.matchDate,
              now,
              m.hasExtraTime ?? false,
              m.hasPenaltyShootout ?? false,
              m.homeScore,
              m.awayScore,
              m.addedTime
            );
            const mFinished = m.status === "FINISHED" ||
              ((m.status === "LIVE" || m.status === "IN_PROGRESS") && mClockState.finished);
            const mImminent = !mCancelled && m.status === "SCHEDULED" &&
              mDate.getTime() > now.getTime() && mDate.getTime() - now.getTime() <= 30 * 60 * 1000;
            const mIsLive =
              !mCancelled && !mFinished && (m.status === "LIVE" || m.status === "IN_PROGRESS");
            const hasResult = mIsLive || mFinished;
            return (
              <div key={m.id} className="w-full shrink-0 space-y-3 px-0.5 outline-none focus:outline-none sm:space-y-6">
                {/* Stadium is shown once, outside the score card. */}
                <div className="flex min-w-0 items-center justify-start gap-2 sm:gap-3">
                  <div className="flex max-w-[62%] min-w-0 items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-[10px] font-medium text-zinc-700 dark:border-border dark:bg-muted/60 dark:text-muted-foreground sm:max-w-full sm:px-3 sm:py-1.5 sm:text-xs">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-club-primary" />
                    <span className="truncate">
                      {locale === "ar"
                        ? matchStadium(m.isHomeFixture, m.stadium)
                        : frenchPublicText(matchStadium(m.isHomeFixture, m.stadium), "Stade communal Taheri Hosni – Sidi Hosni")}
                    </span>
                  </div>
                </div>

                {/* Purpose-built phone scoreboard */}
                <div className="rounded-2xl border border-border/80 bg-card/70 p-3 shadow-sm md:hidden">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                    <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-club-primary/20 bg-background p-2">
                        {m.isHomeFixture ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src="/branding/esh-logo-128.png" alt="" className="h-full w-full object-contain" />
                        ) : m.opponentLogo ? (
                          <OpponentCrest src={m.opponentLogo} className="h-full w-full object-contain" />
                        ) : <Shield className="h-6 w-6 text-muted-foreground" aria-hidden="true" />}
                      </div>
                      <span className="line-clamp-2 w-full break-words text-[11px] font-extrabold leading-4 text-foreground">
                        {localizedClubName(m.homeTeamName, locale, m.isHomeFixture ? (locale === "fr" ? "Club Espoir Sidi Hosni" : "نادي أمل سيدي حسني") : (locale === "fr" ? "Nom du club adverse" : "الفريق المنافس"))}
                      </span>
                    </div>

                    <div className="flex min-w-[88px] flex-col items-center justify-center gap-1.5 text-center">
                      {hasResult ? (
                        <div dir="ltr" className="inline-flex items-center gap-2 rounded-xl border border-club-primary/20 bg-club-primary/5 px-3 py-2 font-mono text-2xl font-black leading-none tabular-nums text-foreground">
                          <span>{m.homeScore ?? 0}</span>
                          <span className="text-base text-muted-foreground">–</span>
                          <span>{m.awayScore ?? 0}</span>
                        </div>
                      ) : (
                        <>
                          <span className="max-w-full truncate text-[9px] font-semibold text-muted-foreground">{shortMatchDate}</span>
                          <span className="rounded-xl bg-club-primary/10 px-3 py-2 font-mono text-lg font-black leading-none tabular-nums text-club-primary dark:text-foreground">
                            {formatAlgeriaTime(mDate, locale)}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-background p-2">
                        {!m.isHomeFixture ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src="/branding/esh-logo-128.png" alt="" className="h-full w-full object-contain" />
                        ) : m.opponentLogo ? (
                          <OpponentCrest src={m.opponentLogo} className="h-full w-full object-contain" />
                        ) : <Shield className="h-6 w-6 text-muted-foreground" aria-hidden="true" />}
                      </div>
                      <span className="line-clamp-2 w-full break-words text-[11px] font-extrabold leading-4 text-foreground">
                        {localizedClubName(m.awayTeamName, locale, m.isHomeFixture ? (locale === "fr" ? "Nom du club adverse" : "الفريق المنافس") : (locale === "fr" ? "Club Espoir Sidi Hosni" : "نادي أمل سيدي حسني"))}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex min-h-8 flex-wrap items-center justify-center gap-2 border-t border-border/70 pt-2.5">
                    {mIsLive ? (
                      <>
                        <MatchLiveClock matchDate={mDate} hasExtraTime={m.hasExtraTime} hasPenaltyShootout={m.hasPenaltyShootout} homeScore={m.homeScore} awayScore={m.awayScore} addedTime={m.addedTime} locale={locale} compact presentation="clock" />
                        <MatchLiveClock matchDate={mDate} hasExtraTime={m.hasExtraTime} hasPenaltyShootout={m.hasPenaltyShootout} homeScore={m.homeScore} awayScore={m.awayScore} addedTime={m.addedTime} locale={locale} compact display="phase" />
                      </>
                    ) : mFinished ? (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">{locale === "ar" ? "انتهت المباراة" : "Match terminé"}</span>
                    ) : mCancelled ? (
                      <span className="rounded-full border border-white bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white">{locale === "ar" ? "مؤجلة" : "Reportée"}</span>
                    ) : mImminent ? (
                      <span className="rounded-full border border-orange-500/25 bg-orange-500/10 px-2.5 py-1 text-[10px] font-bold text-orange-600 dark:text-orange-400">{locale === "ar" ? "تبدأ قريبًا" : "Débute bientôt"}</span>
                    ) : (
                      <MatchCountdown targetDate={mDate} locale={locale} />
                    )}
                  </div>
                </div>

                {/* Central Match Duel */}
                <div className="hidden items-center gap-6 py-4 md:grid md:grid-cols-12">
                  {/* Home Team */}
                  <div className="group/team flex min-w-0 cursor-default flex-col items-center justify-center gap-1 rounded-2xl border border-transparent p-1 text-center transition-[background-color,border-color,box-shadow] duration-200 hover:border-club-primary/25 hover:bg-white/70 hover:shadow-md dark:hover:bg-background/55 sm:gap-3 sm:p-3 md:col-span-4 md:gap-4 md:rounded-3xl md:p-4">
                    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 p-1.5 shadow-sm transition-[border-color,box-shadow] duration-200 group-hover/team:border-club-primary/40 group-hover/team:shadow-md dark:border-border dark:bg-background sm:h-20 sm:w-20 sm:rounded-2xl sm:p-3 md:h-24 md:w-24">
                      {m.isHomeFixture ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src="/branding/esh-logo-128.png"
                          alt={m.homeTeamName}
                          className="h-full w-full object-contain"
                        />
                      ) : m.opponentLogo ? (
                        <OpponentCrest src={m.opponentLogo} alt={m.homeTeamName} className="h-full w-full object-contain" />
                      ) : (
                        <Shield className="h-10 w-10 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex min-w-0 w-full flex-col items-center">
                      <span className="mb-2 hidden w-fit rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-700 dark:bg-muted dark:text-muted-foreground sm:block">
                        {locale === "ar" ? "المضيف" : "Domicile"}
                      </span>
                      <h3 className="line-clamp-2 w-full break-words text-[11px] font-extrabold leading-4 text-zinc-900 transition-colors duration-200 group-hover/team:text-club-primary dark:text-foreground sm:min-h-16 sm:pb-1 sm:text-lg sm:leading-8 md:text-xl">
                        {localizedClubName(m.homeTeamName, locale, m.isHomeFixture ? (locale === "fr" ? "Club Espoir Sidi Hosni" : "نادي أمل سيدي حسني") : (locale === "fr" ? "Nom du club adverse" : "الفريق المنافس"))}
                      </h3>
                    </div>
                  </div>

                  {/* Center: Kickoff Date/Time & Live Countdown */}
                  <div className="group/center col-span-1 flex min-w-0 cursor-default flex-col items-center justify-center space-y-1.5 rounded-2xl border border-club-primary/15 bg-club-primary/[0.03] px-1.5 py-2 text-center sm:space-y-4 sm:rounded-3xl sm:border-zinc-200 sm:bg-zinc-50 sm:px-4 sm:py-6 sm:shadow-sm sm:dark:border-border/60 sm:dark:bg-muted/40 md:col-span-4">
                    <div className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted/70 px-2 py-1 text-[9px] font-bold text-zinc-700 dark:text-foreground sm:gap-2 sm:rounded-full sm:border sm:border-club-primary/15 sm:bg-club-primary/5 sm:px-3 sm:py-1.5 sm:text-xs">
                      <Calendar className="h-3 w-3 shrink-0 text-club-primary sm:h-4 sm:w-4" />
                      <span className="truncate sm:hidden">{shortMatchDate}</span>
                      <span className="hidden sm:inline">
                        {new Intl.DateTimeFormat(locale, {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric"
                        }).format(mDate)}
                      </span>
                    </div>

                    <div className="inline-flex min-h-9 min-w-[68px] items-center justify-center rounded-lg bg-club-primary/10 px-2 py-1 transition-transform duration-300 dark:bg-club-primary/15 sm:min-h-0 sm:min-w-36 sm:rounded-2xl sm:border sm:border-zinc-200 sm:bg-white sm:px-5 sm:py-2 sm:shadow-md sm:dark:border-border sm:dark:bg-background">
                      {mFinished ? (
                        <bdi dir="ltr" className="font-mono text-2xl font-black leading-none tabular-nums text-foreground sm:text-3xl">
                          {m.homeScore ?? 0}<span className="mx-2 text-muted-foreground">–</span>{m.awayScore ?? 0}
                        </bdi>
                      ) : mIsLive ? (
                        <MatchLiveClock matchDate={mDate} hasExtraTime={m.hasExtraTime} hasPenaltyShootout={m.hasPenaltyShootout} homeScore={m.homeScore} awayScore={m.awayScore} addedTime={m.addedTime} locale={locale} compact presentation="clock" />
                      ) : (
                        <span className="font-mono text-xl font-black tracking-wider text-club-primary tabular-nums dark:text-foreground sm:text-3xl sm:tracking-[0.18em]">
                          {formatAlgeriaTime(mDate, locale)}
                        </span>
                      )}
                    </div>

                    {/* Live Countdown or Live Status */}
                    <div className="w-full">
                      {mIsLive ? (
                        <MatchLiveClock matchDate={mDate} hasExtraTime={m.hasExtraTime} hasPenaltyShootout={m.hasPenaltyShootout} homeScore={m.homeScore} awayScore={m.awayScore} addedTime={m.addedTime} locale={locale} compact display="phase" />
                      ) : mFinished ? (
                        <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">{locale === "ar" ? "انتهت المباراة" : "Match terminé"}</span>
                      ) : mCancelled ? (
                        <div className="mx-auto inline-flex w-auto items-center justify-center rounded-full border border-white bg-blue-600 px-2.5 py-1 text-center shadow-2xs sm:px-3 sm:py-1.5">
                          <p className="text-[10px] font-bold text-white sm:text-xs">
                            {locale === "ar" ? "مؤجلة" : "Reportée"}
                          </p>
                        </div>
                      ) : mImminent ? (
                        <div className="mx-auto inline-flex w-auto items-center justify-center rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-center shadow-2xs sm:px-3 sm:py-1.5">
                          <p className="inline-flex items-center justify-center gap-1 text-[10px] font-bold text-orange-600 dark:text-orange-400 sm:gap-1.5 sm:text-xs">
                            <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
                            {locale === "ar" ? "تبدأ قريبًا" : "Débute bientôt"}
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="mb-1 hidden text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-muted-foreground sm:block sm:mb-2">
                            {locale === "ar" ? "العد التنازلي لانطلاق المواجهة" : "Coup d'envoi dans"}
                          </div>
                          <MatchCountdown targetDate={mDate} locale={locale} />
                        </>
                      )}
                    </div>

                  </div>

                  {/* Away Team */}
                  <div className="group/team flex min-w-0 cursor-default flex-col items-center justify-center gap-1 rounded-2xl border border-transparent p-1 text-center transition-[background-color,border-color,box-shadow] duration-200 hover:border-club-primary/25 hover:bg-white/70 hover:shadow-md dark:hover:bg-background/55 sm:gap-3 sm:p-3 md:col-span-4 md:gap-4 md:rounded-3xl md:p-4">
                    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 p-1.5 shadow-sm transition-[border-color,box-shadow] duration-200 group-hover/team:border-club-primary/40 group-hover/team:shadow-md dark:border-border dark:bg-background sm:h-20 sm:w-20 sm:rounded-2xl sm:p-3 md:h-24 md:w-24">
                      {!m.isHomeFixture ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src="/branding/esh-logo-128.png"
                          alt={m.awayTeamName}
                          className="h-full w-full object-contain"
                        />
                      ) : m.opponentLogo ? (
                        <OpponentCrest src={m.opponentLogo} alt={m.awayTeamName} className="h-full w-full object-contain" />
                      ) : (
                        <Shield className="h-10 w-10 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex min-w-0 w-full flex-col items-center">
                      <span className="mb-2 hidden w-fit rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-700 dark:bg-muted dark:text-muted-foreground sm:block">
                        {locale === "ar" ? "الضيف" : "Extérieur"}
                      </span>
                      <h3 className="line-clamp-2 w-full break-words text-[11px] font-extrabold leading-4 text-zinc-900 transition-colors duration-200 group-hover/team:text-club-primary dark:text-foreground sm:min-h-16 sm:pb-1 sm:text-lg sm:leading-8 md:text-xl">
                        {localizedClubName(m.awayTeamName, locale, m.isHomeFixture ? (locale === "fr" ? "Nom du club adverse" : "الفريق المنافس") : (locale === "fr" ? "Club Espoir Sidi Hosni" : "نادي أمل سيدي حسني"))}
                      </h3>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {count > 1 && (
        <div className="mt-3 flex justify-center gap-1" aria-label={locale === "ar" ? "التنقل بين المباريات" : "Navigation des matchs"}>
          {matches.map((match, index) => (
            <button
              key={match.id}
              type="button"
              onClick={() => {
                setCurrentIndex(index);
                setAutoplayReset((value) => value + 1);
              }}
              aria-label={locale === "ar" ? `المباراة ${index + 1}` : `Match ${index + 1}`}
              aria-current={index === currentIndex ? "true" : undefined}
              className="flex h-5 w-5 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary/40"
            >
              <span className={`block h-1.5 rounded-full transition-all ${index === currentIndex ? "w-2.5 bg-club-primary" : "w-1.5 bg-muted-foreground/40"}`} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

// ============================================================================
// 2. UPCOMING TRAININGS CAROUSEL
// ============================================================================
interface UpcomingTrainingsCarouselProps {
  trainings: PublicTrainingItemData[];
  locale?: string;
}

export function UpcomingTrainingsCarousel({
  trainings,
  locale = "ar"
}: UpcomingTrainingsCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoplayReset, setAutoplayReset] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);
  useEffect(() => {
    if (trainings.length < 2) return;
    const intervalId = window.setInterval(() => {
      setCurrentIndex((index) => (index + 1) % trainings.length);
    }, 36_000);
    return () => window.clearInterval(intervalId);
  }, [trainings.length, autoplayReset]);
  const isRtl = locale === "ar";
  const PrevArrow = isRtl ? ChevronRight : ChevronLeft;
  const NextArrow = isRtl ? ChevronLeft : ChevronRight;

  const count = trainings.length;
  const swipe = useSwipeCarousel(
    () => {
      setCurrentIndex((prev) => (prev + 1) % Math.max(count, 1));
      setAutoplayReset((value) => value + 1);
    },
    () => {
      setCurrentIndex((prev) => (prev - 1 + Math.max(count, 1)) % Math.max(count, 1));
      setAutoplayReset((value) => value + 1);
    }
  );

  if (count === 0) {
    return (
      <section className="relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-border bg-white dark:bg-card p-4 sm:p-8 shadow-sm">
        <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-border/70 pb-3 mb-6">
          <Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-base sm:text-lg font-bold text-foreground">
            {locale === "ar" ? "التدريبات القادمة" : "Prochains Entraînements"}
          </h2>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <Calendar className="h-10 w-10 mb-3 opacity-30 text-emerald-600" />
          <p className="text-sm font-semibold">
            {locale === "ar" ? "لا توجد تدريبات قادمة" : "Aucune séance d'entraînement programmée"}
          </p>
        </div>
      </section>
    );
  }

  const currentTraining = trainings[currentIndex] || trainings[0]!;
  const categoryDisplay = getCategoryBadgeLabel(currentTraining.teamCategory, locale);
  const currentTrainingPeriod = getTrainingPeriod(currentTraining.date, currentTraining.startTime, currentTraining.endTime);
  const currentTrainingIsLive = nowMs >= currentTrainingPeriod.startsAt.getTime() && nowMs < currentTrainingPeriod.endsAt.getTime();
  const currentTrainingHasEnded = nowMs >= currentTrainingPeriod.endsAt.getTime();
  const trainingTitle = currentTrainingIsLive
    ? (locale === "ar" ? "التدريبات الحالية" : "Entraînements en cours")
    : currentTrainingHasEnded
      ? (locale === "ar" ? "انتهى التدريب" : "Séance terminée")
      : (locale === "ar" ? "التدريبات القادمة" : "Prochains Entraînements");

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + count) % count);
    setAutoplayReset((value) => value + 1);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % count);
    setAutoplayReset((value) => value + 1);
  };
  return (
    <section {...swipe} className="public-training-card relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-border bg-white dark:bg-card p-4 sm:p-8 lg:p-10 shadow-lg dark:shadow-2xl transition-colors carousel-no-stroke select-none outline-none focus:outline-none">
      {/* Header bar: Title, Category Badge, Notice, and Controls */}
      <div className="relative z-10 mb-4 flex flex-col items-stretch gap-3 border-b border-zinc-200 pb-3 dark:border-border/70 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:pb-4">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5">
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-xs select-none outline-none focus:outline-none focus:ring-0 sm:gap-2 sm:rounded-xl sm:px-3.5 sm:py-2 sm:text-sm">
            <Activity className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
            <span>{trainingTitle}</span>
          </div>
          <span className="inline-flex items-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-bold text-emerald-700 select-none outline-none focus:outline-none focus:ring-0 dark:text-emerald-400 sm:rounded-xl sm:px-3.5 sm:py-2 sm:text-sm">
            {categoryDisplay}
          </span>

        </div>

        {/* Carousel controls (only visible if more than 1 training) */}
        {count > 1 && (
          <div className="hidden w-full min-w-0 items-center justify-between gap-2 select-none lg:flex lg:w-auto lg:justify-start">
            <div className="flex shrink-0 items-center gap-1">
                <button
                type="button"
                onClick={handlePrev}
                aria-label={locale === "ar" ? "التدريب السابق" : "Précédent"}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 dark:border-border/80 bg-zinc-50 dark:bg-muted/40 text-foreground hover:bg-zinc-100 dark:hover:bg-muted transition-colors shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 active:scale-95 sm:h-11 sm:w-11"
              >
                <PrevArrow className="h-4 w-4" />
              </button>
                <button
                type="button"
                onClick={handleNext}
                aria-label={locale === "ar" ? "التدريب التالي" : "Suivant"}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 dark:border-border/80 bg-zinc-50 dark:bg-muted/40 text-foreground hover:bg-zinc-100 dark:hover:bg-muted transition-colors shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 active:scale-95 sm:h-11 sm:w-11"
              >
                <NextArrow className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Sliding Training Track */}
      <div className="relative z-10 overflow-hidden w-full">
        <div
          className="flex w-full transition-transform duration-700 ease-in-out will-change-transform"
          style={{
            transform: isRtl
              ? `translateX(${currentIndex * 100}%)`
              : `translateX(-${currentIndex * 100}%)`
          }}
        >
          {trainings.map((t) => {
            const tCatDisplay = getCategoryBadgeLabel(t.teamCategory, locale);
            const tTeamName = locale === "ar"
              ? t.teamName
              : frenchPublicText(t.teamName, "Association Sportive Espoir Sidi Hosni de Football");
            const showTeamName = normalizeTrainingLabel(tTeamName) !== normalizeTrainingLabel(tCatDisplay);
            const tDate = new Date(t.date);
            const trainingPeriod = getTrainingPeriod(t.date, t.startTime, t.endTime);
            const trainingIsLive = nowMs >= trainingPeriod.startsAt.getTime() && nowMs < trainingPeriod.endsAt.getTime();
            const trainingHasEnded = nowMs >= trainingPeriod.endsAt.getTime();
            const trainingRemaining = formatTrainingRemaining(trainingPeriod.endsAt.getTime() - nowMs);
            const shortTrainingDate = new Intl.DateTimeFormat(locale, {
              weekday: "short",
              day: "numeric",
              month: "short"
            }).format(tDate);
            return (
              <div key={t.id} className="w-full shrink-0 space-y-3 px-0.5 outline-none focus:outline-none sm:space-y-6">
                {/* Meta Line: Category & Venue Badge */}
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <div className="flex max-w-full min-w-0 items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-[10px] font-medium text-zinc-700 dark:border-border dark:bg-muted/60 dark:text-muted-foreground sm:px-3 sm:py-1.5 sm:text-xs">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="truncate">
                      {t.location ||
                        (locale === "ar" ? "الملعب البلدي طاهري حسني – سيدي حسني" : "Stade communal Taheri Hosni – Sidi Hosni")}
                    </span>
                  </div>
                </div>

                {/* Compact mobile training card follows the match-card hierarchy. */}
                <div className="rounded-2xl border border-emerald-500/20 bg-zinc-50 p-3 shadow-sm dark:bg-muted/30 sm:p-4 md:hidden">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                        <Calendar className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                        <span className="truncate">{shortTrainingDate}</span>
                      </p>
                    </div>
                    <div className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-emerald-500/20 bg-white px-3 py-2 text-center dark:bg-background">
                      <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                      {trainingIsLive ? (
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <span className="block text-[9px] font-semibold leading-3 text-muted-foreground">{locale === "ar" ? "الوقت المتبقي" : "Restant"}</span>
                          <bdi dir="ltr" className="font-mono text-sm font-black leading-4 tracking-wide tabular-nums text-emerald-600 dark:text-emerald-400">{trainingRemaining}</bdi>
                        </div>
                      ) : trainingHasEnded ? (
                        <span className="text-[10px] font-bold text-muted-foreground">{locale === "ar" ? "انتهى التدريب" : "Séance terminée"}</span>
                      ) : (
                        <p className="font-mono text-base font-black leading-tight tabular-nums text-emerald-600 dark:text-emerald-400">
                          {t.startTime}{t.endTime ? ` – ${t.endTime}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  {t.notes && (
                    <p className="mt-3 line-clamp-2 border-t border-zinc-200 pt-2 text-[11px] leading-5 text-muted-foreground dark:border-border">
                      {locale === "ar" ? t.notes : frenchPublicText(t.notes, "Séance d'entraînement programmée")}
                    </p>
                  )}
                </div>

                {/* Central Training Details Grid */}
                <div className="hidden grid-cols-1 items-stretch gap-6 py-2 md:grid md:grid-cols-12 sm:py-4">
                  {/* Category & Program Description (md:col-span-5) */}
                  <div className="group/training md:col-span-5 flex flex-col justify-between rounded-2xl bg-zinc-50 dark:bg-muted/30 border border-zinc-200 dark:border-border/70 p-5 shadow-2xs transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-lg dark:hover:bg-muted/50">
                    <div className="space-y-3">
                      <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 w-fit">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>
                          {new Intl.DateTimeFormat(locale, {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric"
                          }).format(tDate)}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                        {locale === "ar"
                          ? (t.notes || "حصة تدريبية تكتيكية وبدنية مبرمجة في إطار البرنامج الأسبوعي للفريق")
                          : frenchPublicText(t.notes, "Séance d'entraînement technico-tactique et physique programmée dans le cadre de la semaine sportive")}
                      </p>
                    </div>

                    {showTeamName && <div className="pt-4 border-t border-zinc-200 dark:border-border/60 mt-4 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-medium">
                        {locale === "ar" ? "الفريق" : "Équipe"}
                      </span>
                      <span className="font-bold text-foreground">
                        {tTeamName}
                      </span>
                    </div>}
                  </div>

                  {/* Timing & Schedule (md:col-span-4) */}
                  <div className="group/training md:col-span-4 flex flex-col items-center justify-center text-center space-y-3 px-4 py-6 rounded-2xl bg-zinc-50 dark:bg-muted/40 border border-zinc-200 dark:border-border/60 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-lg dark:hover:bg-muted/60">
                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-800 dark:text-foreground">
                      <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span>{trainingIsLive
                        ? (locale === "ar" ? "الوقت المتبقي" : "Temps restant")
                        : (locale === "ar" ? "توقيت الحصة التدريبية" : "Horaire de la séance")}</span>
                    </div>

                    <div className="inline-flex items-center justify-center rounded-xl bg-white dark:bg-background border border-zinc-200 dark:border-border px-5 py-2.5 shadow-2xs transition-transform duration-300 group-hover/training:scale-105">
                      {trainingIsLive ? (
                        <bdi dir="ltr" className="font-mono text-2xl font-black tracking-wider tabular-nums text-emerald-600 dark:text-emerald-400">{trainingRemaining}</bdi>
                      ) : trainingHasEnded ? (
                        <span className="text-sm font-bold text-muted-foreground">{locale === "ar" ? "انتهى التدريب" : "Séance terminée"}</span>
                      ) : (
                        <span className="font-mono text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-wider tabular-nums">
                          {t.startTime}{t.endTime ? ` — ${t.endTime}` : ""}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] font-medium text-muted-foreground">
                      {locale === "ar" ? "حضور اللاعبين إجباري قبل انطلاق الحصة" : "Présence obligatoire des joueurs avant la séance"}
                    </div>
                  </div>

                  {/* Field & Location (md:col-span-3) */}
                  <div className="group/training md:col-span-3 flex flex-col justify-center items-center text-center rounded-2xl bg-zinc-50 dark:bg-muted/30 border border-zinc-200 dark:border-border/70 p-5 shadow-2xs space-y-3 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-lg dark:hover:bg-muted/50">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-2xs transition-transform duration-300 group-hover/training:scale-110">
                      <MapPin className="h-7 w-7" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground block font-medium">
                        {locale === "ar" ? "مكان إجراء الحصة" : "Lieu de la séance"}
                      </span>
                      <h4 className="text-sm font-bold text-foreground">
                        {locale === "ar"
                          ? (t.location || "الملعب البلدي طاهري حسني – سيدي حسني")
                          : frenchPublicText(t.location, "Stade communal Taheri Hosni – Sidi Hosni")}
                      </h4>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {count > 1 && (
        <div className="mt-3 flex justify-center gap-1" aria-label={locale === "ar" ? "التنقل بين التدريبات" : "Navigation des entraînements"}>
          {trainings.map((training, index) => (
            <button
              key={training.id}
              type="button"
              onClick={() => {
                setCurrentIndex(index);
                setAutoplayReset((value) => value + 1);
              }}
              aria-label={locale === "ar" ? `التدريب ${index + 1}` : `Entraînement ${index + 1}`}
              aria-current={index === currentIndex ? "true" : undefined}
            className="flex h-5 w-5 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
            >
            <span className={`block h-1.5 rounded-full transition-all ${index === currentIndex ? "w-2.5 bg-emerald-500" : "w-1.5 bg-muted-foreground/40"}`} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

// Backward-compatible compound export
export function UpcomingEventsCarousel({
  nextMatch,
  upcomingTraining,
  locale = "ar"
}: {
  nextMatch: PublicMatchItemData | null;
  upcomingTraining: PublicTrainingItemData | null;
  locale?: string;
}) {
  return (
    <div className="space-y-8">
      {nextMatch && <UpcomingMatchesCarousel matches={[nextMatch]} locale={locale} />}
      {upcomingTraining && (
        <UpcomingTrainingsCarousel trainings={[upcomingTraining]} locale={locale} />
      )}
    </div>
  );
}
