"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

export function DashboardClock() {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    function updateClock() {
      // Algeria is Africa/Algiers timezone (UTC+1, no DST)
      const formatter = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Algiers",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      });
      setTime(formatter.format(new Date()));
    }

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!time) {
    // Elegant placeholder while mounting
    return (
      <div className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-mono font-semibold text-muted-foreground shadow-2xs">
        <Clock className="h-3.5 w-3.5 text-club-primary" />
        <span className="tabular-nums">--:--:--</span>
      </div>
    );
  }

  return (
    <div
      className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-mono font-bold text-foreground shadow-2xs tabular-nums select-none tracking-wider"
      title="Algeria Time (24h)"
    >
      <Clock className="h-3.5 w-3.5 text-club-primary animate-pulse" />
      <span>{time}</span>
    </div>
  );
}
