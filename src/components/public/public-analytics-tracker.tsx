"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

let requestQueue = Promise.resolve();

function send(type: "PAGE_VIEW" | "CLICK", path: string, targetPath?: string, referrer?: string) {
  const body = JSON.stringify({ type, path, targetPath, referrer });
  requestQueue = requestQueue.then(() => fetch("/api/public-analytics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
      credentials: "same-origin"
    }).then(() => undefined))
    .catch(() => undefined);
}

export function PublicAnalyticsTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastPath.current === pathname) return;
    lastPath.current = pathname;
    const isFirstPage = lastPath.current === null;
    send("PAGE_VIEW", pathname, undefined, isFirstPage ? document.referrer : undefined);
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement) || !link.href) return;
      try {
        const destination = new URL(link.href, window.location.href);
        if (destination.protocol !== "http:" && destination.protocol !== "https:") return;
        send("CLICK", window.location.pathname, destination.pathname);
      } catch {
        // Ignore malformed destinations; analytics must never affect navigation.
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
