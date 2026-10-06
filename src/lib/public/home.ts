import "server-only";
import { db } from "@/lib/db";
import { getPublicClubSettings, PublicClubSettings } from "./club";
import { getPublicNextMatch, getPublicMatches, getPublicUpcomingMatches, PublicMatchItem } from "./matches";
import { getPublicNewsList, PublicNewsItem } from "./news";
import { hasArabicScript } from "./locale-text";

// ============================================================================
// PUBLIC HOMEPAGE DATA AGGREGATOR
// ----------------------------------------------------------------------------
// Aggregates verified club data for the public home screen in parallel queries.
// Never exposes unverified or fake placeholder records.
// ============================================================================

export interface PublicAnnouncementItem {
  id: string;
  title: string;
  content: string;
  priority: string;
}

export interface PublicHomeData {
  club: PublicClubSettings;
  nextMatch: PublicMatchItem | null;
  upcomingMatches: PublicMatchItem[];
  recentResults: PublicMatchItem[];
  latestNews: PublicNewsItem[];
  announcements: PublicAnnouncementItem[];
}

export async function getPublicHomeData(locale: string): Promise<PublicHomeData> {
  const now = new Date();

  const [club, nextMatch, upcomingMatches, recentResults, newsResult, rawAnnouncements] = await Promise.all([
    getPublicClubSettings(),
    getPublicNextMatch(),
    getPublicUpcomingMatches(6),
    getPublicMatches({ mode: "RESULTS", limit: 3 }),
    getPublicNewsList(locale, { pageSize: 3 }),
    db.announcement.findMany({
      where: {
        status: "PUBLISHED",
        homepageVisibility: true,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }]
      },
      select: {
        id: true,
        priority: true,
        translations: {
          where: { locale },
          select: { title: true, content: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 3
    })
  ]);

  const announcements: PublicAnnouncementItem[] = [];
  const isInternalAdministrative = (text: string) => {
    const lower = text.toLowerCase();
    return (
      lower.includes("الجمعية العامة") ||
      lower.includes("جمعية عامة") ||
      lower.includes("اجتماع") ||
      lower.includes("محضر") ||
      lower.includes("مجلس إدارة") ||
      lower.includes("assemblée générale") ||
      lower.includes("conseil d'administration") ||
      lower.includes("procès-verbal")
    );
  };

  for (const a of rawAnnouncements) {
    const trans = a.translations[0];
    if (trans && !hasArabicScript(trans.title) && !hasArabicScript(trans.content) && !isInternalAdministrative(trans.title) && !isInternalAdministrative(trans.content)) {
      announcements.push({
        id: a.id,
        title: trans.title,
        content: trans.content,
        priority: String(a.priority)
      });
    }
  }

  return {
    club,
    nextMatch,
    upcomingMatches,
    recentResults,
    latestNews: newsResult.items,
    announcements
  };
}
