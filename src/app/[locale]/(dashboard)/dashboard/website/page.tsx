import { db } from "@/lib/db";
import { hasPermission, requirePermission } from "@/lib/permissions";
import { getWebsiteAnalytics } from "@/lib/analytics";
import { WebsiteAnalyticsDashboard } from "@/components/dashboard/website-analytics-dashboard";
import { WebsiteAppearanceManager } from "@/components/dashboard/website-appearance-manager";
import { DashboardWelcomeBannerManager } from "@/components/dashboard/dashboard-welcome-banner-manager";

export default async function WebsiteManagementPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requirePermission("news.view");
  const canManageAppearance = hasPermission(user, "settings.manage");

  const [
    analytics,
    publishedNewsCount,
    publishedMatchesCount,
    albumsCount,
    announcementsCount,
    latestNewsList,
    nextMatch,
    websiteSettings
  ] = await Promise.all([
    getWebsiteAnalytics(),
    db.news.count({ where: { status: "PUBLISHED" } }),
    db.match.count({ where: { status: { in: ["SCHEDULED", "LIVE", "FINISHED"] } } }),
    db.album.count(),
    db.announcement.count({ where: { status: "PUBLISHED" } }),
    db.news.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 5,
      select: {
        id: true,
        category: true,
        publishedAt: true,
        createdAt: true,
        translations: {
          where: { locale },
          select: { title: true }
        }
      }
    }),
    db.match.findFirst({
      where: {
        status: "SCHEDULED",
        matchDate: { gte: new Date() }
      },
      orderBy: { matchDate: "asc" },
      select: {
        homeTeamName: true,
        awayTeamName: true,
        isHomeFixture: true,
        stadium: true,
        matchDate: true
      }
    }),
    db.clubSettings.findUnique({
      where: { id: "singleton" },
      select: { homepageHeroImageUrl: true, dashboardWelcomeBannerUrl: true }
    })
  ]);

  const latestNews = latestNewsList.map((n) => ({
    id: n.id,
    title: n.translations[0]?.title || "خبر النادي",
    publishedAt: n.publishedAt || n.createdAt,
    category: n.category
  }));

  const nextMatchData = nextMatch
    ? {
        opponent: nextMatch.isHomeFixture ? nextMatch.awayTeamName : nextMatch.homeTeamName,
        matchDate: nextMatch.matchDate,
        stadium: nextMatch.stadium,
        isHomeFixture: nextMatch.isHomeFixture
      }
    : null;

  return (
    <div className="space-y-6">
      {canManageAppearance && (
        <>
          <WebsiteAppearanceManager locale={locale} currentImageUrl={websiteSettings?.homepageHeroImageUrl ?? null} />
          <DashboardWelcomeBannerManager locale={locale} currentImageUrl={websiteSettings?.dashboardWelcomeBannerUrl ?? null} />
        </>
      )}
      <WebsiteAnalyticsDashboard
        locale={locale}
        analytics={analytics}
        publishedNewsCount={publishedNewsCount}
        publishedMatchesCount={publishedMatchesCount}
        albumsCount={albumsCount}
        announcementsCount={announcementsCount}
        latestNews={latestNews}
        nextMatch={nextMatchData}
      />
    </div>
  );
}
