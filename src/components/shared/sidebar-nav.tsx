"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Bell,
  Shield,
  UserCheck,
  Users,
  Trophy,
  Medal,
  Activity,
  Calendar,
  FileText,
  FileCheck,
  HeartPulse,
  Send,
  ClipboardList,
  BarChart3,
  Mail,
  Newspaper,
  Megaphone,
  Image,
  Wallet,
  Receipt,
  Landmark,
  Vault,
  ArrowDownToDot,
  ArrowUpFromDot,
  PieChart,
  UserCog,
  KeyRound,
  Settings,
  ScrollText,
  Cpu,
  CheckCircle2,
  ChevronDown,
  Menu,
  X,
  Package,
  Timer,
  Globe,
  Loader2,
  Film
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isDashboardNavHrefActive } from "@/lib/dashboard-navigation";
import { ClubLogo } from "@/components/shared/club-logo";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  notifications: Bell,
  teams: Shield,
  players: UserCheck,
  playerStats: BarChart3,
  staff: Users,
  matches: Trophy,
  competitions: Medal,
  training: Activity,
  tactics: ClipboardList,
  testing: Timer,
  calendar: Calendar,
  inventory: Package,
  documents: FileText,
  contracts: FileCheck,
  insurance: Shield,
  correspondence: Send,
  meetingMinutes: ClipboardList,
  medicalRecords: HeartPulse,
  reports: BarChart3,
  website: Globe,
  websiteReels: Film,
  websiteImages: Image,
  websiteAnalytics: BarChart3,
  mail: Mail,
  news: Newspaper,
  announcements: Megaphone,
  gallery: Image,
  overview: Wallet,
  bank: Landmark,
  cash: Vault,
  deposits: ArrowDownToDot,
  withdrawals: ArrowUpFromDot,
  expenses: Receipt,
  treasury: Landmark,
  budgets: PieChart,
  users: UserCog,
  roles: KeyRound,
  settings: Settings,
  auditLogs: ScrollText,
  jobs: Cpu,
  dataQuality: CheckCircle2,
};

export type NavItem = {
  href: string;
  labelKey: string; // key under dashboard.nav.*
  requiredPermission?: string; // omit for always-visible items
};

export type NavGroup = {
  groupKey: string; // key under dashboard.navGroups.*, omit for an ungrouped top item
  items: NavItem[];
};

// Every item declares the permission it needs; items the current user lacks
// are filtered out BEFORE rendering (see dashboard layout, which passes only
// the permitted subset). This is presentation-layer convenience only — the
// real enforcement is server-side in each page/action (spec section 41).
export function SidebarNav({
  groups,
  locale,
  clubName,
  clubLogoUrl
}: {
  groups: NavGroup[];
  locale: string;
  clubName?: string | null;
  clubLogoUrl?: string | null;
}) {
  const t = useTranslations("dashboard.nav");
  const tGroups = useTranslations("dashboard.navGroups");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.toString();
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileMenuCloseRef = useRef<HTMLButtonElement>(null);
  const mobileMenuDialogRef = useRef<HTMLDivElement>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const prefetchedRoutes = useRef(new Set<string>());

  // Clear the visual pending state as soon as the App Router commits the new
  // route. This gives slower server-rendered sections immediate feedback
  // without blocking or duplicating Next.js navigation.
  useEffect(() => {
    setPendingHref(null);
  }, [pathname, currentSearch]);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    mobileMenuCloseRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        mobileMenuTriggerRef.current?.focus();
        return;
      }

      if (event.key === "Tab") {
        const focusableItems = mobileMenuDialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]):not([data-mobile-backdrop]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusableItems?.length) {
          event.preventDefault();
          return;
        }

        const first = focusableItems.item(0);
        const last = focusableItems.item(focusableItems.length - 1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  const isActive = (href: string) => isDashboardNavHrefActive(href, pathname, searchParams);
  const prefetchRoute = (href: string) => {
    const destination = `/${locale}${href}`;
    if (prefetchedRoutes.current.has(destination)) return;
    prefetchedRoutes.current.add(destination);
    router.prefetch(destination, {
      // Prefetch static content fully, while dynamic pages stop at their
      // loading boundary instead of eagerly running every page query on hover.
      kind: "auto" as NonNullable<Parameters<typeof router.prefetch>[1]>["kind"],
      onInvalidate: () => prefetchedRoutes.current.delete(destination)
    });
  };

  const nav = (
    <nav aria-label={tGroups("navigation")} className="flex flex-col gap-4 p-3">
      {groups.map((group) => {
        const visibleItems = group.items;
        if (visibleItems.length === 0) return null;
        const collapsed = collapsedGroups[group.groupKey];
        return (
          <div key={group.groupKey} className="space-y-1">
            {group.groupKey !== "_root" && (
              <button
                type="button"
                onClick={() => setCollapsedGroups((prev) => ({ ...prev, [group.groupKey]: !prev[group.groupKey] }))}
                aria-expanded={!collapsed}
                className="mb-1 flex min-h-10 w-full items-center justify-between rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200"
              >
                <span>{tGroups(group.groupKey as any)}</span>
                <ChevronDown className={cn("h-3 w-3 transition-transform text-muted-foreground dark:text-zinc-400", collapsed && "-rotate-90")} />
              </button>
            )}
            {!collapsed && (
              <div className="flex flex-col gap-1">
                {visibleItems.map((item) => {
                  const active = isActive(item.href);
                  const Icon = ICON_MAP[item.labelKey];
                  return (
                    <Link
                      key={item.href}
                      href={`/${locale}${item.href}`}
                      prefetch={false}
                      onPointerEnter={() => prefetchRoute(item.href)}
                      onFocus={() => prefetchRoute(item.href)}
                      aria-current={active ? "page" : undefined}
                      onClick={() => {
                        setMobileOpen(false);
                        if (!active) setPendingHref(item.href);
                      }}
                      aria-busy={pendingHref === item.href}
                      className={cn(
                        "group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-start transition-all md:min-h-0",
                        active
                          ? "bg-club-primary text-white shadow-xs font-bold"
                          : "text-foreground/80 hover:bg-muted hover:text-foreground dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
                      )}
                    >
                      {pendingHref === item.href ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-current" aria-hidden="true" />
                      ) : Icon ? (
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-colors",
                            active ? "text-white" : "text-muted-foreground group-hover:text-foreground dark:text-zinc-400 dark:group-hover:text-white"
                          )}
                        />
                      ) : null}
                      <span className="truncate">{t(item.labelKey as any)}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile: a top bar with a menu toggle replaces the always-visible desktop sidebar. */}
      <div className="dashboard-mobile-nav flex min-w-0 items-center justify-between gap-3 border-b border-border bg-card/95 p-3 shadow-sm backdrop-blur md:hidden">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <ClubLogo src={clubLogoUrl || "/branding/esh-logo-64.png"} fallbackSrc="/branding/esh-logo-64.png" alt={clubName || (locale === "ar" ? "الجمعية الرياضية أمل سيدي حسني لكرة القدم" : "Association Sportive Espoir Sidi Hosni de Football")} className="h-7 w-7 object-contain" />
          <span className="min-w-0 truncate text-sm font-bold tracking-tight">
            <span className="club-name block truncate leading-tight">{clubName || (locale === "ar" ? "الجمعية الرياضية أمل سيدي حسني لكرة القدم" : "Association Sportive Espoir Sidi Hosni de Football")}</span>
          </span>
        </div>
        <button
          ref={mobileMenuTriggerRef}
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label={tGroups("openMenu")}
          aria-expanded={mobileOpen}
          aria-controls="dashboard-mobile-navigation"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {mobileOpen && (
        <div ref={mobileMenuDialogRef} id="dashboard-mobile-navigation" dir={locale === "ar" ? "rtl" : "ltr"} className="fixed inset-0 z-50 flex h-[100dvh] min-h-[100svh] overscroll-contain md:hidden" role="dialog" aria-modal="true" aria-label={tGroups("navigation")}>
          <div className="h-full w-[min(20rem,calc(100vw-3.5rem))] overflow-y-auto overscroll-contain border-e border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-border p-4 bg-muted/30">
              <div className="flex items-center gap-2">
                <ClubLogo src={clubLogoUrl || "/branding/esh-logo-64.png"} fallbackSrc="/branding/esh-logo-64.png" alt={clubName || (locale === "ar" ? "الجمعية الرياضية أمل سيدي حسني لكرة القدم" : "Association Sportive Espoir Sidi Hosni de Football")} className="h-7 w-7 object-contain" />
                <span className="text-sm font-bold tracking-tight">{tGroups("navigation")}</span>
              </div>
              <button
                ref={mobileMenuCloseRef}
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  mobileMenuTriggerRef.current?.focus();
                }}
                aria-label={tGroups("closeMenu")}
                className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
          </div>
          <button
            type="button"
            data-mobile-backdrop
            aria-label={tGroups("closeMenu")}
            className="flex-1 bg-black/60 backdrop-blur-xs"
            onClick={() => {
              setMobileOpen(false);
              mobileMenuTriggerRef.current?.focus();
            }}
          />
        </div>
      )}

      <div className="hidden md:block flex-1 min-h-0 overflow-y-auto scrollbar-thin">{nav}</div>
    </>
  );
}
