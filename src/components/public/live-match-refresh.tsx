"use client";

import { useEffect } from "react";

/** Refreshes a live match page so manual events entered in the dashboard reach
 * the public match center without mixing in a second client-side data source. */
export function LiveMatchRefresh({ enabled, refreshAt }: { enabled: boolean; refreshAt?: number }) {
  useEffect(() => {
    const timers: number[] = [];
    if (enabled) timers.push(window.setInterval(() => window.location.reload(), 60_000));
    if (refreshAt && refreshAt > Date.now()) {
      const refreshWhenReady = () => {
        const remaining = refreshAt - Date.now();
        if (remaining <= 0) {
          window.location.reload();
          return;
        }
        timers.push(window.setTimeout(refreshWhenReady, Math.min(remaining, 24 * 60 * 60 * 1000)));
      };
      refreshWhenReady();
    }
    return () => timers.forEach((timer) => {
      window.clearInterval(timer);
      window.clearTimeout(timer);
    });
  }, [enabled, refreshAt]);

  return enabled || refreshAt ? (
    <span className="sr-only" aria-live="polite">
      Live match updates refresh every minute.
    </span>
  ) : null;
}
