"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

function getSectionParent(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  const locale = segments[0];
  if ((locale !== "ar" && locale !== "fr") || segments.length < 3) return null;

  if (["news", "gallery", "matches"].includes(segments[1]!) && segments.length === 3) {
    return `/${locale}/${segments[1]}`;
  }
  if (segments[1] === "team" && segments.length === 5 && segments[3] === "players") {
    return `/${locale}/team/${segments[2]}`;
  }
  if (segments[1] === "team" && segments.length === 3) {
    return `/${locale}/team`;
  }
  return null;
}

/** Make the phone/browser back action leave public detail pages at their section list. */
export function PublicParentBackNavigation() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const parentPath = getSectionParent(pathname);
    if (!parentPath) return;

    const handlePopState = (event: PopStateEvent) => {
      if (window.location.pathname === parentPath) return;

      // The browser has already moved one history entry. Replace that entry
      // with the parent section so repeated Back taps cannot reopen stale
      // detail pages from the same section.
      event.stopImmediatePropagation();
      router.replace(parentPath);
    };

    window.addEventListener("popstate", handlePopState, true);
    return () => window.removeEventListener("popstate", handlePopState, true);
  }, [pathname, router]);

  return null;
}
