import { NextResponse } from "next/server";
import { getPublicClubSettings } from "@/lib/public/club";
import { getPublicHomeData, getPublicHomeSupportingData } from "@/lib/public/home";
import { getPublicAlbums } from "@/lib/public/gallery";
import { getPublicMatches } from "@/lib/public/matches";
import { getPublicNewsList } from "@/lib/public/news";
import { frenchCompetitionName, frenchPublicCategory, frenchPublicText, localizedClubName } from "@/lib/public/locale-text";

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

  const localizedMatch = <T extends {
    homeTeamName: string;
    awayTeamName: string;
    isHomeFixture: boolean;
    competitionName: string;
    teamCategory: string | null;
    stadium: string | null;
  }>(match: T): T => ({
    ...match,
    homeTeamName: match.isHomeFixture
      ? (locale === "ar" ? "نادي أمل سيدي حسني" : "Club Espoir Sidi Hosni")
      : (locale === "fr" ? localizedClubName(match.homeTeamName, locale, "Club adverse") : match.homeTeamName),
    awayTeamName: !match.isHomeFixture
      ? (locale === "ar" ? "نادي أمل سيدي حسني" : "Club Espoir Sidi Hosni")
      : (locale === "fr" ? localizedClubName(match.awayTeamName, locale, "Club adverse") : match.awayTeamName),
    competitionName: locale === "fr" ? frenchCompetitionName(match.competitionName) : match.competitionName,
    teamCategory: match.teamCategory ? (locale === "fr" ? frenchPublicCategory(match.teamCategory) : match.teamCategory) : null,
    stadium: locale === "fr" ? frenchPublicText(match.stadium, "Stade communal Taheri Hosni – Sidi Hosni") : match.stadium
  });

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
    announcements: home.announcements.map((item) => locale === "fr" ? {
      ...item,
      title: frenchPublicText(item.title, "Annonce du club"),
      content: frenchPublicText(item.content, "Consultez les dernières informations du club.")
    } : item),
    nextMatch: home.nextMatch ? localizedMatch(home.nextMatch) : null,
    matches: matches.map(localizedMatch),
    recentResults: results.map(localizedMatch),
    trainings: supporting.scheduledTrainings.map((training) => ({
      id: training.id,
      date: training.date,
      startTime: training.startTime,
      endTime: training.endTime,
      location: locale === "fr" ? frenchPublicText(training.location, "Lieu à confirmer") : training.location,
      teamCategory: training.team?.category ? (locale === "fr" ? frenchPublicCategory(training.team.category) : training.team.category) : "SENIOR",
      teamName: locale === "fr" ? frenchPublicText(training.team?.name, "Équipe du club") : (training.team?.name ?? "الفريق")
    })),
    news: news.items,
    albums: albums.slice(0, 30).map((album) => locale === "fr" ? {
      ...album,
      name: frenchPublicText(album.name, "Album du club"),
      description: album.description ? frenchPublicText(album.description, "Photos du club") : null,
      samplePhotos: album.samplePhotos.map((photo) => ({ ...photo, caption: photo.caption ? frenchPublicText(photo.caption, "Photo du club") : null }))
    } : album),
    reels: club.socialReels.map((reel) => locale === "fr" ? {
      ...reel,
      title: frenchPublicText(reel.title, "Vidéo du club")
    } : reel)
  }, { headers: { "Cache-Control": "no-store" } });
}
