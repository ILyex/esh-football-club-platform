"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const supportedLocales = new Set(["ar", "fr"]);

export function LocaleTransition() {
  const pathname = usePathname();
  const locale = pathname?.split("/").filter(Boolean)[0] ?? "";
  const previousLocale = useRef(locale);

  useEffect(() => {
    const previous = previousLocale.current;
    previousLocale.current = locale;

    if (!supportedLocales.has(previous) || !supportedLocales.has(locale) || previous === locale) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const root = document.documentElement;
    root.classList.add("locale-transition");
    const timer = window.setTimeout(() => root.classList.remove("locale-transition"), 220);
    return () => {
      window.clearTimeout(timer);
      root.classList.remove("locale-transition");
    };
  }, [locale]);

  return null;
}
