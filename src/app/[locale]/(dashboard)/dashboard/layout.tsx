import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Bell, ExternalLink, Globe } from "lucide-react";
import { getSessionOrThrow, hasPermission } from "@/lib/permissions";
import { resolveUserTeamContext } from "@/lib/team-context";
import { db } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { SidebarNav, type NavGroup } from "@/components/shared/sidebar-nav";
import { ResizableSidebar } from "@/components/shared/resizable-sidebar";
import { TeamSwitcher } from "@/components/shared/team-switcher";
import { CommandCenter, CommandCenterTrigger } from "@/components/shared/command-center";
import { NotificationsPopover } from "@/components/shared/notifications-popover";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { DashboardLanguageSwitcher } from "@/components/shared/dashboard-language-switcher";
import { DashboardClock } from "@/components/shared/dashboard-clock";
import { DashboardPresenceHeartbeat } from "@/components/shared/dashboard-presence-heartbeat";
import { LogoutButton } from "@/components/shared/logout-button";
import { NOTIFIABLE_TYPE_KEYS } from "@/lib/insights/notifications";
import { redirect } from "next/navigation";
import { DASHBOARD_NAV_GROUPS } from "@/lib/dashboard-navigation";
import { getClubBrandStyle } from "@/lib/branding";
import { getPublicSiteUrl } from "@/lib/public-site-url";
import { SafeImage } from "@/components/shared/safe-image";
import { ClubLogo } from "@/components/shared/club-logo";
import { DashboardMailNotifier } from "@/components/shared/dashboard-mail-notifier";
import { DhikrReminder } from "@/components/shared/dhikr-reminder";
import { normalizePublicMediaUrl } from "@/lib/media-utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "ar"
      ? "المنصة الإدارية لجمعية أمل سيدي حسني"
      : "Plateforme administrative de l’Association Espoir Sidi Hosni"
  };
}

export default async function DashboardLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, sessionResult] = await Promise.all([
    params,
    getSessionOrThrow().then((user) => ({ user })).catch(() => ({ user: null }))
  ]);
  const user = sessionResult.user;
  if (!user) redirect(`/${locale}/login`);

  const visibleGroups: NavGroup[] = DASHBOARD_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.requiredPermission || hasPermission(user, item.requiredPermission))
  })).filter((group) => group.items.length > 0);

  const [teamCtx, t, tNotif, tInsights, unreadNotifications, recentNotifications, userAccount, clubSettings] = await Promise.all([
    resolveUserTeamContext(),
    getTranslations("teams"),
    getTranslations("notifications"),
    getTranslations("insights"),
    db.notification.count({ where: { userId: user.id, isRead: false } }),
    db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 8
    }),
    db.user.findUnique({
      where: { id: user.id },
      select: {
        image: true,
        staff: {
          select: { photoUrl: true }
        }
      }
    }),
    db.clubSettings.findUnique({ where: { id: "singleton" }, select: { name: true, shortName: true, logoUrl: true, primaryColor: true, secondaryColor: true } })
  ]);
  const userPhoto = userAccount?.image || userAccount?.staff?.photoUrl;
  const teamOptions = teamCtx.authorizedTeams.map((team) => ({ id: team.id, label: t(`categories.${team.category}` as any) }));

  const altLocale = locale === "ar" ? "fr" : "ar";
  const altLocaleLabel = locale === "ar" ? "FR" : "عربي";
  const publicSiteUrl = getPublicSiteUrl(locale);

  // Compute localized date string
  const today = new Date();
  const dateFormatted = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(today);

  const userInitial = user.name ? user.name.trim().charAt(0).toUpperCase() : "U";
  // Hallmark waiver: keep the established institutional line “ESH • 2018 — ∞” verbatim.
  const clubBrandStyle = clubSettings?.primaryColor && clubSettings?.secondaryColor
    ? getClubBrandStyle(clubSettings.primaryColor, clubSettings.secondaryColor)
    : undefined;

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-background antialiased" style={clubBrandStyle}>
      <DashboardPresenceHeartbeat />
      <DashboardMailNotifier locale={locale} enabled={hasPermission(user, "mail.view")} />
      <DhikrReminder locale={locale} />
      {/* Institutional Left/Right Resizable Sidebar (Locked Spec A.3: Right in RTL, Left in LTR) */}
      <ResizableSidebar locale={locale} defaultWidth={264} minWidth={220} maxWidth={400}>
        {/* Official Club Branding Header (Spec A.3 & Concept Image) */}
        <div className="hidden border-b border-border p-4 md:flex flex-col gap-2.5 bg-muted/20 dark:bg-black/30 shrink-0">
          <Link href={`/${locale}/dashboard`} className="flex items-center gap-3 group min-w-0">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white shadow-xs transition-transform group-hover:scale-105 dark:bg-background">
              <ClubLogo src="/branding/esh-logo-64.png" fallbackSrc="/branding/esh-logo-64.png" alt={locale === "ar" ? "الجمعية الرياضية أمل سيدي حسني لكرة القدم" : "Association Sportive Espoir Sidi Hosni de Football"} className="h-8 w-8 object-contain" />
            </div>
            <div className="min-w-0">
              <p className="club-name line-clamp-3 whitespace-normal text-sm font-bold leading-tight tracking-tight text-foreground group-hover:text-club-primary transition-colors">
                {locale === "ar" ? (clubSettings?.name || "الجمعية الرياضية أمل سيدي حسني لكرة القدم") : "Association Sportive Espoir Sidi Hosni de Football"}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="whitespace-normal break-words text-[9px] font-semibold leading-tight text-muted-foreground tracking-wide inline-flex items-center gap-1">
                  <span dir="ltr" style={{ direction: "ltr", unicodeBidi: "isolate" }} className="tabular-nums font-semibold">ESH • 2018 — ∞</span>
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* Scrollable Navigation Area */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
          <SidebarNav
            groups={visibleGroups}
            locale={locale}
            clubName={locale === "ar" ? (clubSettings?.name || "الجمعية الرياضية أمل سيدي حسني لكرة القدم") : "Association Sportive Espoir Sidi Hosni de Football"}
            clubLogoUrl={normalizePublicMediaUrl(clubSettings?.logoUrl) || "/branding/esh-logo-64.png"}
          />
        </div>

        {/* User Mini Profile & Language/Theme Controls Footer */}
        <div className="hidden border-t border-border p-3 md:flex flex-col gap-2.5 bg-muted/10 dark:bg-black/30 text-xs shrink-0">
          {/* Dynamic Route-Preserving Language Switcher */}
          <DashboardLanguageSwitcher currentLocale={locale} variant="pill" />

          {/* Theme & Quick External Access Row */}
          <div className="flex items-center justify-between gap-2">
            <ThemeToggle locale={locale} className="flex-1 justify-around" />
            <Link
              href={publicSiteUrl}
              target="_blank"
              title={locale === "ar" ? "زيارة الموقع العام للنادي" : "Visiter le site public du club"}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border/80 bg-background/80 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-[color,border-color,background-color] duration-150 hover:border-club-primary hover:text-foreground motion-reduce:transition-none shadow-2xs shrink-0"
            >
              <ExternalLink className="h-3 w-3" />
              <span>{locale === "ar" ? "الموقع" : "Site"}</span>
            </Link>
          </div>

        </div>
      </ResizableSidebar>

      {/* Main Content Workspace */}
      <main data-dashboard-main className="min-w-0 w-full flex-1 bg-muted/30 p-3 sm:p-4 md:p-6 print:bg-white print:p-0 flex flex-col">
        {/* Top Control Bar (Concept Image media_1790973628860.png Alignment) */}
        <div className="mb-6 grid grid-cols-1 items-center gap-3 print:hidden lg:grid-cols-[minmax(18rem,30rem)_auto] lg:justify-between">
          {/* Quick Search Trigger (Ctrl+K) & Optional Team Switcher */}
          <div className="flex w-full min-w-0 items-center gap-2.5 lg:min-w-0">
            <div className="min-w-0 flex-1">
              <CommandCenterTrigger locale={locale} className="w-full min-w-0 bg-card shadow-2xs py-2 px-3.5 rounded-xl border-border" />
            </div>
            <TeamSwitcher
              locale={locale}
              currentTeamId={teamCtx.activeTeamId}
              teams={teamOptions}
              allTeamsLabel={teamCtx.canSelectAll ? t("allTeams") : null}
            />
          </div>

          {/* Context Controls: User Profile, Date, Language, Notifications */}
          <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-2 sm:justify-end sm:gap-2.5 lg:w-auto">
            {/* Date Display Pill */}
            <div className="hidden lg:flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-2xs">
              <span className="inline-block h-2 w-2 rounded-full bg-club-primary" />
              <span className="capitalize">{dateFormatted}</span>
            </div>

            {/* Live 24h Clock (Algeria Time) */}
            <DashboardClock />

            {/* Quick Public Site Link */}
            <Link
              href={publicSiteUrl}
              target="_blank"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-club-primary hover:text-foreground shadow-2xs transition-colors"
            >
              <span>{locale === "ar" ? "الموقع العام" : "Site Public"}</span>
              <ExternalLink className="h-3 w-3" />
            </Link>

            {/* Institutional Logout Button */}
            <LogoutButton locale={locale} />

            {/* Notification Bell Dropdown Popover */}
            <NotificationsPopover
              locale={locale}
              unreadCount={unreadNotifications}
              notifications={recentNotifications.map((n) => {
                const insightKey = ((n.params as any)?._t as string | undefined) ?? n.type;
                const localizedTitle =
                  n.params && NOTIFIABLE_TYPE_KEYS.includes(insightKey)
                    ? tInsights(`types.${insightKey}` as any, n.params as any)
                    : n.title;

                return {
                  id: n.id,
                  title: localizedTitle,
                  link: n.link,
                  createdAt: n.createdAt,
                  isRead: n.isRead,
                  type: n.type
                };
              })}
              labels={{
                title: tNotif("title"),
                markAllRead: tNotif("markAllRead"),
                markRead: tNotif("markRead"),
                viewAll: locale === "ar" ? "عرض كافة الإشعارات" : "Voir toutes les notifications",
                empty: tNotif("empty")
              }}
            />

            {/* User Profile Chip (Avatar + Name + Role Badge) */}
            <Link href={`/${locale}/dashboard/account`} aria-label={locale === "ar" ? "حسابي وتغيير كلمة المرور" : "Mon compte et mon mot de passe"} title={locale === "ar" ? "حسابي وتغيير كلمة المرور" : "Mon compte et mon mot de passe"} className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-2.5 py-1.5 shadow-2xs transition-colors hover:border-club-primary/50">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden bg-club-primary/10 text-club-primary font-bold text-xs ring-1 ring-club-primary/20 shrink-0">
                {userPhoto ? (
                  <SafeImage
                    src={userPhoto}
                    fallbackSrc="/branding/esh-logo-64.png"
                    alt={user.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{userInitial}</span>
                )}
              </div>
              <div className="hidden sm:flex flex-col text-start min-w-0">
                <span className="text-xs font-bold text-foreground leading-tight truncate max-w-[130px]">
                  {user.name}
                </span>
                <span className="inline-block text-[10px] font-medium text-club-primary dark:text-club-primary/90 leading-tight truncate max-w-[130px]">
                  {user.roleName}
                </span>
              </div>
            </Link>
          </div>
        </div>

        <div className="dashboard-page-frame flex-1">
          {children}
        </div>
      </main>

      <CommandCenter locale={locale} />
    </div>
  );
}
