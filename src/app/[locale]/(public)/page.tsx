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
import { getPublicHomeData } from "@/lib/public/home";
import { localizedClubName } from "@/lib/public/locale-text";
import { db } from "@/lib/db";
import {
  UpcomingMatchesCarousel,
  UpcomingTrainingsCarousel
} from "@/components/public/upcoming-events-carousel";
import { ClubPhotosCarousel } from "@/components/public/club-photos-carousel";
import { frenchPublicText } from "@/lib/public/locale-text";
import { SocialReelsSection } from "@/components/public/social-reels-section";
import { SafeImage } from "@/components/shared/safe-image";
import { ClubLogo } from "@/components/shared/club-logo";

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

  const [homeData, scheduledTrainings, totalActivePlayers, clubMedia] = await Promise.all([
    getPublicHomeData(locale),
    db.trainingSession.findMany({
      where: {
        date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        status: "SCHEDULED"
      },
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
      where: {
        album: { published: true }
      },
      select: {
        id: true,
        url: true,
        caption: true,
        album: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 8
    })
  ]);
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
    startTime: new Intl.DateTimeFormat(intlLocale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Africa/Algiers"
    }).format(session.startTime),
    endTime: session.endTime
      ? new Intl.DateTimeFormat(intlLocale, {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "Africa/Algiers"
        }).format(session.endTime)
      : null,
    location: locale === "ar"
      ? (session.location || "الملعب البلدي سيدي حسني")
      : frenchPublicText(session.location, "Stade Municipal Sidi Hosni"),
    notes: session.notes
  }));

  const teamSections = [
    {
      id: "senior",
      category: "SENIOR",
      href: `/${locale}/team/senior`,
      image: "/branding/teams/team-senior.png",
    },
    {
      id: "u20",
      category: "U20",
      href: `/${locale}/team/u20`,
      image: "/branding/teams/team-u20.png",
    },
    {
      id: "u17",
      category: "U17",
      href: `/${locale}/team/u17`,
      image: "/branding/teams/team-u17.png",
    },
    {
      id: "u15",
      category: "U15",
      href: `/${locale}/team/u15`,
      image: "/branding/teams/team-u15.png",
    }
  ];

  return (
    <div className="space-y-10 pb-6 sm:pb-10 bg-background">
      {/* 1. CINEMATIC FULL-BLEED HERO */}
      <section className="relative overflow-hidden bg-[#0C0D0E] text-white border-b border-border/40 min-h-[420px] sm:min-h-[540px] flex items-center">
        {/* Official Custom Club Header Banner with Floodlights & Badge */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-75 scale-100 transition-all duration-700"
          style={{ backgroundImage: `url('${homeData.club.homepageHeroImageUrl || "/branding/esh-header-stadium.png"}')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0C0D0E] via-[#0C0D0E]/60 to-black/30 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(220,38,38,0.22),transparent_70%)] pointer-events-none" />

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
                className="inline-flex max-w-full items-center gap-2.5 rounded-lg bg-club-primary px-4 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-club-primary-hover sm:px-6"
              >
                <span className="line-clamp-1 max-w-[min(56vw,18rem)] sm:max-w-[22rem]" title={latestNews[0]?.title || tPublic("home.latestNews")}>
                  {latestNews[0]?.title || tPublic("home.latestNews")}
                </span>
                <Arrow className="h-4 w-4" />
              </Link>
              <Link
                href={`/${locale}/matches`}
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur-xs hover:bg-white/20 transition-all"
              >
                <Calendar className="h-4 w-4 text-zinc-300" />
                <span>{tPublic("home.upcomingMatches")}</span>
              </Link>
              <Link
                href={`/${locale}/team`}
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur-xs hover:bg-white/20 hover:border-club-primary/50 transition-all"
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
                className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200 shadow-2xs"
              >
                <Bell className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
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
          <UpcomingMatchesCarousel matches={matchesForCarousel} locale={locale} />
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
                <div className="space-y-3">
                  {latestNews.slice(0, 4).map((item) => (
                    <Link
                      key={item.id}
                      href={`/${locale}/news/${encodeURIComponent(item.id)}`}
                      className="group flex min-w-0 items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-muted/50 sm:gap-3 sm:rounded-xl sm:p-2"
                    >
                      <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted sm:h-16 sm:w-20 sm:rounded-lg">
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
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex min-w-0 items-center gap-1.5 sm:mb-1 sm:gap-2">
                          <span className="max-w-[7rem] truncate rounded bg-club-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-club-primary sm:text-[10px]">
                            {item.category || (locale === "ar" ? "النادي" : "Club")}
                          </span>
                          <span className="shrink-0 text-[9px] text-muted-foreground sm:text-[10px]">
                            {new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "short" }).format(
                              item.publishedAt
                            )}
                          </span>
                        </div>
                        <h4 className="line-clamp-2 text-[11px] font-bold leading-snug text-foreground transition-colors group-hover:text-club-primary sm:text-xs">
                          {item.title}
                        </h4>
                      </div>
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
              <Link href={`/${locale}/news`} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-club-primary/20 bg-club-primary/10 py-2 text-[11px] font-bold text-club-primary transition-colors hover:bg-club-primary hover:text-white">
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
                    className="group relative overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xs transition-all hover:-translate-y-1 hover:border-club-primary/60 hover:shadow-md block"
                  >
                    <div className="relative aspect-[507/249] w-full overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={sec.image}
                        alt={tCategories(sec.category)}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/75 via-black/10 to-transparent p-2.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
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
              <Link href={`/${locale}/team`} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-club-primary/20 bg-club-primary/10 py-2 text-[11px] font-bold text-club-primary transition-colors hover:bg-club-primary hover:text-white">
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

              {/* Club Emblem Feature */}
              <div dir={locale === "ar" ? "rtl" : "ltr"} className="relative flex min-h-[108px] items-center gap-3 overflow-hidden rounded-xl border border-white/10 p-3 text-white shadow-inner sm:min-h-[116px] sm:p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/branding/about-club-header.png"
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/20 to-black/40" />
                <ClubLogo src="/branding/esh-logo-128.png" fallbackSrc="/branding/esh-logo-128.png" alt={locale === "ar" ? "الجمعية الرياضية أمل سيدي حسني لكرة القدم" : "Association Sportive Espoir Sidi Hosni de Football"} className="relative z-10 h-14 w-14 shrink-0 object-contain drop-shadow-md sm:h-16 sm:w-16" />
                <div className="relative z-10 min-w-0 flex-1">
                  <h4 className="club-name line-clamp-2 text-xs font-extrabold leading-5 text-white sm:text-sm">{locale === "ar" ? "الجمعية الرياضية أمل سيدي حسني لكرة القدم" : "Association Sportive Espoir Sidi Hosni de Football"}</h4>
                  <p dir="ltr" className="mt-2 inline-flex rounded-md bg-black/55 px-2 py-1 text-[10px] font-semibold tracking-wide text-white sm:text-[11px]">
                    ESH • 2018 — ∞
                  </p>
                </div>
              </div>

              <p className="line-clamp-4 text-xs leading-6 text-muted-foreground sm:text-[13px]">
                  {tPublic("home.aboutCopy")}
              </p>
            </div>

            <div className="mt-5 flex min-h-[58px] items-center border-t border-border/60 pt-4">
              <Link
                href={`/${locale}/club`}
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-club-primary/20 bg-club-primary/10 py-2 text-xs font-bold text-club-primary transition-colors hover:bg-club-primary hover:text-white"
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
                <div className="divide-y divide-border/60">
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
                      <Link key={res.id} href={`/${locale}/matches/${res.id}`} className={`group block rounded-lg border px-2 py-2 transition-all hover:border-club-primary/60 hover:bg-muted/30 ${resultTone}`}>
                        <div dir={locale === "ar" ? "rtl" : "ltr"} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
                          <div dir={locale === "ar" ? "rtl" : "ltr"} className="flex min-w-0 items-center justify-start gap-1.5 text-start">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-club-primary/20 bg-club-primary/10 p-1">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={res.isHomeFixture ? "/branding/esh-logo-32.png" : (res.opponentLogo || "/branding/esh-logo-32.png")} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" />
                            </div>
                            <span dir={locale === "ar" ? "rtl" : "ltr"} className="line-clamp-1 min-w-0 text-[9px] font-bold text-foreground">{localizedClubName(res.homeTeamName, locale, locale === "ar" ? "الفريق المضيف" : "Équipe locale")}</span>
                          </div>
                          <div className="col-span-1 flex min-w-[58px] flex-col items-center justify-self-center gap-0.5">
                            <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-xs font-black tabular-nums text-foreground" dir="ltr">{res.homeScore ?? 0} - {res.awayScore ?? 0}</span>
                          </div>
                          <div dir={locale === "ar" ? "ltr" : "rtl"} className="flex min-w-0 items-center justify-start gap-1.5 text-start">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-card p-1">
                              {res.isHomeFixture && res.opponentLogo ? <img src={res.opponentLogo} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" /> : !res.isHomeFixture ? <img src="/branding/esh-logo-32.png" alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" /> : <Shield className="h-5 w-5 text-muted-foreground" aria-hidden="true" />}
                            </div>
                            <span dir={locale === "ar" ? "rtl" : "ltr"} className="line-clamp-1 min-w-0 text-[9px] font-bold text-foreground">{localizedClubName(res.awayTeamName, locale, locale === "ar" ? "الفريق الضيف" : "Équipe visiteuse")}</span>
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
              <Link href={`/${locale}/matches?status=FINISHED`} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-club-primary/20 bg-club-primary/10 py-2 text-[11px] font-bold text-club-primary transition-colors hover:bg-club-primary hover:text-white">
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
