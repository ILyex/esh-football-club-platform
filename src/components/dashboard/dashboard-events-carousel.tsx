"use client";

import { formatAlgeriaDateTimeLocalized } from "@/lib/dates/algeria";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar,
  Activity,
  FileSpreadsheet,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  ArrowLeft,
  Clock,
  MapPin,
  Trophy
} from "lucide-react";
import { useSwipeCarousel } from "@/hooks/use-swipe-carousel";
import { frenchCompetitionName, localizedClubName } from "@/lib/public/locale-text";
import { OpponentCrest } from "@/components/public/opponent-crest";
import { formatAlgeriaDateTime } from "@/lib/dates/algeria";

export interface DashboardMatchItem {
  id: string;
  opponentName: string;
  matchDate: Date | string;
  isHome: boolean;
  competitionName?: string | null;
  opponentLogo?: string | null;
}

export interface DashboardTrainingItem {
  id: string;
  teamCategory: string;
  date: Date | string;
  startTime: Date | string;
  location?: string | null;
}

export interface DashboardMeetingItem {
  id: string;
  title: string;
  meetingDate: Date | string;
  location?: string | null;
}

interface DashboardEventsCarouselProps {
  matches: DashboardMatchItem[];
  trainings: DashboardTrainingItem[];
  meetings: DashboardMeetingItem[];
  locale: string;
}

export function DashboardEventsCarousel({
  matches,
  trainings,
  meetings,
  locale
}: DashboardEventsCarouselProps) {
  const [slide, setSlide] = useState<0 | 1 | 2>(0);
  const isAr = locale === "ar";
  const Arrow = isAr ? ArrowLeft : ArrowRight;
  const Chevron = isAr ? ChevronLeft : ChevronRight;
  const swipe = useSwipeCarousel(
    () => setSlide((prev) => ((prev + 1) % 3) as 0 | 1 | 2),
    () => setSlide((prev) => ((prev + 2) % 3) as 0 | 1 | 2)
  );

  // Auto rotate slides every 8 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setSlide((prev) => ((prev + 1) % 3) as 0 | 1 | 2);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div {...swipe} className="rounded-2xl border border-border/80 bg-card p-3 sm:p-5 shadow-xs flex flex-col justify-between min-h-[280px] sm:min-h-[360px] transition-all carousel-no-stroke select-none outline-none focus:outline-none">
      <div>
        {/* Header & Tabs */}
        <div className="flex flex-wrap items-center justify-between border-b border-border/60 pb-3 mb-4 gap-2">
          {/* Slide Switcher Buttons */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setSlide(0)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all outline-none focus:outline-none focus-visible:outline-none focus:ring-0 select-none ${
                slide === 0
                  ? "bg-club-primary text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Trophy className="h-3 w-3" />
              <span>{isAr ? "المباريات" : "Matchs"}</span>
            </button>

            <button
              type="button"
              onClick={() => setSlide(1)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all outline-none focus:outline-none focus-visible:outline-none focus:ring-0 select-none ${
                slide === 1
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Activity className="h-3 w-3" />
              <span>{isAr ? "التدريبات" : "Entraînements"}</span>
            </button>

            <button
              type="button"
              onClick={() => setSlide(2)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all outline-none focus:outline-none focus-visible:outline-none focus:ring-0 select-none ${
                slide === 2
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileSpreadsheet className="h-3 w-3" />
              <span>{isAr ? "الاجتماعات" : "Réunions"}</span>
            </button>
          </div>

          {/* Quick Link to Current Module */}
          <Link
            href={
              slide === 0
                ? `/${locale}/dashboard/matches`
                : slide === 1
                ? `/${locale}/dashboard/training`
                : `/${locale}/dashboard/meeting-minutes`
            }
            className="text-xs font-semibold text-muted-foreground hover:text-club-primary transition-colors flex items-center gap-1"
          >
            <span>{isAr ? "عرض الكل" : "Tout voir"}</span>
            <Arrow className="h-3 w-3" />
          </Link>
        </div>

        {/* Slide 0: Upcoming Matches */}
        {slide === 0 && (
          <div className="space-y-2 animate-in fade-in duration-200">
            {matches.length > 0 ? (
              <div className="divide-y divide-border/60">
                {matches.map((m) => (
                  <Link
                    key={m.id}
                    href={`/${locale}/dashboard/matches/${m.id}`}
                    dir={isAr ? "rtl" : "ltr"}
                    className="group flex min-h-14 items-center gap-2 rounded-xl border border-border/60 bg-background/40 px-2 py-1.5 transition-colors hover:border-club-primary/30 hover:bg-muted/30 sm:gap-2.5 sm:px-2.5"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 p-1">
                      {m.opponentLogo ? (
                        <OpponentCrest src={m.opponentLogo} className="h-full w-full object-contain" iconClassName="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <Trophy className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold leading-4 text-foreground transition-colors group-hover:text-club-primary">
                          {localizedClubName(m.opponentName, locale, isAr ? "الفريق المنافس" : "Nom du club adverse")}
                      </p>
                      <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[10px] leading-3 text-muted-foreground">
                        <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span dir="ltr" className="shrink-0 font-mono tabular-nums">{formatAlgeriaDateTime(m.matchDate, locale)}</span>
                        {m.competitionName && <span className="truncate">· {isAr ? m.competitionName : frenchCompetitionName(m.competitionName)}</span>}
                      </p>
                    </div>
                    <Chevron className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-club-primary" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground">
                <Trophy className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                <p>{isAr ? "لا توجد مباريات مبرمجة قادمة" : "Aucun match programmé"}</p>
              </div>
            )}
          </div>
        )}

        {/* Slide 1: Upcoming Trainings */}
        {slide === 1 && (
          <div className="space-y-2 animate-in fade-in duration-200">
            {trainings.length > 0 ? (
              <div className="divide-y divide-border/60">
                {trainings.map((t) => (
                  <Link
                    key={t.id}
                    href={`/${locale}/dashboard/training/${t.id}`}
                    className="flex items-center justify-between py-2 sm:py-2.5 group hover:bg-muted/30 px-1.5 sm:px-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0">
                        <Activity className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground group-hover:text-emerald-600 transition-colors truncate">
                          {isAr ? "حصة تدريبية -" : "Séance d'entraînement -"} {t.teamCategory}
                        </p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          <span>
                            {formatAlgeriaDateTimeLocalized(new Date(t.date), locale, { dateStyle: "short", timeStyle: "short" })}
                          </span>
                          {t.location && <span className="min-w-0 truncate">• {t.location}</span>}
                        </p>
                      </div>
                    </div>
                    <Chevron className="h-3.5 w-3.5 text-muted-foreground group-hover:text-emerald-600 transition-colors shrink-0" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground">
                <Activity className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                <p>{isAr ? "لا توجد تدريبات مبرمجة حالياً" : "Aucun entraînement programmé"}</p>
              </div>
            )}
          </div>
        )}

        {/* Slide 2: Upcoming Meetings */}
        {slide === 2 && (
          <div className="space-y-2 animate-in fade-in duration-200">
            {meetings.length > 0 ? (
              <div className="divide-y divide-border/60">
                {meetings.map((m) => (
                  <Link
                    key={m.id}
                    href={`/${locale}/dashboard/meeting-minutes/${m.id}`}
                    className="flex items-center justify-between py-2 sm:py-2.5 group hover:bg-muted/30 px-1.5 sm:px-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 shrink-0">
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground group-hover:text-blue-600 transition-colors truncate">
                          {m.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          <span>
                            {new Intl.DateTimeFormat(locale, {
                              dateStyle: "short"
                            }).format(new Date(m.meetingDate))}
                          </span>
                          {m.location && <span>• {m.location}</span>}
                        </p>
                      </div>
                    </div>
                    <Chevron className="h-3.5 w-3.5 text-muted-foreground group-hover:text-blue-600 transition-colors shrink-0" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground">
                <FileSpreadsheet className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                <p>{isAr ? "لا توجد اجتماعات مسجلة مؤخراً" : "Aucune réunion enregistrée"}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Carousel Footer with manual slide indicators */}
      <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSlide((prev) => ((prev - 1 + 3) % 3) as 0 | 1 | 2)}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setSlide((prev) => ((prev + 1) % 3) as 0 | 1 | 2)}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Indicator dots */}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSlide(idx as 0 | 1 | 2)}
              data-mobile-compact
              data-carousel-indicator
              aria-label={`Slide ${idx + 1}`}
              aria-current={slide === idx ? "true" : undefined}
              className="dashboard-carousel-dot flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            >
              <span data-carousel-dot aria-hidden="true" className={slide === idx ? "bg-club-primary" : "bg-border"} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
