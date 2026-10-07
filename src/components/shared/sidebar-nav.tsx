"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
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
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isDashboardNavHrefActive } from "@/lib/dashboard-navigation";
import { SafeImage } from "@/components/shared/safe-image";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  notifications: Bell,
  teams: Shield,
  players: UserCheck,
  staff: Users,
  matches: Trophy,
  competitions: Medal,
  training: Activity,
  testing: Timer,
  calendar: Calendar,
  inventory: Package,
  documents: FileText,
  contracts: FileCheck,
  insurance: Shield,
  correspondence: Send,
  meetingMinutes: ClipboardList,
  reports: BarChart3,
  website: Globe,
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
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Clear the visual pending state as soon as the App Router commits the new
  // route. This gives slower server-rendered sections immediate feedback
  // without blocking or duplicating Next.js navigation.
  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const isActive = (href: string) => isDashboardNavHrefActive(href, pathname, searchParams);

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
                className="mb-1 flex w-full items-center justify-between px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 hover:text-foreground dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
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
                      aria-current={active ? "page" : undefined}
                      onClick={() => {
                        setMobileOpen(false);
                        startTransition(() => setPendingHref(item.href));
                      }}
                      aria-busy={isPending && pendingHref === item.href}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-start transition-all",
                        active
                          ? "bg-club-primary text-white shadow-xs font-bold"
                          : "text-foreground/80 hover:bg-muted hover:text-foreground dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
                      )}
                    >
                      {isPending && pendingHref === item.href ? (
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
      <div className="flex items-center justify-between border-b border-border bg-card p-3 md:hidden">
        <div className="flex items-center gap-2">
          <SafeImage src={clubLogoUrl || "/branding/esh-logo-64.png"} fallbackSrc="/branding/esh-logo-64.png" alt={clubName || "ESH"} className="h-7 w-7 object-contain" />
          <span className="text-sm font-bold tracking-tight">
            {clubName || "ESH SIDI HOSNI"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label={tGroups("openMenu")}
          className="rounded-md border border-border p-2 hover:bg-muted focus-visible:ring-2 focus-visible:ring-club-primary"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden" role="dialog" aria-modal="true">
          <div className="w-72 overflow-y-auto bg-card shadow-2xl border-e border-border">
            <div className="flex items-center justify-between border-b border-border p-4 bg-muted/30">
              <div className="flex items-center gap-2">
                <SafeImage src={clubLogoUrl || "/branding/esh-logo-64.png"} fallbackSrc="/branding/esh-logo-64.png" alt={clubName || "ESH"} className="h-7 w-7 object-contain" />
                <span className="text-sm font-bold tracking-tight">{tGroups("navigation")}</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label={tGroups("closeMenu")}
                className="rounded-md p-1.5 hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
          </div>
          <button
            type="button"
            aria-label={tGroups("closeMenu")}
            className="flex-1 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
        </div>
      )}

      <div className="hidden md:block flex-1 min-h-0 overflow-y-auto scrollbar-thin">{nav}</div>
    </>
  );
}
