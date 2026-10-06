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
  Bell
} from "lucide-react";
import { getPublicHomeData } from "@/lib/public/home";
import { db } from "@/lib/db";
import {
  UpcomingMatchesCarousel,
  UpcomingTrainingsCarousel
} from "@/components/public/upcoming-events-carousel";
import { ClubPhotosCarousel } from "@/components/public/club-photos-carousel";
import { frenchPublicText } from "@/lib/public/locale-text";

export default async function HomePage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isRtl = locale === "ar";
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
          select: { name: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 8
    })
  ]);
  const { nextMatch, upcomingMatches, recentResults, latestNews, announcements } = homeData;

  const matchesForCarousel = upcomingMatches && upcomingMatches.length > 0
    ? upcomingMatches
    : (nextMatch ? [nextMatch] : []);

  const trainingsForCarousel = scheduledTrainings.map((session) => ({
    id: session.id,
    teamCategory: session.team?.category ?? "SENIOR",
    teamName: locale === "ar"
      ? (session.team?.name ?? "أمل سيدي حسني")
      : frenchPublicText(session.team?.name, "ESH Sidi Hosni"),
    date: session.date,
    startTime: new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Africa/Algiers"
    }).format(session.startTime),
    endTime: session.endTime
      ? new Intl.DateTimeFormat(locale, {
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
    <div className="space-y-10 pb-16 bg-background">
      {/* 1. CINEMATIC FULL-BLEED HERO */}
      <section className="relative overflow-hidden bg-[#0C0D0E] text-white border-b border-border/40 min-h-[480px] sm:min-h-[540px] flex items-center">
        {/* Official Custom Club Header Banner with Floodlights & Badge */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-75 scale-100 transition-all duration-700"
          style={{ backgroundImage: `url('${homeData.club.homepageHeroImageUrl || "/branding/esh-header-stadium.png"}')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0C0D0E] via-[#0C0D0E]/60 to-black/30 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(220,38,38,0.22),transparent_70%)] pointer-events-none" />

        <div className="relative mx-auto max-w-7xl w-full px-4 py-16 sm:px-6 sm:py-24">
          <div className="max-w-2xl text-start space-y-4">
            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.15] font-display">
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
                className="inline-flex items-center gap-2.5 rounded-lg bg-club-primary px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-club-primary-hover transition-all"
              >
                <span>{tPublic("home.latestNews")}</span>
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
      <div className="mx-auto max-w-7xl px-4 space-y-10 sm:px-6">
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

        {/* 4. ROW 1: LATEST NEWS + SQUAD CATEGORIES */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
          {/* Card 1: Latest News (lg:col-span-6) */}
          <div className="lg:col-span-6 flex flex-col justify-between rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
            <div>
              <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
                <div className="flex items-center gap-2 text-foreground font-bold text-sm">
                  <Newspaper className="h-4 w-4 shrink-0 text-club-primary" />
                  <span>{tPublic("home.latestNews")}</span>
                </div>
                <Link
                  href={`/${locale}/news`}
                  className="text-xs font-semibold text-muted-foreground hover:text-club-primary transition-colors flex items-center gap-1"
                >
                  <span>{locale === "ar" ? "جميع الأخبار" : "Toutes"}</span>
                  <Arrow className="h-3 w-3" />
                </Link>
              </div>

              {latestNews.length > 0 ? (
                <div className="space-y-3">
                  {latestNews.slice(0, 3).map((item) => (
                    <Link
                      key={item.id}
                      href={`/${locale}/news/${item.slug}`}
                      className="group flex items-start gap-3 rounded-xl p-2 transition-colors hover:bg-muted/50"
                    >
                      <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-muted border border-border">
                        {item.featuredImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.featuredImageUrl}
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
                        <div className="flex items-center gap-2 mb-1">
                          <span className="rounded bg-club-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-club-primary">
                            {item.category || (locale === "ar" ? "النادي" : "Club")}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(
                              item.publishedAt
                            )}
                          </span>
                        </div>
                        <h4 className="line-clamp-2 text-xs font-bold text-foreground group-hover:text-club-primary transition-colors">
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
          </div>

          {/* Card 2: Team Sections (lg:col-span-6) */}
          <div className="lg:col-span-6 flex flex-col justify-between rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
            <div>
              <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
                <div className="flex items-center gap-2 text-foreground font-bold text-sm">
                  <Layers className="h-4 w-4 shrink-0 text-club-primary" />
                  <span>{tPublic("home.ourTeams")}</span>
                </div>
                <Link
                  href={`/${locale}/team`}
                  className="text-xs font-semibold text-muted-foreground hover:text-club-primary transition-colors flex items-center gap-1"
                >
                  <span>{tNav("team")}</span>
                  <Arrow className="h-3 w-3" />
                </Link>
              </div>

              {/* 2x2 Grid of Team Cards */}
              <div className="grid grid-cols-2 gap-3">
                {teamSections.map((sec) => (
                  <Link
                    key={sec.id}
                    href={sec.href}
                    className="group relative overflow-hidden rounded-xl border border-border/80 bg-zinc-950 shadow-2xs transition-all hover:-translate-y-1 hover:border-club-primary/60 hover:shadow-md block"
                  >
                    <div className="relative aspect-[507/249] w-full overflow-hidden rounded-xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={sec.image}
                        alt={tCategories(sec.category)}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2.5">
                        <div className="flex items-center justify-between w-full text-white text-xs font-bold">
                          <span>{tCategories(sec.category)}</span>
                          <Chevron className="h-3.5 w-3.5 text-white" />
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-border/60 mt-4 text-center">
              <span className="text-[11px] text-muted-foreground">
                {locale === "ar" ? "أكاديمية تكوين المواهب الشابة" : "Académie de formation des jeunes"}
              </span>
            </div>
          </div>
        </section>

        {/* 4. ROW 2: ABOUT CLUB + PHOTO GALLERY + RECENT RESULTS (Concept Image 2) */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
          {/* Card 1: About Club (lg:col-span-4) */}
          <div className="lg:col-span-4 rounded-2xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                <BookOpen className="h-4 w-4 text-club-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  {tPublic("home.aboutClub")}
                </h3>
              </div>

              {/* Club Emblem Feature */}
              <div className="relative rounded-xl overflow-hidden bg-gradient-to-r from-club-secondary via-zinc-900 to-black p-4 text-white border border-border/40 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/branding/esh-logo-128.png" alt={locale === "ar" ? "أمل سيدي حسني" : "ESH"} className="h-14 w-14 object-contain shrink-0" />
                <div>
                  <h4 className="text-sm font-extrabold">{locale === "ar" ? "أمل سيدي حسني" : "ESH SIDI HOSNI"}</h4>
                  <p dir={locale === "ar" ? "rtl" : "ltr"} className="text-[11px] text-zinc-400 mt-0.5">
                    {locale === "ar" ? "نادي كرة القدم • تأسس 2018" : "Club de football • Fondé en 2018"}
                  </p>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground">
                  {tPublic("home.aboutCopy")}
              </p>
            </div>

            <div className="pt-4 border-t border-border/60 mt-4">
              <Link
                href={`/${locale}/team`}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground py-2 text-xs font-semibold transition-colors"
              >
                <span>{tPublic("home.discoverTeam")}</span>
                <Arrow className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* Card 2: Interactive Club Photos Carousel (lg:col-span-4) */}
          <div className="lg:col-span-4 flex flex-col justify-between">
            <ClubPhotosCarousel
              photos={clubMedia.map((m) => ({
                id: m.id,
                url: m.url,
                caption: locale === "ar" ? m.caption : frenchPublicText(m.caption, "Photo du club"),
                albumName: locale === "ar" ? m.album?.name : frenchPublicText(m.album?.name, "")
              }))}
              locale={locale}
            />
          </div>

          {/* Card 3: Recent Match Results (lg:col-span-4) */}
          <div className="lg:col-span-4 rounded-2xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
                <div className="flex items-center gap-2 text-foreground font-bold text-sm">
                  <Trophy className="h-4 w-4 text-emerald-600" />
                  <span>{locale === "ar" ? "نتائج المباريات الأخيرة" : "Derniers Résultats"}</span>
                </div>
                <Link
                  href={`/${locale}/matches?status=FINISHED`}
                  className="text-xs font-semibold text-muted-foreground hover:text-club-primary transition-colors flex items-center gap-1"
                >
                  <span>{locale === "ar" ? "جميع النتائج" : "Tous"}</span>
                  <Arrow className="h-3 w-3" />
                </Link>
              </div>

              {recentResults.length > 0 ? (
                <div className="divide-y divide-border/60">
                  {recentResults.slice(0, 3).map((res) => {
                    const eshScore = res.isHomeFixture ? (res.homeScore ?? 0) : (res.awayScore ?? 0);
                    const oppScore = res.isHomeFixture ? (res.awayScore ?? 0) : (res.homeScore ?? 0);
                    const isWin = eshScore > oppScore;
                    const isDraw = eshScore === oppScore;

                    const outcomeTone = isWin
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                      : isDraw
                      ? "bg-muted text-muted-foreground border-border"
                      : "bg-red-500/10 text-red-600 border-red-500/30";

                    const outcomeLabel = isWin
                      ? (locale === "ar" ? "فوز" : "Victoire")
                      : isDraw
                      ? (locale === "ar" ? "تعادل" : "Nul")
                      : (locale === "ar" ? "خسارة" : "Défaite");

                    return (
                      <Link
                        key={res.id}
                        href={`/${locale}/matches/${res.id}`}
                        className="flex items-center justify-between py-3 group hover:bg-muted/30 px-2 rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/branding/esh-logo-32.png" alt="" loading="lazy" decoding="async" className="h-6 w-6 object-contain shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground group-hover:text-club-primary transition-colors truncate">
                              {locale === "ar"
                                ? (res.isHomeFixture ? res.awayTeamName : res.homeTeamName)
                                : frenchPublicText(res.isHomeFixture ? res.awayTeamName : res.homeTeamName, "Adversaire")}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(
                                res.matchDate
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span
                            className="font-mono tabular-nums text-xs font-extrabold text-foreground px-2 py-0.5 rounded-md bg-muted border border-border"
                            dir="ltr"
                          >
                            {res.homeScore ?? 0} - {res.awayScore ?? 0}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${outcomeTone}`}>
                            {outcomeLabel}
                          </span>
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

            <div className="pt-4 border-t border-border/60 mt-4 text-center">
              <span className="text-[11px] text-muted-foreground">
                {locale === "ar" ? "بطولة الرابطة الجهوية لكرة القدم" : "Championnat Ligue Régionale"}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
