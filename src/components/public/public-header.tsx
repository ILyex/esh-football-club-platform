"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Globe, Home, Users, CalendarDays, Trophy, Newspaper, Images, Landmark } from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { ClubLogo } from "@/components/shared/club-logo";

interface PublicHeaderProps {
  locale: string;
  clubName: string;
  clubShortName: string;
  labels: {
    home: string;
    club: string;
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
  labels
}: PublicHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const isFrench = locale === "fr";

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileMenuOpen]);

  const otherLocale = locale === "ar" ? "fr" : "ar";

  // Calculate swap path for language switcher
  const segments = pathname.split("/").filter(Boolean);
  segments[0] = otherLocale;
  const switchLocalePath = "/" + segments.join("/");
  const rememberLocale = () => {
    document.cookie = `NEXT_LOCALE=${otherLocale}; path=/; max-age=31536000; SameSite=Lax`;
  };

  const navItems = [
    { href: `/${locale}`, label: labels.home, icon: Home },
    { href: `/${locale}/team`, label: labels.team, icon: Users },
    { href: `/${locale}/matches`, label: labels.matches, icon: CalendarDays },
    { href: `/${locale}/competitions`, label: labels.competitions, icon: Trophy },
    { href: `/${locale}/news`, label: labels.news, icon: Newspaper },
    { href: `/${locale}/gallery`, label: labels.gallery, icon: Images },
    { href: `/${locale}/club`, label: labels.club, icon: Landmark }
  ];

  const isActive = (href: string) => {
    if (href === `/${locale}`) return pathname === `/${locale}`;
    return pathname.startsWith(href);
  };

  return (
    <header className="public-site-header sticky top-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 overflow-hidden px-3 py-2.5 sm:px-6 sm:py-3 lg:gap-5">
        {/* Club Brand & Logo */}
        <Link href={`/${locale}`} className={`group flex min-w-0 shrink-0 items-center gap-2.5 sm:gap-3 md:ml-auto ${isFrench ? "basis-[210px] sm:basis-[320px]" : "basis-[230px] sm:basis-[280px]"}`}>
          <div className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/80 bg-card p-0.5 shadow-sm transition-transform group-hover:scale-105 ${isFrench ? "h-11 w-11 sm:h-14 sm:w-14" : "h-9 w-9 sm:h-12 sm:w-12"}`}>
            <ClubLogo src="/branding/esh-logo-128.png" fallbackSrc="/branding/esh-logo-128.png" alt={clubName} className="h-full w-full object-contain" />
          </div>
          {/* Keep the club name aligned with the logo and place the short identity
              line underneath it instead of beside it. */}
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-0 text-start">
            <span className={`club-name block w-full min-w-0 font-extrabold tracking-tight text-foreground transition-colors group-hover:text-club-primary ${isFrench ? "line-clamp-3 whitespace-normal break-words text-xs leading-tight sm:text-[15px] lg:text-[17px]" : "whitespace-nowrap text-[11px] leading-snug sm:text-sm lg:text-base"}`}>
              {clubShortName || clubName}
            </span>
            {/* Hallmark waiver: keep the established institutional line “ESH • 2018 — ∞” verbatim. */}
            <span dir="ltr" style={{ direction: "ltr", unicodeBidi: "isolate" }} className="block w-fit max-w-full self-start whitespace-nowrap text-[10px] font-medium leading-tight text-muted-foreground sm:text-[11px]">
              ESH • 2018 — ∞
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden min-w-0 flex-1 justify-center overflow-hidden xl:flex xl:items-center xl:gap-0 2xl:gap-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group/nav relative inline-flex min-h-11 min-w-0 shrink items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-1.5 text-xs font-medium text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary/45 motion-reduce:transition-none 2xl:gap-1.5 2xl:px-2 2xl:text-sm ${
                  active
                    ? "font-semibold text-foreground"
                    : "text-foreground hover:text-club-primary"
                }`}
              >
                <item.icon className={`h-3.5 w-3.5 shrink-0 transition-[color,transform] duration-150 group-hover/nav:scale-105 motion-reduce:transition-none ${active ? "text-club-primary" : "text-muted-foreground group-hover/nav:text-club-primary"}`} aria-hidden="true" />
                <span className={`relative inline-block py-1 after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-center after:rounded-full after:bg-club-primary after:transition-transform after:duration-200 motion-reduce:after:transition-none ${active ? "after:scale-x-100" : "after:scale-x-0 group-hover/nav:after:scale-x-100"}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Right Actions: Theme Toggle & Language Switcher */}
        <div className="hidden shrink-0 xl:flex xl:items-center xl:gap-2">
          {/* Theme Toggle */}
          <ThemeToggle locale={locale} systemIconBreakpoint="xl" />

          {/* Language Switcher */}
          <Link
            href={switchLocalePath}
            replace
            onClick={rememberLocale}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
            title={labels.switchLocale}
          >
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{otherLocale === "ar" ? "AR" : "FR"}</span>
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex shrink-0 items-center gap-2 xl:hidden">
          <Link
            href={switchLocalePath}
            replace
            onClick={rememberLocale}
            className="inline-flex h-11 min-w-11 items-center justify-center rounded-xl border border-border px-3 text-xs font-semibold"
          >
            {otherLocale === "ar" ? "AR" : "FR"}
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-[color,background-color,transform] duration-150 hover:bg-muted hover:text-foreground active:scale-[0.98] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary/50"
            aria-label={mobileMenuOpen ? labels.close : labels.menu}
            aria-expanded={mobileMenuOpen}
            aria-controls="public-mobile-navigation"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6 text-foreground" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      <div
        aria-hidden={!mobileMenuOpen}
        inert={!mobileMenuOpen}
        className={`grid overflow-hidden border-b border-border bg-card px-4 shadow-lg transition-[grid-template-rows,opacity,transform] duration-200 ease-out motion-reduce:transition-none xl:hidden ${
          mobileMenuOpen
            ? "pointer-events-auto grid-rows-[1fr] translate-y-0 opacity-100"
            : "pointer-events-none grid-rows-[0fr] -translate-y-1 opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <nav id="public-mobile-navigation" className="flex flex-col space-y-1">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`group/nav flex min-h-11 items-center rounded-xl border px-3 py-2 text-sm font-medium transition-[color,background-color,border-color] duration-150 motion-reduce:transition-none ${
                    active
                      ? "border-club-primary/20 bg-club-primary/10 font-semibold text-club-primary"
                      : "border-transparent text-foreground hover:border-club-primary/15 hover:bg-club-primary/5"
                  }`}
                >
                  <item.icon className="me-2 h-4 w-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
            <div className="pt-2 border-t border-border mt-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{locale === "ar" ? "المظهر" : "Thème"}</span>
              <ThemeToggle locale={locale} systemIconBreakpoint="xl" />
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
