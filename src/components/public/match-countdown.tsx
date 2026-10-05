"use client";

import { useEffect, useState } from "react";

interface MatchCountdownProps {
  targetDate: Date | string;
  locale: string;
}

export function MatchCountdown({ targetDate, locale }: MatchCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isPast: boolean;
  } | null>(null);

  useEffect(() => {
    const calculateTime = () => {
      const target = new Date(targetDate).getTime();
      const now = new Date().getTime();
      const difference = target - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, isPast: false });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!timeLeft) {
    return (
      <div className="flex items-center justify-center gap-2 py-2">
        <div className="h-12 w-16 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-12 w-16 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-12 w-16 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-12 w-16 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      </div>
    );
  }

  if (timeLeft.isPast) {
    return (
      <div className="rounded-xl border border-club-primary/30 bg-club-primary/10 px-4 py-2 text-center text-xs font-bold text-club-primary uppercase tracking-wider shadow-2xs">
        {locale === "ar" ? "المباراة جارية أو قريبة جداً" : "Match en cours / imminent"}
      </div>
    );
  }

  const units = [
    { label: locale === "ar" ? "يوم" : "Jours", value: timeLeft.days },
    { label: locale === "ar" ? "ساعة" : "Heures", value: timeLeft.hours },
    { label: locale === "ar" ? "دقيقة" : "Min", value: timeLeft.minutes },
    { label: locale === "ar" ? "ثانية" : "Sec", value: timeLeft.seconds }
  ];

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3">
      {units.map((unit, idx) => (
        <div
          key={idx}
          className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 min-w-[58px] sm:min-w-[68px] shadow-sm transition-all hover:border-club-primary/50"
        >
          <span className="font-mono text-xl sm:text-2xl font-black text-zinc-900 dark:text-white leading-none tabular-nums">
            {String(unit.value).padStart(2, "0")}
          </span>
          <span className="text-[10px] sm:text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mt-1 uppercase tracking-wider">
            {unit.label}
          </span>
        </div>
      ))}
    </div>
  );
}
