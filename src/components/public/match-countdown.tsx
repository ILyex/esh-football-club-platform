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
        <div className="h-7 w-24 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800 sm:hidden" />
        <div className="hidden items-center justify-center gap-2 sm:flex">
        <div className="h-12 w-16 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-12 w-16 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-12 w-16 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-12 w-16 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
    );
  }

  if (timeLeft.isPast) {
    return (
      <div className="inline-flex items-center justify-center rounded-full border border-zinc-500/20 bg-zinc-500/10 px-3 py-1.5 text-center text-xs font-bold text-zinc-600 dark:text-zinc-300 shadow-2xs">
        {locale === "ar" ? "بانتظار تحديث حالة المباراة" : "En attente de mise à jour du statut"}
      </div>
    );
  }

  const units = [
    { label: locale === "ar" ? "يوم" : "Jours", value: timeLeft.days },
    { label: locale === "ar" ? "ساعة" : "Heures", value: timeLeft.hours },
    { label: locale === "ar" ? "دقيقة" : "Min", value: timeLeft.minutes },
    { label: locale === "ar" ? "ثانية" : "Sec", value: timeLeft.seconds }
  ];
  const compactTime = timeLeft.days > 0
    ? `${timeLeft.days} ${locale === "ar" ? "ي" : "j"} · ${String(timeLeft.hours).padStart(2, "0")}:${String(timeLeft.minutes).padStart(2, "0")}`
    : `${String(timeLeft.hours).padStart(2, "0")}:${String(timeLeft.minutes).padStart(2, "0")}:${String(timeLeft.seconds).padStart(2, "0")}`;

  return (
    <div>
      <div className="mx-auto inline-flex max-w-full items-center justify-center rounded-full border border-zinc-200 bg-white px-2.5 py-1 font-mono text-[11px] font-bold tabular-nums text-zinc-800 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-white sm:hidden">
        {compactTime}
      </div>
      <div className="hidden items-center justify-center gap-2 sm:flex sm:gap-3">
        {units.map((unit, idx) => (
          <div
            key={idx}
            className="flex min-w-[58px] flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-sm transition-all hover:border-club-primary/50 dark:border-zinc-800 dark:bg-zinc-950 sm:min-w-[68px]"
          >
            <span className="font-mono text-xl font-black leading-none tabular-nums text-zinc-900 dark:text-white sm:text-2xl">
              {String(unit.value).padStart(2, "0")}
            </span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 sm:text-[11px]">
              {unit.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
