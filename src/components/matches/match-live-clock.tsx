"use client";

import { useEffect, useState } from "react";
import { getMatchClockState, type MatchAddedTimeSettings } from "@/lib/matches/clock";

export function MatchLiveClock({
  matchDate,
  hasExtraTime = false,
  hasPenaltyShootout = false,
  homeScore = 0,
  awayScore = 0,
  addedTime,
  locale = "ar",
  compact = false,
  display = "both",
  presentation = "badge"
}: {
  matchDate: Date | string;
  hasExtraTime?: boolean;
  hasPenaltyShootout?: boolean;
  homeScore?: number | null;
  awayScore?: number | null;
  addedTime?: MatchAddedTimeSettings;
  locale?: string;
  compact?: boolean;
  display?: "both" | "minute" | "phase";
  presentation?: "badge" | "clock";
}) {
  const [now, setNow] = useState(() => new Date(matchDate));
  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  const state = getMatchClockState(matchDate, now, hasExtraTime, hasPenaltyShootout, homeScore, awayScore, addedTime);
  const isAr = locale === "ar";
  const minuteLabel = state.addedMinute
    ? `${state.minute}+${state.addedMinute}${isAr ? "د" : "′"}`
    : `${state.minute}${isAr ? "د" : "′"}`;
  const phaseLabel = isAr
    ? ({
        FIRST_HALF: "الشوط الأول",
        HALF_TIME: "استراحة الشوطين",
        SECOND_HALF: "الشوط الثاني",
        FULL_TIME: "انتهت المباراة",
        EXTRA_TIME_BREAK: "استراحة قبل الوقت الإضافي",
        EXTRA_TIME_FIRST_HALF: "الشوط الإضافي الأول",
        EXTRA_TIME_HALF_TIME: "استراحة الوقت الإضافي",
        EXTRA_TIME_SECOND_HALF: "الشوط الإضافي الثاني",
        PENALTIES: "ركلات الترجيح"
      } as const)[state.phase]
    : ({
        FIRST_HALF: "1re mi-temps",
        HALF_TIME: "Mi-temps",
        SECOND_HALF: "2e mi-temps",
        FULL_TIME: "Match terminé",
        EXTRA_TIME_BREAK: "Pause avant prolongation",
        EXTRA_TIME_FIRST_HALF: "1re période de prolongation",
        EXTRA_TIME_HALF_TIME: "Pause de prolongation",
        EXTRA_TIME_SECOND_HALF: "2e période de prolongation",
        PENALTIES: "Tirs au but"
      } as const)[state.phase];

  if (presentation === "clock") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-xl border border-club-primary/20 bg-club-primary/5 px-3 py-1.5 font-mono font-black text-club-primary tabular-nums shadow-sm dark:text-foreground ${compact ? "text-2xl" : "text-3xl"}`}
        aria-live="polite"
        aria-label={minuteLabel}
      >
        <bdi dir="ltr" className="leading-none">{state.minute}</bdi>
        {state.addedMinute !== undefined && (
          <bdi dir="ltr" className="rounded-md border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[0.55em] leading-none text-amber-700 dark:text-amber-300">
            +{state.addedMinute}
          </bdi>
        )}
        <span className="self-center font-sans text-[0.55em] font-bold leading-none text-club-primary dark:text-foreground">{isAr ? "د" : "′"}</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 font-bold text-emerald-600 dark:text-emerald-400 ${compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-sm"}`} aria-live="polite">
      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
      {display !== "phase" && <span><bdi dir="ltr">{minuteLabel}</bdi></span>}
      {display !== "minute" && <span className="font-medium">{phaseLabel}</span>}
    </span>
  );
}
