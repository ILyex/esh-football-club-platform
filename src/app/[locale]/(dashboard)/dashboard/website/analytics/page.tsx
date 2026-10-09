import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions";
import { getWebsiteAnalytics } from "@/lib/analytics";
import { WebsiteAnalyticsDashboard } from "@/components/dashboard/website-analytics-dashboard";

export default async function WebsiteAnalyticsPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requirePagePermission("news.view", locale);

  const [
    analytics,
    publishedNewsCount,
    publishedMatchesCount,
    albumsCount,
    announcementsCount,
    latestNewsList,
    nextMatch
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
        translations: { where: { locale }, select: { title: true } }
      }
    }),
    db.match.findFirst({
      where: { status: "SCHEDULED", matchDate: { gte: new Date() } },
      orderBy: { matchDate: "asc" },
      select: { homeTeamName: true, awayTeamName: true, isHomeFixture: true, stadium: true, matchDate: true }
    })
  ]);

  const latestNews = latestNewsList.map((news) => ({
    id: news.id,
    title: news.translations[0]?.title || "خبر النادي",
    publishedAt: news.publishedAt || news.createdAt,
    category: news.category
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
      <header className="border-b border-border/70 pb-4">
        <h1 className="text-xl font-extrabold text-foreground">{locale === "ar" ? "إحصائيات الموقع" : "Statistiques du site"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{locale === "ar" ? "تحليل الزيارات والتفاعل مع صفحات الموقع العام." : "Analyse des visites et de l’engagement sur le site public."}</p>
      </header>
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
