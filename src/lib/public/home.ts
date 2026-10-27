import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { getPublicClubSettings, PublicClubSettings } from "./club";
import { getPublicMatches, getPublicUpcomingMatches, PublicMatchItem } from "./matches";
import { getPublicNewsList, PublicNewsItem } from "./news";

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

async function loadPublicHomeSupportingData() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [scheduledTrainings, totalActivePlayers, clubMedia] = await Promise.all([
    db.trainingSession.findMany({
      where: { date: { gte: today }, status: "SCHEDULED" },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        location: true,
        notes: true,
        team: { select: { category: true, name: true } }
      },
      orderBy: { date: "asc" },
      take: 6
    }),
    db.player.count({ where: { status: "ACTIVE" } }),
    db.media.findMany({
      where: { album: { published: true } },
      select: {
        id: true,
        url: true,
        caption: true,
        album: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 8
    })
  ]);
  return { scheduledTrainings, totalActivePlayers, clubMedia };
}

export const getPublicHomeSupportingData = unstable_cache(
  loadPublicHomeSupportingData,
  ["public-home-supporting-data-v1"],
  { revalidate: 15, tags: ["public-home"] }
);

async function loadPublicHomeData(locale: string): Promise<PublicHomeData> {
  const now = new Date();

  const [club, upcomingMatches, recentResults, newsResult, rawAnnouncements] = await Promise.all([
    getPublicClubSettings(),
    getPublicUpcomingMatches(6),
    getPublicMatches({ mode: "RESULTS", limit: 3 }),
    getPublicNewsList(locale, { pageSize: 4 }),
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
          where: { locale: { in: [locale, "ar", "fr"] } },
          select: { locale: true, title: true, content: true }
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
    const trans = a.translations.find((item) => item.locale === locale)
      ?? a.translations.find((item) => item.locale === "ar")
      ?? a.translations[0];
    // Arabic is the primary site language; do not treat Arabic script itself
    // as a reason to hide an announcement. Only omit administrative notices.
    if (trans && !isInternalAdministrative(trans.title) && !isInternalAdministrative(trans.content)) {
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
    // The next fixture is the first item in the same live/upcoming list. Reuse
    // it instead of issuing a second match query on every cache refresh.
    nextMatch: upcomingMatches[0] ?? null,
    upcomingMatches,
    recentResults,
    latestNews: newsResult.items,
    announcements
  };
}

// The homepage is public and shared by all visitors. Cache its verified public
// data briefly to reduce repeated database round trips without hiding live edits
// for more than a few seconds.
export const getPublicHomeData = unstable_cache(
  loadPublicHomeData,
  ["public-home-data-v1"],
  { revalidate: 15, tags: ["public-home"] }
);
