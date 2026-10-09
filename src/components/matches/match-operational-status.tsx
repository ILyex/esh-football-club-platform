"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { getMatchClockState, type MatchAddedTimeSettings } from "@/lib/matches/clock";

type MatchStatus = "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED" | "CANCELLED";

export function MatchOperationalStatus({
  status,
  matchDate,
  locale,
  labels,
  variant = "dashboard",
  hasExtraTime = false,
  hasPenaltyShootout = false,
  homeScore = null,
  awayScore = null,
  addedTime
}: {
  status: MatchStatus;
  matchDate: Date | string;
  locale: string;
  labels: Record<MatchStatus, string>;
  variant?: "dashboard" | "card" | "detail";
  hasExtraTime?: boolean;
  hasPenaltyShootout?: boolean;
  homeScore?: number | null;
  awayScore?: number | null;
  addedTime?: MatchAddedTimeSettings;
}) {
  const [now, setNow] = useState<number | null>(null);
  const isAr = locale === "ar";

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  const kickoff = new Date(matchDate).getTime();
  const remaining = now === null ? Number.POSITIVE_INFINITY : kickoff - now;
  const isImminent = status === "SCHEDULED" && remaining > 0 && remaining <= 30 * 60 * 1000;
  const clockPhase = status === "LIVE" && now !== null ? getMatchClockState(
    matchDate,
    new Date(now),
    hasExtraTime,
    hasPenaltyShootout,
    homeScore,
    awayScore,
    addedTime
  ).phase : null;
  const isHalfTime = clockPhase === "HALF_TIME" || clockPhase === "EXTRA_TIME_HALF_TIME";
  const label = isImminent
    ? (isAr ? "تبدأ قريبًا" : "Débute bientôt")
    : isHalfTime
    ? (clockPhase === "EXTRA_TIME_HALF_TIME"
      ? (isAr ? "نهاية الشوط الإضافي الأول" : "Mi-temps des prolongations")
      : (isAr ? "نهاية الشوط الأول" : "Mi-temps"))
    : labels[status];

  if (variant === "dashboard") {
    const tone = isImminent || isHalfTime ? "warning" : status === "LIVE" ? "danger" : status === "FINISHED" ? "success" : status === "POSTPONED" || status === "CANCELLED" ? "warning" : "neutral";
    return <Badge tone={tone}>{label}</Badge>;
  }

  const className = variant === "card"
    ? status === "LIVE"
      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
      : status === "FINISHED"
      ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
      : isImminent
      ? "bg-orange-500/10 text-orange-600 border-orange-500/20"
      : status === "SCHEDULED" || status === "POSTPONED" || status === "CANCELLED"
      ? "!bg-blue-600 !text-white !border-white"
      : "bg-amber-500/10 text-amber-700 border-amber-500/20"
    : status === "LIVE"
    ? "bg-red-500 text-white"
    : status === "FINISHED"
    ? "bg-emerald-600 text-white"
    : isImminent
    ? "bg-orange-600 text-white"
    : status === "SCHEDULED" || status === "POSTPONED" || status === "CANCELLED"
    ? "bg-blue-600 text-white"
    : "bg-amber-600 text-white";

  return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${className}`}>{label}</span>;
}
