"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Globe } from "lucide-react";

interface DashboardLanguageSwitcherProps {
  currentLocale: string;
  variant?: "pill" | "compact";
  className?: string;
}

function LanguageSwitcherInner({
  currentLocale,
  variant = "pill",
  className = ""
}: DashboardLanguageSwitcherProps) {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const searchString = searchParams?.toString() ? `?${searchParams.toString()}` : "";

  const getPathForLocale = (targetLocale: string) => {
    if (!pathname) return `/${targetLocale}/dashboard${searchString}`;

    const segments = pathname.split("/").filter(Boolean);

    if (segments[0] === "ar" || segments[0] === "fr") {
      segments[0] = targetLocale;
      return `/${segments.join("/")}${searchString}`;
    }

    return `/${targetLocale}/${segments.join("/")}${searchString}`;
  };

  const handleLocaleClick = (targetLocale: string) => {
    if (typeof document !== "undefined") {
      document.cookie = `NEXT_LOCALE=${targetLocale}; path=/; max-age=31536000; SameSite=Lax`;
    }
  };

  if (variant === "compact") {
    const otherLocale = currentLocale === "ar" ? "fr" : "ar";
    const otherLabel = otherLocale === "ar" ? "العربية" : "FR";
    const otherTitle = otherLocale === "ar" ? "التبديل إلى العربية" : "Passer en Français";

    return (
      <Link
        href={getPathForLocale(otherLocale)}
        replace
        onClick={() => handleLocaleClick(otherLocale)}
        title={otherTitle}
        className={`inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-bold text-foreground hover:border-club-primary hover:text-club-primary shadow-2xs transition-all ${className}`}
      >
        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-mono">{otherLabel}</span>
      </Link>
    );
  }

  return (
    <div className={`flex items-center rounded-lg border border-border/80 bg-background/80 p-0.5 shadow-2xs ${className}`}>
      <Link
        href={getPathForLocale("fr")}
        replace
        onClick={() => handleLocaleClick("fr")}
        className={`flex-1 rounded-md py-1 text-center text-[11px] font-bold transition-all ${
          currentLocale === "fr"
            ? "bg-club-primary text-white shadow-xs"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
        }`}
      >
        Français
      </Link>
      <Link
        href={getPathForLocale("ar")}
        replace
        onClick={() => handleLocaleClick("ar")}
        className={`flex-1 rounded-md py-1 text-center text-[11px] font-bold transition-all ${
          currentLocale === "ar"
            ? "bg-club-primary text-white shadow-xs"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
        }`}
      >
        العربية
      </Link>
    </div>
  );
}

export function DashboardLanguageSwitcher(props: DashboardLanguageSwitcherProps) {
  return (
    <Suspense
      fallback={
        props.variant === "compact" ? (
          <div className="h-8 w-14 rounded-xl bg-card border border-border" />
        ) : (
          <div className="h-7 w-full rounded-lg bg-background border border-border" />
        )
      }
    >
      <LanguageSwitcherInner {...props} />
    </Suspense>
  );
}
