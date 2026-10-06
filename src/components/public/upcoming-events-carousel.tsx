"use client";

import { useEffect, useState } from "react";
import {
  Trophy,
  Calendar,
  MapPin,
  Clock,
  Activity,
  Shield,
  ChevronLeft,
  ChevronRight,
  Bell
} from "lucide-react";
import { MatchCountdown } from "@/components/public/match-countdown";
import { frenchPublicText } from "@/lib/public/locale-text";

export interface PublicMatchItemData {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
  matchDate: Date | string;
  stadium: string | null;
  competitionName: string;
  isHomeFixture: boolean;
  status?: string;
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
  U20: { ar: "أواسط (U20)", fr: "U20" },
  U17: { ar: "أشبال (U17)", fr: "U17" },
  U15: { ar: "أصاغر (U15)", fr: "U15" }
};

export function getCategoryBadgeLabel(cat: string | null | undefined, locale: string): string {
  if (!cat) return locale === "ar" ? "الأكابر" : "Séniors";
  const mapped = CATEGORY_LABELS[cat.toUpperCase()];
  if (mapped) return locale === "ar" ? mapped.ar : mapped.fr;
  return cat;
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
  useEffect(() => {
    if (matches.length < 2) return;
    const intervalId = window.setInterval(() => {
      setCurrentIndex((index) => (index + 1) % matches.length);
    }, 30_000);
    return () => window.clearInterval(intervalId);
  }, [matches.length]);
  const isRtl = locale === "ar";
  const PrevArrow = isRtl ? ChevronRight : ChevronLeft;
  const NextArrow = isRtl ? ChevronLeft : ChevronRight;

  const count = matches.length;

  if (count === 0) {
    return (
      <section className="relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-border bg-white dark:bg-card p-6 sm:p-8 shadow-sm">
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
  const now = new Date();
  const isLive =
    (now.getTime() >= matchDate.getTime() && now.getTime() <= matchDate.getTime() + 130 * 60 * 1000) ||
    currentMatch.status === "IN_PROGRESS";

  const categoryDisplay = getCategoryBadgeLabel(currentMatch.teamCategory, locale);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + count) % count);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % count);
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-border bg-white dark:bg-card p-6 sm:p-8 lg:p-10 shadow-lg dark:shadow-2xl transition-colors carousel-no-stroke select-none outline-none focus:outline-none">
      {/* Ambient Logo Watermark */}
      <div className="absolute -end-10 -bottom-10 opacity-5 dark:opacity-10 pointer-events-none select-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/branding/esh-logo-256.png" alt="" className="w-80 h-80 object-contain" />
      </div>

      {/* Header bar: Title, Category Badge, and Slide Controls */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 dark:border-border/70 pb-4 mb-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-2 rounded-xl bg-club-primary text-white px-3.5 py-2 text-xs sm:text-sm font-bold shadow-xs select-none outline-none focus:outline-none focus:ring-0">
            <Trophy className="h-4 w-4 shrink-0" />
            <span>{locale === "ar" ? "المباراة القادمة" : "Prochain Match"}</span>
          </div>

          <span className="inline-flex items-center rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold bg-club-primary/10 text-club-primary border border-club-primary/20 select-none outline-none focus:outline-none focus:ring-0">
            {categoryDisplay}
          </span>

          {isLive && (
            <span className="flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white animate-pulse">
              <span className="h-2 w-2 rounded-full bg-white" />
              <span>{locale === "ar" ? "مباشر" : "LIVE"}</span>
            </span>
          )}
        </div>

        {/* Carousel controls (only visible if more than 1 match) */}
        {count > 1 && (
          <div className="flex items-center gap-2 select-none">
            <div className="flex items-center gap-1.5 me-2">
              {matches.map((m, idx) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={`Match ${idx + 1}`}
                  className={`h-2 rounded-full transition-all duration-300 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ${
                    idx === currentIndex
                      ? "w-6 bg-club-primary"
                      : "w-2 bg-zinc-300 dark:bg-muted-foreground/30 hover:bg-zinc-400"
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrev}
                aria-label={locale === "ar" ? "المباراة السابقة" : "Précédent"}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 dark:border-border/80 bg-zinc-50 dark:bg-muted/40 text-foreground hover:bg-zinc-100 dark:hover:bg-muted transition-colors shadow-2xs outline-none focus:outline-none focus-visible:outline-none focus:ring-0 active:scale-95"
              >
                <PrevArrow className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                aria-label={locale === "ar" ? "المباراة التالية" : "Suivant"}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 dark:border-border/80 bg-zinc-50 dark:bg-muted/40 text-foreground hover:bg-zinc-100 dark:hover:bg-muted transition-colors shadow-2xs outline-none focus:outline-none focus-visible:outline-none focus:ring-0 active:scale-95"
              >
                <NextArrow className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Sliding Match Track */}
      <div className="relative z-10 overflow-hidden w-full">
        <div
          className="flex transition-transform duration-500 ease-out w-full"
          style={{
            transform: isRtl
              ? `translateX(${currentIndex * 100}%)`
              : `translateX(-${currentIndex * 100}%)`
          }}
        >
          {matches.map((m) => {
            const mDate = new Date(m.matchDate);
            const mIsLive =
              (now.getTime() >= mDate.getTime() && now.getTime() <= mDate.getTime() + 130 * 60 * 1000) ||
              m.status === "IN_PROGRESS";
            return (
              <div key={m.id} className="w-full shrink-0 space-y-6 px-0.5 outline-none focus:outline-none">
                {/* Meta Line: Competition & Stadium */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-club-primary">
                    <span>{locale === "ar" ? m.competitionName : frenchPublicText(m.competitionName, "Compétition officielle")}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-muted-foreground bg-zinc-100 dark:bg-muted/60 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-border">
                    <MapPin className="h-3.5 w-3.5 text-club-primary" />
                    <span>
                      {locale === "ar"
                        ? (m.stadium || "الملعب البلدي بسيدي حسني")
                        : frenchPublicText(m.stadium, "Stade Municipal Sidi Hosni")}
                    </span>
                  </div>
                </div>

                {/* Central Match Duel */}
                <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-6 py-2 sm:py-4">
                  {/* Home Team */}
                  <div className="md:col-span-4 flex items-center md:flex-col md:text-center gap-4 justify-start md:justify-center">
                    <div className="relative flex h-20 w-20 sm:h-24 sm:w-24 shrink-0 items-center justify-center rounded-2xl border-2 border-zinc-200 dark:border-border bg-zinc-50 dark:bg-background p-3 shadow-sm">
                      {m.isHomeFixture ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src="/branding/esh-logo-128.png"
                          alt={m.homeTeamName}
                          className="h-full w-full object-contain"
                        />
                      ) : m.opponentLogo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.opponentLogo}
                          alt={m.homeTeamName}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <Shield className="h-10 w-10 text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lg sm:text-xl font-extrabold text-zinc-900 dark:text-foreground">
                        {locale === "ar" ? m.homeTeamName : frenchPublicText(m.homeTeamName, m.isHomeFixture ? "ESH Sidi Hosni" : "Adversaire")}
                      </h3>
                      <span className="inline-block rounded-md bg-zinc-100 text-zinc-700 dark:bg-muted dark:text-muted-foreground px-2 py-0.5 text-[11px] font-bold">
                        {locale === "ar" ? "المضيف" : "Domicile"}
                      </span>
                    </div>
                  </div>

                  {/* Center: Kickoff Date/Time & Live Countdown */}
                  <div className="md:col-span-4 flex flex-col items-center justify-center text-center space-y-4 px-3 py-5 rounded-2xl bg-zinc-50 dark:bg-muted/40 border border-zinc-200 dark:border-border/60 shadow-xs">
                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-800 dark:text-foreground">
                      <Clock className="h-4 w-4 text-club-primary" />
                      <span>
                        {new Intl.DateTimeFormat(locale, {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric"
                        }).format(mDate)}
                      </span>
                    </div>

                    <div className="inline-flex items-center justify-center rounded-xl bg-white dark:bg-background border border-zinc-200 dark:border-border px-4 py-1.5 shadow-2xs">
                      <span className="font-mono text-2xl font-black text-club-primary dark:text-foreground tracking-widest tabular-nums">
                        {new Intl.DateTimeFormat(locale, {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                          timeZone: "Africa/Algiers"
                        }).format(mDate)}
                      </span>
                    </div>

                    {/* Live Countdown or Live Status */}
                    <div className="w-full">
                      {mIsLive ? (
                        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-center">
                          <p className="text-xs font-black text-red-500 uppercase tracking-widest animate-pulse">
                            {locale === "ar" ? "المباراة تلعب الآن في الملعب" : "Match en cours actuellement"}
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="text-[11px] font-bold text-zinc-600 dark:text-muted-foreground mb-2 uppercase tracking-wider">
                            {locale === "ar" ? "العد التنازلي لانطلاق المواجهة" : "Coup d'envoi dans"}
                          </div>
                          <MatchCountdown targetDate={mDate} locale={locale} />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Away Team */}
                  <div className="md:col-span-4 flex items-center md:flex-col md:text-center gap-4 justify-start md:justify-center">
                    <div className="relative flex h-20 w-20 sm:h-24 sm:w-24 shrink-0 items-center justify-center rounded-2xl border-2 border-zinc-200 dark:border-border bg-zinc-50 dark:bg-background p-3 shadow-sm">
                      {!m.isHomeFixture ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src="/branding/esh-logo-128.png"
                          alt={m.awayTeamName}
                          className="h-full w-full object-contain"
                        />
                      ) : m.opponentLogo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.opponentLogo}
                          alt={m.awayTeamName}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <Shield className="h-10 w-10 text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lg sm:text-xl font-extrabold text-zinc-900 dark:text-foreground">
                        {locale === "ar" ? m.awayTeamName : frenchPublicText(m.awayTeamName, m.isHomeFixture ? "Adversaire" : "ESH Sidi Hosni")}
                      </h3>
                      <span className="inline-block rounded-md bg-zinc-100 text-zinc-700 dark:bg-muted dark:text-muted-foreground px-2 py-0.5 text-[11px] font-bold">
                        {locale === "ar" ? "الضيف" : "Extérieur"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
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
  useEffect(() => {
    if (trainings.length < 2) return;
    const intervalId = window.setInterval(() => {
      setCurrentIndex((index) => (index + 1) % trainings.length);
    }, 30_000);
    return () => window.clearInterval(intervalId);
  }, [trainings.length]);
  const isRtl = locale === "ar";
  const PrevArrow = isRtl ? ChevronRight : ChevronLeft;
  const NextArrow = isRtl ? ChevronLeft : ChevronRight;

  const count = trainings.length;

  if (count === 0) {
    return (
      <section className="relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-border bg-white dark:bg-card p-6 sm:p-8 shadow-sm">
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

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + count) % count);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % count);
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-border bg-white dark:bg-card p-6 sm:p-8 lg:p-10 shadow-lg dark:shadow-2xl transition-colors carousel-no-stroke select-none outline-none focus:outline-none">
      {/* Header bar: Title, Category Badge, Notice, and Controls */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 dark:border-border/70 pb-4 mb-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-3.5 py-2 text-xs sm:text-sm font-bold shadow-xs select-none outline-none focus:outline-none focus:ring-0">
            <Activity className="h-4 w-4 shrink-0" />
            <span>{locale === "ar" ? "التدريبات القادمة" : "Prochains Entraînements"}</span>
          </div>

          <span className="inline-flex items-center rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 select-none outline-none focus:outline-none focus:ring-0">
            {categoryDisplay}
          </span>

        </div>

        {/* Carousel controls (only visible if more than 1 training) */}
        {count > 1 && (
          <div className="flex items-center gap-2 select-none">
            <div className="flex items-center gap-1.5 me-2">
              {trainings.map((t, idx) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={`Training ${idx + 1}`}
                  className={`h-2 rounded-full transition-all duration-300 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ${
                    idx === currentIndex
                      ? "w-6 bg-emerald-600 dark:bg-emerald-500"
                      : "w-2 bg-zinc-300 dark:bg-muted-foreground/30 hover:bg-zinc-400"
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrev}
                aria-label={locale === "ar" ? "التدريب السابق" : "Précédent"}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 dark:border-border/80 bg-zinc-50 dark:bg-muted/40 text-foreground hover:bg-zinc-100 dark:hover:bg-muted transition-colors shadow-2xs outline-none focus:outline-none focus-visible:outline-none focus:ring-0 active:scale-95"
              >
                <PrevArrow className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                aria-label={locale === "ar" ? "التدريب التالي" : "Suivant"}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 dark:border-border/80 bg-zinc-50 dark:bg-muted/40 text-foreground hover:bg-zinc-100 dark:hover:bg-muted transition-colors shadow-2xs outline-none focus:outline-none focus-visible:outline-none focus:ring-0 active:scale-95"
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
          className="flex transition-transform duration-500 ease-out w-full"
          style={{
            transform: isRtl
              ? `translateX(${currentIndex * 100}%)`
              : `translateX(-${currentIndex * 100}%)`
          }}
        >
          {trainings.map((t) => {
            const tCatDisplay = getCategoryBadgeLabel(t.teamCategory, locale);
            const tDate = new Date(t.date);
            return (
              <div key={t.id} className="w-full shrink-0 space-y-6 px-0.5 outline-none focus:outline-none">
                {/* Meta Line: Category & Venue Badge */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    <Activity className="h-4 w-4" />
                    <span>{tCatDisplay}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-foreground">{locale === "ar" ? t.teamName : frenchPublicText(t.teamName, "ESH Sidi Hosni")}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-muted-foreground bg-zinc-100 dark:bg-muted/60 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-border">
                    <MapPin className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      {t.location ||
                        (locale === "ar" ? "الملعب البلدي بسيدي حسني" : "Stade Municipal Sidi Hosni")}
                    </span>
                  </div>
                </div>

                {/* Central Training Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 items-stretch gap-6 py-2 sm:py-4">
                  {/* Category & Program Description (md:col-span-5) */}
                  <div className="md:col-span-5 flex flex-col justify-between rounded-2xl bg-zinc-50 dark:bg-muted/30 border border-zinc-200 dark:border-border/70 p-5 shadow-2xs">
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
                      <h3 className="text-xl sm:text-2xl font-black text-foreground">
                        {tCatDisplay}
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                        {locale === "ar"
                          ? (t.notes || "حصة تدريبية تكتيكية وبدنية مبرمجة في إطار البرنامج الأسبوعي للفريق")
                          : frenchPublicText(t.notes, "Séance d'entraînement technico-tactique et physique programmée dans le cadre de la semaine sportive")}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-zinc-200 dark:border-border/60 mt-4 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-medium">
                        {locale === "ar" ? "الفريق" : "Équipe"}
                      </span>
                      <span className="font-bold text-foreground">
                        {locale === "ar" ? t.teamName : frenchPublicText(t.teamName, "ESH Sidi Hosni")}
                      </span>
                    </div>
                  </div>

                  {/* Timing & Schedule (md:col-span-4) */}
                  <div className="md:col-span-4 flex flex-col items-center justify-center text-center space-y-3 px-4 py-6 rounded-2xl bg-zinc-50 dark:bg-muted/40 border border-zinc-200 dark:border-border/60 shadow-xs">
                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-800 dark:text-foreground">
                      <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span>{locale === "ar" ? "توقيت الحصة التدريبية" : "Horaire de la séance"}</span>
                    </div>

                    <div className="inline-flex items-center justify-center rounded-xl bg-white dark:bg-background border border-zinc-200 dark:border-border px-5 py-2.5 shadow-2xs">
                      <span className="font-mono text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-wider tabular-nums">
                        {t.startTime}
                        {t.endTime ? ` — ${t.endTime}` : ""}
                      </span>
                    </div>

                    <div className="text-[11px] font-medium text-muted-foreground">
                      {locale === "ar" ? "حضور اللاعبين إجباري قبل انطلاق الحصة" : "Présence obligatoire des joueurs avant la séance"}
                    </div>
                  </div>

                  {/* Field & Location (md:col-span-3) */}
                  <div className="md:col-span-3 flex flex-col justify-center items-center text-center rounded-2xl bg-zinc-50 dark:bg-muted/30 border border-zinc-200 dark:border-border/70 p-5 shadow-2xs space-y-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-2xs">
                      <MapPin className="h-7 w-7" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground block font-medium">
                        {locale === "ar" ? "مكان إجراء الحصة" : "Lieu de la séance"}
                      </span>
                      <h4 className="text-sm font-bold text-foreground">
                        {locale === "ar"
                          ? (t.location || "الملعب البلدي بسيدي حسني")
                          : frenchPublicText(t.location, "Stade Municipal Sidi Hosni")}
                      </h4>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
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
