"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Refresh player pages when the browser restores a cached history snapshot. */
export function PlayerPageFreshness() {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => router.refresh();
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) refresh();
    };
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("popstate", refresh);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("popstate", refresh);
    };
  }, [router]);

  return null;
}
