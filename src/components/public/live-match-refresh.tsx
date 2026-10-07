"use client";

import { useEffect } from "react";

/** Refreshes a live match page so manual events entered in the dashboard reach
 * the public match center without mixing in a second client-side data source. */
export function LiveMatchRefresh({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const refresh = window.setInterval(() => window.location.reload(), 60_000);
    return () => window.clearInterval(refresh);
  }, [enabled]);

  return enabled ? (
    <span className="sr-only" aria-live="polite">
      Live match updates refresh every minute.
    </span>
  ) : null;
}
