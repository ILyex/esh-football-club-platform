import type { NavGroup } from "@/components/shared/sidebar-nav";

/** Canonical order for dashboard navigation groups and their section tabs. */
export const DASHBOARD_NAV_GROUPS: NavGroup[] = [
  {
    groupKey: "_root",
    items: [
      { href: "/dashboard", labelKey: "dashboard" },
      { href: "/dashboard/notifications", labelKey: "notifications" }
    ]
  },
  {
    groupKey: "football",
    items: [
      { href: "/dashboard/teams", labelKey: "teams", requiredPermission: "teams.view" },
      { href: "/dashboard/players", labelKey: "players", requiredPermission: "players.view" },
      { href: "/dashboard/player-stats", labelKey: "playerStats", requiredPermission: "player.stats.view" },
      { href: "/dashboard/staff", labelKey: "staff", requiredPermission: "staff.view" },
      { href: "/dashboard/matches", labelKey: "matches", requiredPermission: "matches.view" },
      { href: "/dashboard/competitions", labelKey: "competitions", requiredPermission: "competitions.view" },
      { href: "/dashboard/training", labelKey: "training", requiredPermission: "training.view" },
      { href: "/dashboard/tactics", labelKey: "tactics", requiredPermission: "training.view" },
      { href: "/dashboard/testing", labelKey: "testing", requiredPermission: "testing.view" },
      { href: "/dashboard/calendar", labelKey: "calendar", requiredPermission: "calendar.view" },
      { href: "/dashboard/inventory", labelKey: "inventory", requiredPermission: "training.view" }
    ]
  },
  {
    groupKey: "governance",
    items: [
      { href: "/dashboard/documents", labelKey: "documents", requiredPermission: "documents.view" },
      { href: "/dashboard/contracts", labelKey: "contracts", requiredPermission: "contracts.view" },
      { href: "/dashboard/correspondence", labelKey: "correspondence", requiredPermission: "correspondence.view" },
      { href: "/dashboard/meeting-minutes", labelKey: "meetingMinutes", requiredPermission: "meetings.view" },
      { href: "/dashboard/medical-records", labelKey: "medicalRecords", requiredPermission: "medical.records.view" },
      { href: "/dashboard/reports", labelKey: "reports", requiredPermission: "reports.view" }
    ]
  },
  {
    groupKey: "media",
    items: [
      { href: "/dashboard/website/reels", labelKey: "websiteReels", requiredPermission: "settings.manage" },
      { href: "/dashboard/website/images", labelKey: "websiteImages", requiredPermission: "settings.manage" },
      { href: "/dashboard/website/analytics", labelKey: "websiteAnalytics", requiredPermission: "news.view" },
      { href: "/dashboard/mail", labelKey: "mail", requiredPermission: "mail.view" },
      { href: "/dashboard/news", labelKey: "news", requiredPermission: "news.view" },
      { href: "/dashboard/announcements", labelKey: "announcements", requiredPermission: "announcements.view" },
      { href: "/dashboard/gallery", labelKey: "gallery", requiredPermission: "gallery.view" }
    ]
  },
  {
    groupKey: "finance",
    items: [
      { href: "/dashboard/finance", labelKey: "overview", requiredPermission: "finance.view" },
      { href: "/dashboard/finance/treasury?view=BANK", labelKey: "bank", requiredPermission: "finance.view" },
      { href: "/dashboard/finance/treasury?view=CASH", labelKey: "cash", requiredPermission: "finance.view" },
      { href: "/dashboard/finance/treasury?view=DEPOSITS", labelKey: "deposits", requiredPermission: "finance.view" },
      { href: "/dashboard/finance/treasury?view=WITHDRAWALS", labelKey: "withdrawals", requiredPermission: "finance.view" },
      { href: "/dashboard/finance/expenses", labelKey: "expenses", requiredPermission: "finance.view" }
    ]
  },
  {
    groupKey: "system",
    items: [
      { href: "/dashboard/users", labelKey: "users", requiredPermission: "users.view" },
      { href: "/dashboard/roles", labelKey: "roles", requiredPermission: "roles.manage" },
      { href: "/dashboard/settings", labelKey: "settings", requiredPermission: "settings.manage" },
      { href: "/dashboard/audit-logs", labelKey: "auditLogs", requiredPermission: "audit.view" },
      { href: "/dashboard/jobs", labelKey: "jobs", requiredPermission: "settings.manage" }
    ]
  }
];

function normalizeDashboardHref(href: string): string {
  const url = new URL(href, "https://dashboard.local");
  const path = url.pathname.replace(/^\/(?:ar|fr)(?=\/|$)/i, "") || "/";
  const search = new URLSearchParams(
    [...url.searchParams.entries()].sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue)
    )
  ).toString();
  return `${path}${search ? `?${search}` : ""}`;
}

export function sortDashboardLinksByNavOrder<T extends { href: string }>(groupKey: string, links: T[]): T[] {
  const group = DASHBOARD_NAV_GROUPS.find((candidate) => candidate.groupKey === groupKey);
  if (!group) return links;
  const rank = new Map(group.items.map((item, index) => [normalizeDashboardHref(item.href), index]));
  return links
    .map((link, index) => ({ link, index, order: rank.get(normalizeDashboardHref(link.href)) ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map(({ link }) => link);
}

export function isDashboardNavHrefActive(
  href: string,
  pathname: string,
  searchParams: Pick<URLSearchParams, "get">
): boolean {
  const target = new URL(href, "https://dashboard.local");
  const targetPath = target.pathname.replace(/^\/(?:ar|fr)(?=\/|$)/i, "") || "/";
  const currentPath = pathname.replace(/^\/(?:ar|fr)(?=\/|$)/i, "") || "/";
  if (target.searchParams.size > 0) {
    return currentPath === targetPath && [...target.searchParams.entries()].every(([key, value]) => searchParams.get(key) === value);
  }
  if (targetPath === "/dashboard") return currentPath === targetPath;
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
}
