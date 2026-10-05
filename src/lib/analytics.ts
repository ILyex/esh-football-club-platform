import "server-only";
import { db } from "@/lib/db";

export interface PageStat {
  path: string;
  views: number;
  clicks: number;
}

export interface DayTraffic {
  date: string;
  visitors: number;
  pageViews: number;
  clicks: number;
}

export interface WebsiteAnalyticsData {
  totalVisitors: number;
  totalPageViews: number;
  totalClicks: number;
  activeNow: number;
  dailyTraffic: DayTraffic[];
  topPages: PageStat[];
  deviceBreakdown: { device: string; visits: number; percentage: number }[];
  referrerBreakdown: { source: string; visits: number }[];
  hasData: boolean;
}

/** Return aggregates exclusively from recorded public-site events. */
export async function getWebsiteAnalytics(): Promise<WebsiteAnalyticsData> {
  const now = new Date();
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 13);
  from.setUTCHours(0, 0, 0, 0);
  const activeSince = new Date(now.getTime() - 5 * 60 * 1000);

  const [dailyRows, totals, activeNow, pageRows, deviceRows, sourceRows] = await Promise.all([
    db.$queryRaw<Array<{ date: Date; visitors: bigint; pageViews: bigint; clicks: bigint }>>`
      SELECT date_trunc('day', "createdAt") AS date,
        COUNT(DISTINCT "visitorKey") FILTER (WHERE type = 'PAGE_VIEW') AS visitors,
        COUNT(*) FILTER (WHERE type = 'PAGE_VIEW') AS "pageViews",
        COUNT(*) FILTER (WHERE type = 'CLICK') AS clicks
      FROM "WebsiteAnalyticsEvent"
      WHERE "createdAt" >= ${from}
      GROUP BY date_trunc('day', "createdAt")
      ORDER BY date_trunc('day', "createdAt") ASC
    `,
    db.$queryRaw<Array<{ visitors: bigint; pageViews: bigint; clicks: bigint }>>`
      SELECT COUNT(DISTINCT "visitorKey") FILTER (WHERE type = 'PAGE_VIEW') AS visitors,
        COUNT(*) FILTER (WHERE type = 'PAGE_VIEW') AS "pageViews",
        COUNT(*) FILTER (WHERE type = 'CLICK') AS clicks
      FROM "WebsiteAnalyticsEvent" WHERE "createdAt" >= ${from}
    `,
    db.websiteAnalyticsEvent.findMany({
      where: { type: "PAGE_VIEW", createdAt: { gte: activeSince } },
      distinct: ["visitorKey"],
      select: { visitorKey: true }
    }),
    db.$queryRaw<Array<{ path: string; views: bigint; clicks: bigint }>>`
      SELECT path,
        COUNT(*) FILTER (WHERE type = 'PAGE_VIEW') AS views,
        COUNT(*) FILTER (WHERE type = 'CLICK') AS clicks
      FROM "WebsiteAnalyticsEvent" WHERE "createdAt" >= ${from}
      GROUP BY path ORDER BY views DESC LIMIT 8
    `,
    db.$queryRaw<Array<{ device: string; visits: bigint }>>`
      SELECT device, COUNT(*) AS visits FROM "WebsiteAnalyticsEvent"
      WHERE type = 'PAGE_VIEW' AND "createdAt" >= ${from}
      GROUP BY device ORDER BY visits DESC
    `,
    db.$queryRaw<Array<{ source: string; visits: bigint }>>`
      SELECT source, COUNT(*) AS visits FROM "WebsiteAnalyticsEvent"
      WHERE type = 'PAGE_VIEW' AND "createdAt" >= ${from}
      GROUP BY source ORDER BY visits DESC LIMIT 8
    `
  ]);

  const totalVisitors = Number(totals[0]?.visitors ?? 0n);
  const totalPageViews = Number(totals[0]?.pageViews ?? 0n);
  const totalClicks = Number(totals[0]?.clicks ?? 0n);
  const days = new Map(dailyRows.map((row) => [row.date.toISOString().slice(0, 10), row]));
  const dailyTraffic: DayTraffic[] = [];
  for (let offset = 0; offset < 14; offset += 1) {
    const date = new Date(from);
    date.setUTCDate(date.getUTCDate() + offset);
    const key = date.toISOString().slice(0, 10);
    const row = days.get(key);
    dailyTraffic.push({
      date: key,
      visitors: Number(row?.visitors ?? 0n),
      pageViews: Number(row?.pageViews ?? 0n),
      clicks: Number(row?.clicks ?? 0n)
    });
  }

  return {
    totalVisitors,
    totalPageViews,
    totalClicks,
    activeNow: activeNow.length,
    dailyTraffic,
    topPages: pageRows.map((row) => ({ path: row.path, views: Number(row.views), clicks: Number(row.clicks) })),
    deviceBreakdown: deviceRows.map((row) => {
      const visits = Number(row.visits);
      return {
        device: row.device,
        visits,
        percentage: totalPageViews === 0 ? 0 : Math.round((visits / totalPageViews) * 100)
      };
    }),
    referrerBreakdown: sourceRows.map((row) => ({ source: row.source, visits: Number(row.visits) })),
    hasData: totalPageViews > 0 || totalClicks > 0
  };
}
