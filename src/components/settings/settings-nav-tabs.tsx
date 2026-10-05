"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Users, KeyRound, ScrollText, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { sortDashboardLinksByNavOrder } from "@/lib/dashboard-navigation";

interface SettingsNavTabsProps {
  locale: string;
  canManageUsers?: boolean;
  canManageRoles?: boolean;
  canViewAudit?: boolean;
  canManageJobs?: boolean;
}

export function SettingsNavTabs({
  locale,
  canManageUsers = true,
  canManageRoles = true,
  canViewAudit = true,
  canManageJobs = true
}: SettingsNavTabsProps) {
  const pathname = usePathname();
  const isAr = locale === "ar";

  const tabs = [
    {
      href: `/${locale}/dashboard/settings`,
      label: isAr ? "إعدادات النادي والهوية" : "Paramètres du club",
      icon: Settings,
      visible: true,
      exact: true
    },
    {
      href: `/${locale}/dashboard/users`,
      label: isAr ? "المستخدمون" : "Utilisateurs",
      icon: Users,
      visible: canManageUsers,
      exact: false
    },
    {
      href: `/${locale}/dashboard/roles`,
      label: isAr ? "الأدوار والصلاحيات" : "Rôles & Permissions",
      icon: KeyRound,
      visible: canManageRoles,
      exact: false
    },
    {
      href: `/${locale}/dashboard/audit-logs`,
      label: isAr ? "سجل العمليات والرقابة" : "Journal d'audit",
      icon: ScrollText,
      visible: canViewAudit,
      exact: false
    },
    {
      href: `/${locale}/dashboard/jobs`,
      label: isAr ? "المهام الخلفية" : "Tâches d'arrière-plan",
      icon: Cpu,
      visible: canManageJobs,
      exact: false
    }
  ].filter((t) => t.visible);
  const orderedTabs = sortDashboardLinksByNavOrder("system", tabs);

  return (
    <div className="mb-6 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
          <span className="inline-block h-2 w-2 rounded-full bg-club-primary" />
          <span>{isAr ? "إدارة النظام والرقابة" : "Système & Gouvernance"}</span>
        </div>
      </div>

      <div className="border-b border-border/80">
        <nav className="-mb-px flex flex-wrap gap-1 sm:gap-2" aria-label="System Settings Sections">
          {orderedTabs.map((tab) => {
            const isActive = tab.exact
              ? pathname === tab.href
              : pathname.startsWith(tab.href);
            const Icon = tab.icon;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group inline-flex items-center gap-2 border-b-2 py-2.5 px-3.5 text-xs sm:text-sm font-bold transition-all rounded-t-lg",
                  isActive
                    ? "border-club-primary text-club-primary bg-club-primary/5"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground hover:bg-muted/40"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isActive ? "text-club-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
