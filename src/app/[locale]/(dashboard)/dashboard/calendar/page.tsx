import { formatAlgeriaTime } from "@/lib/dates/algeria";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { getEffectiveTeamId, getAuthorizedTeams } from "@/lib/team-context";
import { Badge } from "@/components/ui/badge";
import { NoticeToast } from "@/components/shared/notice-toast";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trophy,
  Dumbbell,
  Users,
  Clock,
  MapPin,
  ArrowRight
} from "lucide-react";
import { getMatchDisplayNames } from "@/lib/matches/team-names";

function monthRange(month: string) {
  const [yStr, mStr] = month.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end };
}

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  MATCH: {
    bg: "bg-red-500/10 dark:bg-red-500/15",
    text: "text-red-600 dark:text-red-400",
    border: "border-red-500/25"
  },
  TRAINING: {
    bg: "bg-blue-500/10 dark:bg-blue-500/15",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/25"
  },
  MEETING: {
    bg: "bg-purple-500/10 dark:bg-purple-500/15",
    text: "text-purple-600 dark:text-purple-400",
    border: "border-purple-500/25"
  },
  OTHER: {
    bg: "bg-zinc-500/10 dark:bg-zinc-500/15",
    text: "text-zinc-600 dark:text-zinc-400",
    border: "border-zinc-500/25"
  }
};

const TYPE_ICONS: Record<string, any> = {
  MATCH: Trophy,
  TRAINING: Dumbbell,
  MEETING: Users,
  OTHER: CalendarIcon
};

export default async function CalendarPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ month?: string; team?: string; notice?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const isAr = locale === "ar";
  const user = await requirePagePermission("calendar.view", locale);
  const t = await getTranslations("calendar");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");
  const canManage = hasPermission(user, "calendar.manage");

  const now = new Date();
  const month = sp.month ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const { start, end } = monthRange(month);
  const prevMonth = new Date(start);
  prevMonth.setUTCMonth(prevMonth.getUTCMonth() - 1);
  const nextMonth = new Date(start);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const fmt = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

  const effectiveTeamId = await getEffectiveTeamId(sp.team);

  const [events, teams, matchCount, trainingCount, meetingCount] = await Promise.all([
    db.calendarEvent.findMany({
      where: {
        startDateTime: { gte: start, lt: end },
        ...(effectiveTeamId ? { OR: [{ teamId: effectiveTeamId }, { teamId: null }] } : {})
      },
      include: {
        team: true,
        relatedMatch: { select: { homeTeamName: true, awayTeamName: true, isHomeFixture: true } }
      },
      orderBy: { startDateTime: "asc" }
    }),
    getAuthorizedTeams(),
    db.calendarEvent.count({
      where: {
        startDateTime: { gte: start, lt: end },
        type: "MATCH",
        ...(effectiveTeamId ? { OR: [{ teamId: effectiveTeamId }, { teamId: null }] } : {})
      }
    }),
    db.calendarEvent.count({
      where: {
        startDateTime: { gte: start, lt: end },
        type: "TRAINING",
        ...(effectiveTeamId ? { OR: [{ teamId: effectiveTeamId }, { teamId: null }] } : {})
      }
    }),
    db.calendarEvent.count({
      where: {
        startDateTime: { gte: start, lt: end },
        type: "MEETING",
        ...(effectiveTeamId ? { OR: [{ teamId: effectiveTeamId }, { teamId: null }] } : {})
      }
    })
  ]);

  const grouped = new Map<string, typeof events>();
  for (const e of events) {
    const day = e.startDateTime.toISOString().slice(0, 10);
    grouped.set(day, [...(grouped.get(day) ?? []), e]);
  }

  const ArrowPrev = isAr ? ChevronRight : ChevronLeft;
  const ArrowNext = isAr ? ChevronLeft : ChevronRight;

  return (
    <div className="space-y-6">
      <NoticeToast notice={sp.notice} />
      {/* 1. Header Banner with Club Identity */}
      <div
        className="relative overflow-hidden rounded-2xl border border-border/80 bg-cover bg-center p-6 sm:p-8 text-white shadow-lg"
        style={{ backgroundImage: "url('/branding/esh-header-crest.png')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/80 to-black/55 pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/15 px-3 py-0.5 text-xs font-bold text-red-400 mb-2">
              <CalendarIcon className="h-3.5 w-3.5" />
              <span>{isAr ? "الرزنامة الرياضية والمواعيد الرسمية" : "Calendrier & Planning Club"}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {isAr ? "رزنامة النادي والمباريات والتدريبات" : "Calendrier Officiel ESH"}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-zinc-300 max-w-xl">
              {isAr
                ? "متابعة شاملة لبرمجة مباريات البطولة والكأس، الحصص التدريبية الأسبوعية، والاجتماعات الفنية والإدارية."
                : "Vue centralisée des matchs officiels, séances d'entraînement et réunions techniques."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canManage && (
              <Link
                href={`/${locale}/dashboard/calendar/new`}
                className="group inline-flex min-h-11 items-center gap-2.5 rounded-xl border border-white/20 bg-gradient-to-br from-club-primary to-red-700 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-950/20 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red-950/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 ring-1 ring-inset ring-white/20 transition-transform group-hover:scale-105">
                  <Plus className="h-4 w-4" />
                </span>
                <span>{isAr ? "إضافة موعد جديد" : t("addEvent")}</span>
                <ArrowRight className="h-3.5 w-3.5 opacity-80 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* 2. Monthly Summary Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {isAr ? "إجمالي المواعيد" : "Total Événements"}
            </span>
            <CalendarIcon className="h-4 w-4 text-primary" />
          </div>
          <span className="mt-2 block text-2xl font-black text-foreground font-mono">{events.length}</span>
        </div>

        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
              {isAr ? "المباريات" : "Matchs"}
            </span>
            <Trophy className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
          <span className="mt-2 block text-2xl font-black text-red-700 dark:text-red-300 font-mono">{matchCount}</span>
        </div>

        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              {isAr ? "التدريبات" : "Entraînements"}
            </span>
            <Dumbbell className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <span className="mt-2 block text-2xl font-black text-blue-700 dark:text-blue-300 font-mono">{trainingCount}</span>
        </div>

        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              {isAr ? "الاجتماعات" : "Réunions"}
            </span>
            <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <span className="mt-2 block text-2xl font-black text-purple-700 dark:text-purple-300 font-mono">{meetingCount}</span>
        </div>
      </div>

      {/* 3. Controls Bar: Month Navigation */}
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs">
        {/* Month Pager */}
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/dashboard/calendar?month=${fmt(prevMonth)}`}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background hover:bg-muted transition-colors text-foreground shadow-2xs"
            title={isAr ? "الشهر السابق" : "Mois précédent"}
          >
            <ArrowPrev className="h-4 w-4" />
          </Link>

          <span className="min-w-[160px] text-center text-base font-bold text-foreground capitalize">
            {new Intl.DateTimeFormat(isAr ? "ar-DZ" : "fr-FR", {
              month: "long",
              year: "numeric",
              timeZone: "UTC"
            }).format(start)}
          </span>

          <Link
            href={`/${locale}/dashboard/calendar?month=${fmt(nextMonth)}`}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background hover:bg-muted transition-colors text-foreground shadow-2xs"
            title={isAr ? "الشهر القادم" : "Mois suivant"}
          >
            <ArrowNext className="h-4 w-4" />
          </Link>
        </div>

        <div className="text-xs font-semibold text-muted-foreground">
          <span>{isAr ? "رزنامة النادي الشاملة لكافة الأنشطة" : "Planning global du club"}</span>
        </div>
      </div>

      {/* 4. Timeline Grouped by Day */}
      <div className="space-y-4">
        {[...grouped.entries()].map(([day, dayEvents]) => {
          const dateObj = new Date(day);
          const isToday = new Date().toISOString().slice(0, 10) === day;

          return (
            <div
              key={day}
              className={`rounded-2xl border bg-card p-5 shadow-xs transition-all ${
                isToday ? "border-primary/50 ring-1 ring-primary/20 bg-primary/5" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between border-b border-border/70 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-xs font-black font-mono text-foreground">
                    {dateObj.getUTCDate()}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      {new Intl.DateTimeFormat(isAr ? "ar-DZ" : "fr-FR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        timeZone: "UTC"
                      }).format(dateObj)}
                    </h3>
                  </div>
                </div>

                {isToday && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{isAr ? "اليوم" : "Aujourd'hui"}</span>
                  </span>
                )}
              </div>

              <div className="space-y-2.5">
                {dayEvents.map((e) => {
                  const Icon = TYPE_ICONS[e.type] || CalendarIcon;
                  const colors = TYPE_COLORS[e.type] ?? {
                    bg: "bg-zinc-500/10",
                    text: "text-zinc-600 dark:text-zinc-400",
                    border: "border-zinc-500/25"
                  };
                  const href = e.relatedMatchId
                    ? `/${locale}/dashboard/matches/${e.relatedMatchId}`
                    : e.relatedTrainingId
                      ? `/${locale}/dashboard/training/${e.relatedTrainingId}`
                      : `/${locale}/dashboard/calendar/${e.id}`;
                  const matchNames = e.relatedMatch ? getMatchDisplayNames(e.relatedMatch, locale) : null;
                  const displayTitle = matchNames
                    ? `${matchNames.homeTeamName} ${isAr ? "ضد" : "vs"} ${matchNames.awayTeamName}`
                    : e.title;

                  return (
                    <Link
                      key={e.id}
                      href={href}
                      className={`group flex items-center gap-3 rounded-xl border p-3.5 transition-all hover:-translate-y-px hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:gap-4 ${colors.border} ${colors.bg}`}
                    >
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${colors.border} ${colors.bg} ${colors.text}`}>
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className={`text-[10px] font-bold ${colors.text}`}>{t(`types.${e.type}` as any)}</span>
                          <span className="text-[10px] text-muted-foreground">{e.team ? tTeams(`categories.${e.team.category}` as any) : (isAr ? "لكل النادي" : "Général")}</span>
                        </span>
                        <span className="block truncate text-sm font-bold text-foreground transition-colors group-hover:text-primary">{displayTitle}</span>
                        {e.location && <span className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"><MapPin className="h-3 w-3" />{e.location}</span>}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border/70 bg-background/70 px-2.5 py-2 font-mono text-xs font-bold text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {formatAlgeriaTime(e.startDateTime, locale)}
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:-translate-x-0.5 rtl:rotate-180" aria-hidden="true" />
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {grouped.size === 0 && (
          <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            <CalendarIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="font-bold text-foreground">{isAr ? "لا توجد مواعيد مبرمجة في هذا الشهر" : tCommon("noResults")}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {isAr ? "يمكنك إضافة موعد جديد أو التنقل بين الأشهر" : "Sélectionnez un autre mois ou créez un événement."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
