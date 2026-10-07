"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Shield, Globe } from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { SafeImage } from "@/components/shared/safe-image";

interface PublicHeaderProps {
  locale: string;
  clubName: string;
  clubShortName: string;
  logoUrl: string | null;
  labels: {
    home: string;
    team: string;
    matches: string;
    competitions: string;
    news: string;
    gallery: string;
    dashboard: string;
    switchLocale: string;
    menu: string;
    close: string;
  };
}

export function PublicHeader({
  locale,
  clubName,
  clubShortName,
  logoUrl,
  labels
}: PublicHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const otherLocale = locale === "ar" ? "fr" : "ar";

  // Calculate swap path for language switcher
  const segments = pathname.split("/").filter(Boolean);
  segments[0] = otherLocale;
  const switchLocalePath = "/" + segments.join("/");
  const rememberLocale = () => {
    document.cookie = `NEXT_LOCALE=${otherLocale}; path=/; max-age=31536000; SameSite=Lax`;
  };

  const navItems = [
    { href: `/${locale}`, label: labels.home },
    { href: `/${locale}/team`, label: labels.team },
    { href: `/${locale}/matches`, label: labels.matches },
    { href: `/${locale}/competitions`, label: labels.competitions },
    { href: `/${locale}/news`, label: labels.news },
    { href: `/${locale}/gallery`, label: labels.gallery }
  ];

  const isActive = (href: string) => {
    if (href === `/${locale}`) return pathname === `/${locale}`;
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6 sm:py-3">
        {/* Club Brand & Logo */}
        <Link href={`/${locale}`} className="group flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/80 bg-card p-0.5 shadow-sm transition-transform group-hover:scale-105 sm:h-12 sm:w-12">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <SafeImage src={logoUrl} fallbackSrc="/branding/esh-logo-128.png" alt={clubName} className="h-full w-full rounded-full object-contain" />
            ) : (
              <Shield className="h-5 w-5 text-club-primary" />
            )}
          </div>
          {/* Keep the club name aligned with the logo and place the short identity
              line underneath it instead of beside it. */}
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-0 text-start">
            <span className="block w-full min-w-0 whitespace-nowrap text-[12px] font-extrabold leading-snug tracking-tight text-foreground transition-colors group-hover:text-club-primary sm:text-base">
              {clubShortName || clubName}
            </span>
            <span dir="ltr" className="block w-full text-[10px] font-medium leading-tight text-muted-foreground sm:text-[11px]">
              ESH • 2018 — ∞
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex md:items-center md:gap-1 lg:gap-2">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-club-primary/10 text-club-primary font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Actions: Theme Toggle & Language Switcher */}
        <div className="hidden md:flex md:items-center md:gap-2">
          {/* Theme Toggle */}
          <ThemeToggle locale={locale} />

          {/* Language Switcher */}
          <Link
            href={switchLocalePath}
            replace
            onClick={rememberLocale}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
            title={labels.switchLocale}
          >
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{otherLocale === "ar" ? "AR" : "Français"}</span>
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex shrink-0 items-center gap-2 md:hidden">
          <Link
            href={switchLocalePath}
            replace
            onClick={rememberLocale}
            className="rounded-md border border-border px-2 py-1 text-xs font-medium"
          >
            {otherLocale === "ar" ? "AR" : "FR"}
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={mobileMenuOpen ? labels.close : labels.menu}
            aria-expanded={mobileMenuOpen}
            aria-controls="public-mobile-navigation"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6 text-foreground" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="border-b border-border bg-card px-4 pt-2 pb-4 shadow-lg md:hidden">
          <nav id="public-mobile-navigation" className="flex flex-col space-y-1">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-club-primary/10 text-club-primary font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="pt-2 border-t border-border mt-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{locale === "ar" ? "المظهر" : "Thème"}</span>
              <ThemeToggle locale={locale} />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
