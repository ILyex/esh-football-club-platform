import { formatAlgeriaTime } from "@/lib/dates/algeria";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ArrowRight,
  ArrowLeft,
  Trophy,
  Calendar,
  Users,
  Newspaper,
  Layers,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Bell,
  Shield
} from "lucide-react";
import { getPublicHomeData, getPublicHomeSupportingData } from "@/lib/public/home";
import { localizedClubName } from "@/lib/public/locale-text";
import {
  UpcomingMatchesCarousel,
  UpcomingTrainingsCarousel
} from "@/components/public/upcoming-events-carousel";
import { ClubPhotosCarousel } from "@/components/public/club-photos-carousel";
import { frenchPublicText } from "@/lib/public/locale-text";
import { isVideoUrl } from "@/lib/media-utils";
import { CategoryCardVideo } from "@/components/public/category-card-video";
import { SocialReelsSection } from "@/components/public/social-reels-section";
import { SafeImage } from "@/components/shared/safe-image";
import { ClubIntroVideo } from "@/components/public/club-intro-video";
import { OpponentCrest } from "@/components/public/opponent-crest";
import { getAnnouncementPriorityStyle } from "@/lib/announcement-priority-style";

export const dynamic = "force-dynamic";

export default async function HomePage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isRtl = locale === "ar";
  // Always pass a canonical BCP-47 locale to Intl. This also keeps a malformed
  // URL segment from crashing the public page while the route guard resolves.
  const intlLocale = isRtl ? "ar-DZ" : "fr-FR";
  const Arrow = isRtl ? ArrowLeft : ArrowRight;
  const Chevron = isRtl ? ChevronLeft : ChevronRight;

  const tNav = await getTranslations({ locale, namespace: "nav" });
  const tPublic = await getTranslations({ locale, namespace: "publicSite" });
  const tCategories = await getTranslations({ locale, namespace: "teams.categories" });

  const [homeData, supportingData] = await Promise.all([
    getPublicHomeData(locale),
    getPublicHomeSupportingData()
  ]);
  const { scheduledTrainings, totalActivePlayers, clubMedia } = supportingData;
  const { nextMatch, upcomingMatches, recentResults, latestNews, announcements } = homeData;

  const matchesForCarousel = upcomingMatches && upcomingMatches.length > 0
    ? upcomingMatches
    : nextMatch
      ? [nextMatch]
      : (recentResults.find((match) => match.status === "FINISHED")
        ? [recentResults.find((match) => match.status === "FINISHED")!]
        : []);

  const trainingsForCarousel = scheduledTrainings.map((session) => ({
    id: session.id,
    teamCategory: session.team?.category ?? "SENIOR",
    teamName: locale === "ar"
      ? (session.team?.name ?? "الجمعية الرياضية أمل سيدي حسني لكرة القدم")
      : frenchPublicText(session.team?.name, "Association Sportive Espoir Sidi Hosni de Football"),
    date: session.date,
    startTime: formatAlgeriaTime(session.startTime, locale),
    endTime: session.endTime
      ? formatAlgeriaTime(session.endTime, locale)
      : null,
    location: locale === "ar"
      ? (session.location || "الملعب البلدي طاهري حسني – سيدي حسني")
      : frenchPublicText(session.location, "Stade communal Taheri Hosni – Sidi Hosni"),
    notes: session.notes
  }));

  const teamSections = [
    {
      id: "senior",
      category: "SENIOR",
      href: `/${locale}/team/senior`,
      poster: homeData.club.websiteImages.teamSenior && !isVideoUrl(homeData.club.websiteImages.teamSenior) ? homeData.club.websiteImages.teamSenior : "/branding/teams/category-senior-card.webp",
      video: isVideoUrl(homeData.club.websiteImages.teamSenior) ? homeData.club.websiteImages.teamSenior! : "/branding/teams/category-senior.mp4",
      fallback: "/branding/teams/category-senior-card.webp",
    },
    {
      id: "u20",
      category: "U20",
      href: `/${locale}/team/u20`,
      poster: homeData.club.websiteImages.teamU20 && !isVideoUrl(homeData.club.websiteImages.teamU20) ? homeData.club.websiteImages.teamU20 : "/branding/teams/category-u20-card.webp",
      video: isVideoUrl(homeData.club.websiteImages.teamU20) ? homeData.club.websiteImages.teamU20! : "/branding/teams/category-u20.mp4",
      fallback: "/branding/teams/category-u20-card.webp",
    },
    {
      id: "u17",
      category: "U17",
      href: `/${locale}/team/u17`,
      poster: homeData.club.websiteImages.teamU17 && !isVideoUrl(homeData.club.websiteImages.teamU17) ? homeData.club.websiteImages.teamU17 : "/branding/teams/category-u17-card.webp",
      video: isVideoUrl(homeData.club.websiteImages.teamU17) ? homeData.club.websiteImages.teamU17! : "/branding/teams/category-u17.mp4",
      fallback: "/branding/teams/category-u17-card.webp",
    },
    {
      id: "u15",
      category: "U15",
      href: `/${locale}/team/u15`,
      poster: homeData.club.websiteImages.teamU15 && !isVideoUrl(homeData.club.websiteImages.teamU15) ? homeData.club.websiteImages.teamU15 : "/branding/teams/category-u15-card.webp",
      video: isVideoUrl(homeData.club.websiteImages.teamU15) ? homeData.club.websiteImages.teamU15! : "/branding/teams/category-u15.mp4",
      fallback: "/branding/teams/category-u15-card.webp",
    }
  ];

  return (
    <div className="space-y-10 pb-6 sm:pb-10 bg-background">
      {/* 1. CINEMATIC FULL-BLEED HERO */}
      <section className="public-home-hero relative overflow-hidden text-white border-b border-border/40 min-h-[420px] sm:min-h-[540px] flex items-center">
        {/* Official Custom Club Header Banner with Floodlights & Badge */}
        {isVideoUrl(homeData.club.homepageHeroImageUrl) ? (
          <video
            key={homeData.club.homepageHeroImageUrl}
            src={homeData.club.homepageHeroImageUrl ?? undefined}
            autoPlay
            loop
            muted
            playsInline
            controls={false}
            preload="metadata"
            poster="/branding/esh-header-stadium.png"
            aria-hidden="true"
            tabIndex={-1}
            className="absolute inset-0 h-full w-full scale-100 object-cover opacity-75 transition-opacity duration-500 motion-reduce:transition-none"
          />
        ) : (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-75"
            style={{ backgroundImage: `url('${homeData.club.homepageHeroImageUrl || "/branding/esh-header-stadium.png"}')` }}
            aria-hidden="true"
          />
        )}
        <div className="public-home-hero-scrim absolute inset-0 pointer-events-none" />
        <div className="public-home-hero-glow absolute inset-0 pointer-events-none" />

        <div className="relative mx-auto max-w-7xl w-full px-4 py-12 sm:px-6 sm:py-24">
          <div className="max-w-2xl text-start space-y-4">
            {/* Main Headline */}
              <h1 className="text-3xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.15] font-display">
              {tPublic("home.heroTitle")}
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-zinc-300 font-normal leading-relaxed max-w-xl">
              {tPublic("home.heroSubtitle")}
            </p>

            {/* Hero CTAs */}
            <div className="pt-4 flex flex-wrap items-center gap-3">
              <Link
                href={`/${locale}/news`}
                className="inline-flex max-w-full items-center gap-2.5 rounded-lg bg-club-primary px-4 py-3 text-sm font-bold text-white shadow-md transition-colors duration-150 hover:bg-club-primary-hover motion-reduce:transition-none sm:px-6"
              >
                <span className="line-clamp-1 max-w-[min(56vw,18rem)] sm:max-w-[22rem]" title={latestNews[0]?.title || tPublic("home.latestNews")}>
                  {latestNews[0]?.title || tPublic("home.latestNews")}
                </span>
                <Arrow className="h-4 w-4" />
              </Link>
              <Link
                href={`/${locale}/competitions?type=LEAGUE&category=SENIOR`}
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-white/20 motion-reduce:transition-none"
              >
                <Calendar className="h-4 w-4 text-zinc-300" />
                <span>{locale === "ar" ? "ترتيب الدوري" : "Classement du championnat"}</span>
              </Link>
              <Link
                href={`/${locale}/team`}
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition-[color,background-color,border-color] duration-150 hover:bg-white/20 hover:border-club-primary/50 motion-reduce:transition-none"
              >
                <Users className="h-4 w-4 text-zinc-300" />
                <span>{tPublic("home.ourTeams")}</span>
              </Link>
            </div>

            {/* Quick Hero Numbers Strip */}
            <div className="pt-8 border-t border-white/10 grid grid-cols-3 gap-4 max-w-lg">
              <div>
                <span className="block font-mono text-2xl sm:text-3xl font-black text-white tabular-nums">
                  {totalActivePlayers}
                </span>
                <span className="text-[11px] text-zinc-400 font-medium">
                  {tPublic("home.activePlayers")}
                </span>
              </div>
              <div>
                <span className="block font-mono text-2xl sm:text-3xl font-black text-white tabular-nums">
                  4
                </span>
                <span className="text-[11px] text-zinc-400 font-medium">
                  {tPublic("home.teamCategories")}
                </span>
              </div>
              <div>
                <span className="block font-mono text-2xl sm:text-3xl font-black text-white tabular-nums">
                  2018
                </span>
                <span className="text-[11px] text-zinc-400 font-medium">
                  {tPublic("home.founded")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 sm:px-6 lg:block lg:space-y-10">
        {/* 2. OFFICIAL ANNOUNCEMENTS STRIP (If Active) */}
        {announcements.length > 0 && (
          <section className="space-y-3">
            {announcements.map((item) => (
              <div
                key={item.id}
                className={`flex items-start gap-3 rounded-xl border p-4 text-foreground shadow-2xs ${getAnnouncementPriorityStyle(item.priority).card}`}
              >
                <Bell className={`mt-0.5 h-5 w-5 shrink-0 ${getAnnouncementPriorityStyle(item.priority).icon}`} />
                <div className="flex-1">
                  <h3 className="text-sm font-bold">{item.title}</h3>
                  <p className="mt-0.5 text-xs leading-relaxed opacity-90">{item.content}</p>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* 3. UPCOMING MATCHES & UPCOMING TRAININGS */}
        <section className="space-y-8">
          <UpcomingMatchesCarousel matches={matchesForCarousel} locale={locale} clubLogoUrl={homeData.club.logoUrl} />
          <UpcomingTrainingsCarousel trainings={trainingsForCarousel} locale={locale} />
        </section>

        {homeData.club.socialReels.length > 0 && (
          <SocialReelsSection reels={homeData.club.socialReels} locale={locale} compact />
        )}

        {/* 4. ROW 1: LATEST NEWS + SQUAD CATEGORIES */}
        <section className="contents lg:grid lg:grid-cols-12 lg:items-stretch lg:gap-6">
          {/* Card 1: Latest News (lg:col-span-6) */}
          <div className="order-20 flex flex-col justify-between rounded-2xl border border-border bg-card p-3 shadow-xs sm:p-6 lg:order-none lg:col-span-6">
            <div>
              <div className="mb-2.5 flex items-center justify-between border-b border-border/60 pb-2.5 sm:mb-4 sm:pb-3">
                <div className="flex items-center gap-2 text-foreground font-bold text-sm">
                  <Newspaper className="h-4 w-4 shrink-0 text-club-primary" />
                  <span>{locale === "ar" ? "آخر الأخبار" : "Dernières actualités"}</span>
                </div>
              </div>

              {latestNews.length > 0 ? (
                <div className="space-y-2.5">
                  {latestNews.slice(0, 4).map((item) => (
                    <Link
                      key={item.id}
                      href={`/${locale}/news/${encodeURIComponent(item.id)}`}
                      className="group flex min-w-0 items-center gap-2.5 rounded-xl border border-border/70 bg-background/45 p-2 transition-[border-color,background-color,box-shadow] hover:border-club-primary/40 hover:bg-club-primary/[0.035] hover:shadow-sm motion-reduce:transition-none sm:gap-3 sm:p-2.5"
                    >
                      <div className="relative h-14 w-16 shrink-0 overflow-hidden rounded-lg border border-border/70 bg-muted sm:h-[72px] sm:w-[88px] sm:rounded-xl">
                        {item.featuredImageUrl ? (
                          <SafeImage
                            src={item.featuredImageUrl}
                            fallbackSrc="/branding/esh-logo-128.png"
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-muted/60 text-muted-foreground">
                            <Newspaper className="h-5 w-5" />
                          </div>
                        )}
                        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/[0.04]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex min-w-0 items-center gap-1.5 sm:mb-1.5 sm:gap-2">
                          <span className="max-w-[7rem] truncate rounded-md border border-club-primary/20 bg-club-primary/10 px-2 py-0.5 text-[10px] font-extrabold text-club-primary sm:text-[11px]">
                            {item.category || (locale === "ar" ? "النادي" : "Club")}
                          </span>
                          <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-muted-foreground sm:text-[11px]">
                            <Calendar className="h-3 w-3 opacity-75" aria-hidden="true" />
                            {new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "short" }).format(
                              item.publishedAt
                            )}
                          </span>
                        </div>
                        <h4 className="line-clamp-2 text-xs font-extrabold leading-relaxed text-foreground transition-colors group-hover:text-club-primary sm:text-sm sm:leading-snug">
                          {item.title}
                        </h4>
                      </div>
                      <span aria-hidden="true" className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground transition-[color,border-color,background-color,transform] group-hover:translate-x-0.5 group-hover:border-club-primary/30 group-hover:bg-club-primary/10 group-hover:text-club-primary sm:flex">
                        <Arrow className="h-3.5 w-3.5" />
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <p>{locale === "ar" ? "لا توجد أخبار جديدة" : "Aucune actualité"}</p>
                </div>
              )}
            </div>
            <div className="mt-4 flex min-h-[58px] items-center border-t border-border/60 pt-4">
              <Link href={`/${locale}/news`} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-club-primary/20 bg-club-primary/10 py-2 text-xs font-bold text-foreground transition-colors hover:bg-club-primary hover:text-white motion-reduce:transition-none">
                <span>{locale === "ar" ? "جميع الأخبار" : "Toutes les actualités"}</span>
                <Arrow className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* Card 2: Team Sections (lg:col-span-6) */}
          <div className="order-60 flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6 lg:order-none lg:col-span-6">
            <div>
              <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
                <div className="flex items-center gap-2 text-foreground font-bold text-sm">
                  <Layers className="h-4 w-4 shrink-0 text-club-primary" />
                  <span>{tPublic("home.ourTeams")}</span>
                </div>
              </div>

              {/* 2x2 Grid of Team Cards */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                {teamSections.map((sec) => (
                  <Link
                    key={sec.id}
                    href={sec.href}
                    className="group relative block overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xs transition-[border-color,box-shadow] duration-150 hover:border-club-primary/60 hover:shadow-md motion-reduce:transition-none"
                  >
                    <div className="relative aspect-[507/249] w-full overflow-hidden">
                      <CategoryCardVideo
                        src={sec.video}
                        poster={sec.poster}
                        fallback={sec.fallback}
                        alt={tCategories(sec.category)}
                        className="transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/90 via-black/40 to-black/15 p-2.5 opacity-100 transition-opacity motion-reduce:transition-none sm:opacity-0 sm:group-hover:opacity-100">
                        <div className="flex items-center justify-between w-full text-white text-xs font-bold">
                          <span className="sm:hidden">{sec.category}</span>
                          <span className="hidden sm:inline">{tCategories(sec.category)}</span>
                          <Chevron className="h-3.5 w-3.5 text-white" />
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-4 border-t border-border/60 pt-4">
              <p className="mb-3 text-center text-[11px] text-muted-foreground">
                {locale === "ar" ? "أكاديمية تكوين المواهب الشابة" : "Académie de formation des jeunes"}
              </p>
              <Link href={`/${locale}/team`} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-club-primary/20 bg-club-primary/10 py-2 text-xs font-bold text-foreground transition-colors hover:bg-club-primary hover:text-white motion-reduce:transition-none">
                <span>{tNav("team")}</span>
                <Arrow className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </section>

        {/* 4. ROW 2: ABOUT CLUB + PHOTO GALLERY + RECENT RESULTS (Concept Image 2) */}
        <section className="contents lg:grid lg:grid-cols-12 lg:items-stretch lg:gap-6">
          {/* Card 1: About Club (lg:col-span-4) */}
          <div className="order-50 flex h-full flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-sm lg:order-none lg:col-span-4 lg:min-h-[348px] lg:p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-club-primary/10">
                    <BookOpen className="h-4 w-4 text-club-primary" />
                  </span>
                  <h3 className="text-sm font-bold text-foreground">
                  {locale === "ar" ? "عن الجمعية" : "À propos de l’association"}
                  </h3>
                </div>
              </div>

              <ClubIntroVideo
                label={locale === "ar" ? "الشعار المتحرك للجمعية الرياضية أمل سيدي حسني لكرة القدم" : "Logo animé de l’Association Sportive Espoir Sidi Hosni de Football"}
                poster={homeData.club.websiteImages.introPoster && !isVideoUrl(homeData.club.websiteImages.introPoster) ? homeData.club.websiteImages.introPoster : "/branding/esh-intro-poster.jpg"}
                videoSrc={isVideoUrl(homeData.club.websiteImages.introPoster) ? homeData.club.websiteImages.introPoster : undefined}
              />

              <p className="line-clamp-4 text-xs leading-6 text-muted-foreground sm:text-[13px]">
                  {tPublic("home.aboutCopy")}
              </p>
            </div>

            <div className="mt-5 flex min-h-[58px] items-center border-t border-border/60 pt-4">
              <Link
                href={`/${locale}/club`}
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-club-primary/20 bg-club-primary/10 py-2 text-xs font-bold text-foreground transition-colors hover:bg-club-primary hover:text-white motion-reduce:transition-none"
              >
                <span>{locale === "ar" ? "تعرف على الجمعية" : "Découvrir l’association"}</span>
              </Link>
            </div>
          </div>

          {/* Card 2: Interactive Club Photos Carousel (lg:col-span-4) */}
          <div className="order-30 flex h-full flex-col justify-between lg:order-none lg:min-h-[348px] lg:col-span-4">
            <ClubPhotosCarousel
              photos={clubMedia.map((m) => ({
                id: m.id,
                albumId: m.album?.id,
                url: m.url,
                caption: locale === "ar" ? m.caption : frenchPublicText(m.caption, "Photo du club"),
                albumName: locale === "ar" ? m.album?.name : frenchPublicText(m.album?.name, "")
              }))}
              locale={locale}
            />
          </div>

          {/* Card 3: Recent Match Results (lg:col-span-4) */}
          <div className="order-40 flex h-full flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-xs lg:order-none lg:min-h-[348px] lg:col-span-4">
            <div>
              <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
                <div className="flex items-center gap-2 text-foreground font-bold text-sm">
                  <Trophy className="h-4 w-4 text-emerald-600" />
                  <span>{locale === "ar" ? "نتائج المباريات الأخيرة" : "Derniers Résultats"}</span>
                </div>
              </div>

              {recentResults.length > 0 ? (
                <div className="space-y-1.5">
                  {recentResults.slice(0, 3).map((res) => {
                    const clubScore = res.isHomeFixture ? (res.homeScore ?? 0) : (res.awayScore ?? 0);
                    const opponentScore = res.isHomeFixture ? (res.awayScore ?? 0) : (res.homeScore ?? 0);
                    const clubWon = res.winnerSide ? res.winnerSide === (res.isHomeFixture ? "HOME" : "AWAY") : clubScore > opponentScore;
                    const isDraw = clubScore === opponentScore && !res.winnerSide;
                    const resultTone = isDraw
                      ? "border-border/70 bg-background/35"
                      : clubWon
                        ? "border-club-primary/50 bg-club-primary/[0.08]"
                        : "border-red-500/30 bg-red-500/[0.04]";
                    return (
                      <Link key={res.id} href={`/${locale}/matches/${res.id}`} className={`group block rounded-lg border px-2 py-2 transition-[background-color,border-color] duration-150 hover:border-club-primary/60 hover:bg-muted/30 motion-reduce:transition-none ${resultTone}`}>
                        <div dir={locale === "ar" ? "rtl" : "ltr"} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
                          <div dir={locale === "ar" ? "rtl" : "ltr"} className="flex min-w-0 items-center justify-start gap-1.5 text-start">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center p-0.5">
                              {res.isHomeFixture ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src="/branding/esh-logo-32.png" alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" />
                              ) : res.opponentLogo ? (
                                <OpponentCrest src={res.opponentLogo} className="h-full w-full object-contain" />
                              ) : <Shield className="h-5 w-5 text-muted-foreground" aria-hidden="true" />}
                            </div>
                            <span dir={locale === "ar" ? "rtl" : "ltr"} className="line-clamp-2 min-w-0 text-[11px] font-bold leading-tight text-foreground">{localizedClubName(res.homeTeamName, locale, locale === "ar" ? "الفريق المضيف" : "Équipe locale")}</span>
                          </div>
                          <div className="col-span-1 flex min-w-[58px] flex-col items-center justify-self-center gap-0.5">
                            <span dir={locale === "ar" ? "rtl" : "ltr"} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-xs font-black tabular-nums text-foreground"><span>{res.homeScore ?? 0}</span><span>-</span><span>{res.awayScore ?? 0}</span></span>
                          </div>
                          <div dir={locale === "ar" ? "ltr" : "rtl"} className="flex min-w-0 items-center justify-start gap-1.5 text-start">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center p-0.5">
                              {!res.isHomeFixture ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src="/branding/esh-logo-32.png" alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" />
                              ) : res.opponentLogo ? (
                                <OpponentCrest src={res.opponentLogo} className="h-full w-full object-contain" />
                              ) : <Shield className="h-5 w-5 text-muted-foreground" aria-hidden="true" />}
                            </div>
                            <span dir={locale === "ar" ? "rtl" : "ltr"} className="line-clamp-2 min-w-0 text-[11px] font-bold leading-tight text-foreground">{localizedClubName(res.awayTeamName, locale, locale === "ar" ? "الفريق الضيف" : "Équipe visiteuse")}</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <p>{tPublic("home.noRecentResults")}</p>
                </div>
              )}
            </div>

            <div className="mt-4 flex min-h-[58px] items-center border-t border-border/60 pt-4">
              <Link href={`/${locale}/matches?status=FINISHED`} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-club-primary/20 bg-club-primary/10 py-2 text-xs font-bold text-foreground transition-colors hover:bg-club-primary hover:text-white motion-reduce:transition-none">
                <span>{locale === "ar" ? "جميع النتائج" : "Tous les résultats"}</span>
                <Arrow className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
