"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Monitor, Smartphone } from "lucide-react";

type ThemeMode = "light" | "dark" | "system";
type SystemIconBreakpoint = "sm" | "md" | "lg" | "xl";
let themeTransitionTimer: number | undefined;
let liquidTransitionTimer: number | undefined;

function setDocumentTheme(isDark: boolean, animate: boolean, origin?: { x: number; y: number }) {
  const root = document.documentElement;
  root.style.backgroundColor = isDark ? "#0c0d0e" : "#f8f9fa";
  root.style.colorScheme = isDark ? "dark" : "light";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!animate || reduceMotion) {
    root.classList.remove("theme-transition");
    root.classList.toggle("dark", isDark);
    return;
  }

  document.querySelectorAll<HTMLElement>(".theme-liquid-overlay").forEach((node) => node.remove());
  const overlay = document.createElement("div");
  overlay.className = "theme-liquid-overlay";
  overlay.dataset.mode = isDark ? "dark" : "light";
  overlay.style.setProperty("--theme-x", `${origin?.x ?? window.innerWidth / 2}px`);
  overlay.style.setProperty("--theme-y", `${origin?.y ?? window.innerHeight / 2}px`);
  document.body.appendChild(overlay);
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => overlay.classList.add("is-active")));
  if (liquidTransitionTimer) window.clearTimeout(liquidTransitionTimer);
  const cleanupOverlay = () => {
    overlay.remove();
    if (liquidTransitionTimer) window.clearTimeout(liquidTransitionTimer);
    liquidTransitionTimer = undefined;
  };
  overlay.addEventListener("animationend", cleanupOverlay, { once: true });
  liquidTransitionTimer = window.setTimeout(() => {
    cleanupOverlay();
  }, 560);

  root.classList.add("theme-transition");
  window.requestAnimationFrame(() => {
    root.classList.toggle("dark", isDark);
    if (themeTransitionTimer) window.clearTimeout(themeTransitionTimer);
    themeTransitionTimer = window.setTimeout(() => {
      root.classList.remove("theme-transition");
      themeTransitionTimer = undefined;
    }, 180);
  });
}

function isDarkForMode(mode: ThemeMode, systemPrefersDark: boolean) {
  return mode === "dark" || (mode === "system" && systemPrefersDark);
}

interface ThemeToggleProps {
  locale: string;
  className?: string;
  showLabels?: boolean;
  systemIconBreakpoint?: SystemIconBreakpoint;
}

function SunModernIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4.2" className="fill-amber-400/20 stroke-amber-500 dark:stroke-amber-400" />
      <path d="M12 2v2.5M12 19.5V22M4.93 4.93l1.8 1.8M17.27 17.27l1.8 1.8M2 12h2.5M19.5 12H22M4.93 19.07l1.8-1.8M17.27 6.73l1.8-1.8" className="stroke-amber-500 dark:stroke-amber-400" />
    </svg>
  );
}

function MoonModernIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
        className="fill-sky-400/15 stroke-sky-500 dark:stroke-sky-300"
      />
      <circle cx="19" cy="5" r="1" className="fill-sky-400 stroke-none" />
      <circle cx="16" cy="8" r="0.6" className="fill-sky-400/70 stroke-none" />
    </svg>
  );
}

function SystemModernIcon({ className, breakpoint = "sm" }: { className?: string; breakpoint?: SystemIconBreakpoint }) {
  const monitorVisibility = { sm: "hidden sm:block", md: "hidden md:block", lg: "hidden lg:block", xl: "hidden xl:block" }[breakpoint];
  const phoneVisibility = { sm: "sm:hidden", md: "md:hidden", lg: "lg:hidden", xl: "xl:hidden" }[breakpoint];
  return (
    <>
      <Monitor className={cn(className, monitorVisibility)} aria-hidden="true" />
      <Smartphone className={cn(className, phoneVisibility)} aria-hidden="true" />
    </>
  );
}

export function ThemeToggle({ locale, className, showLabels = false, systemIconBreakpoint = "sm" }: ThemeToggleProps) {
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let mode: ThemeMode = "system";
    try {
      const saved = localStorage.getItem("theme") as ThemeMode | null;
      mode = saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
    } catch {
      // ignore
    }
    setTheme(mode);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    setDocumentTheme(isDarkForMode(mode, media.matches), false);

    const onSystemThemeChange = (event: MediaQueryListEvent) => {
      if (mode === "system") setDocumentTheme(event.matches, true);
    };
    media.addEventListener("change", onSystemThemeChange);
    return () => media.removeEventListener("change", onSystemThemeChange);
  }, [locale]);

  const applyTheme = (mode: ThemeMode, origin?: { x: number; y: number }) => {
    setTheme(mode);
    try {
      localStorage.setItem("theme", mode);
    } catch {
      // localStorage may fail in private mode
    }
    document.cookie = `theme=${mode};path=/;max-age=31536000;SameSite=Lax`;
    setDocumentTheme(isDarkForMode(mode, window.matchMedia("(prefers-color-scheme: dark)").matches), true, origin);
    window.dispatchEvent(new CustomEvent("theme-mode-change", { detail: mode }));
  };

  useEffect(() => {
    const syncThemeMode = (event: Event) => {
      const mode = (event as CustomEvent<ThemeMode>).detail;
      if (mode === "light" || mode === "dark" || mode === "system") setTheme(mode);
    };
    window.addEventListener("theme-mode-change", syncThemeMode);
    return () => window.removeEventListener("theme-mode-change", syncThemeMode);
  }, []);

  const labels = {
    light: locale === "ar" ? "فاتح" : "Clair",
    dark: locale === "ar" ? "داكن" : "Sombre",
    system: locale === "ar" ? "تلقائي" : "Système"
  };

  if (!mounted) {
    return (
      <div className={cn("inline-flex items-center rounded-lg border border-border/80 p-1 bg-card text-muted-foreground", className)}>
        <span className="p-1"><SunModernIcon className="h-4 w-4" /></span>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={locale === "ar" ? "المظهر" : "Thème"}
      className={cn(
        "inline-flex items-center rounded-lg border border-border/80 bg-background/80 p-0.5 shadow-2xs text-xs",
        className
      )}
    >
      <button
        type="button"
        onClick={(event) => applyTheme("light", { x: event.clientX, y: event.clientY })}
        aria-pressed={theme === "light"}
        title={labels.light}
        className={cn(
          "inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 font-medium transition-all active:scale-95",
          theme === "light"
            ? "bg-card text-amber-600 dark:text-amber-400 font-semibold shadow-xs border border-border/60"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <SunModernIcon className="h-4 w-4" />
        {showLabels && <span>{labels.light}</span>}
      </button>

      <button
        type="button"
        onClick={(event) => applyTheme("dark", { x: event.clientX, y: event.clientY })}
        aria-pressed={theme === "dark"}
        title={labels.dark}
        className={cn(
          "inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 font-medium transition-all active:scale-95",
          theme === "dark"
            ? "bg-card text-sky-500 dark:text-sky-300 font-semibold shadow-xs border border-border/60"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <MoonModernIcon className="h-4 w-4" />
        {showLabels && <span>{labels.dark}</span>}
      </button>

      <button
        type="button"
        onClick={(event) => applyTheme("system", { x: event.clientX, y: event.clientY })}
        aria-pressed={theme === "system"}
        title={labels.system}
        className={cn(
          "inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 font-medium transition-all active:scale-95",
          theme === "system"
            ? "bg-card text-foreground font-semibold shadow-xs border border-border/60"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <SystemModernIcon className="h-4 w-4" breakpoint={systemIconBreakpoint} />
        {showLabels && <span>{labels.system}</span>}
      </button>
    </div>
  );
}
