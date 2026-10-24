import { NextResponse } from "next/server";
import { getPublicClubSettings } from "@/lib/public/club";
import { getPublicHomeData, getPublicHomeSupportingData } from "@/lib/public/home";
import { getPublicAlbums } from "@/lib/public/gallery";
import { getPublicMatches } from "@/lib/public/matches";
import { getPublicNewsList } from "@/lib/public/news";
import { frenchPublicText, localizedClubName } from "@/lib/public/locale-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public, read-only mobile feed. Every collection uses the same publication
 * rules as the public website and returns only fields intended for visitors. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") === "fr" ? "fr" : "ar";
  const [club, home, supporting, matches, results, news, albums] = await Promise.all([
    getPublicClubSettings(),
    getPublicHomeData(locale),
    getPublicHomeSupportingData(),
    getPublicMatches({ mode: "UPCOMING", limit: 30 }),
    getPublicMatches({ mode: "RESULTS", limit: 12 }),
    getPublicNewsList(locale, { pageSize: 24 }),
    getPublicAlbums()
  ]);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    locale,
    club: {
      name: localizedClubName(club.name, locale, locale === "ar" ? "الجمعية الرياضية أمل سيدي حسني لكرة القدم" : "Association Sportive Espoir Sidi Hosni de Football"),
      shortName: club.shortName,
      logoUrl: club.logoUrl,
      heroImageUrl: club.homepageHeroImageUrl,
      primaryColor: club.primaryColor,
      secondaryColor: club.secondaryColor,
      description: locale === "fr" ? frenchPublicText(club.description, "Club de football de Sidi Hosni") : club.description,
      stadium: locale === "fr" ? frenchPublicText(club.stadium, "Stade communal Taheri Hosni – Sidi Hosni") : club.stadium
    },
    announcements: home.announcements,
    nextMatch: home.nextMatch,
    matches,
    recentResults: results,
    trainings: supporting.scheduledTrainings.map((training) => ({
      id: training.id,
      date: training.date,
      startTime: training.startTime,
      endTime: training.endTime,
      location: training.location,
      teamCategory: training.team?.category ?? "SENIOR",
      teamName: locale === "fr" ? frenchPublicText(training.team?.name, "Équipe du club") : (training.team?.name ?? "الفريق")
    })),
    news: news.items,
    albums: albums.slice(0, 30),
    reels: club.socialReels
  }, { headers: { "Cache-Control": "no-store" } });
}
