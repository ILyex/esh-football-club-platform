"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Refresh field match status while at least one match is still operationally live. */
export function MatchStatusRefresh({ enabled }: { enabled: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => router.refresh(), 20_000);
    return () => window.clearInterval(timer);
  }, [enabled, router]);

  return null;
}
