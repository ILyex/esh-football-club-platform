import { Activity, Calendar, ClipboardList, Trophy } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { getEffectiveTeamId, getAuthorizedTeams } from "@/lib/team-context";
import { DashboardTeamCategorySelect } from "@/components/shared/dashboard-team-category-select";
import { NoticeToast } from "@/components/shared/notice-toast";
import { CalendarBoard, type CalendarBoardEvent } from "@/components/calendar/calendar-board";
import { getMatchDisplayNames } from "@/lib/matches/team-names";
import { findOpponentLogo, getOpponentsMap } from "@/lib/opponents";

function validMonth(value: string | undefined, now: Date) {
  if (value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value;
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function CalendarPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ month?: string; day?: string; team?: string; notice?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const isAr = locale === "ar";
  const user = await requirePagePermission("calendar.view", locale);
  const canManage = hasPermission(user, "calendar.manage");
  const t = await getTranslations("calendar");
  const tTeams = await getTranslations("teams");
  const effectiveTeamId = await getEffectiveTeamId(sp.team);
  const month = validMonth(sp.month, new Date());
  const [year = new Date().getUTCFullYear(), monthNumber = new Date().getUTCMonth() + 1] = month.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, monthNumber - 1, 1));
  const weekStart = isAr ? 0 : 1;
  const gridStart = new Date(monthStart);
  gridStart.setUTCDate(1 - ((monthStart.getUTCDay() - weekStart + 7) % 7));
  const gridEnd = new Date(gridStart);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + 42);
  const [events, teams, opponentLogos] = await Promise.all([
    db.calendarEvent.findMany({
      where: {
        startDateTime: { gte: gridStart, lt: gridEnd },
        ...(effectiveTeamId ? { OR: [{ teamId: effectiveTeamId }, { teamId: null }] } : {})
      },
      include: {
        team: { select: { category: true } },
        relatedMatch: { select: { homeTeamName: true, awayTeamName: true, isHomeFixture: true } }
      },
      orderBy: { startDateTime: "asc" },
      take: 300
    }),
    getAuthorizedTeams(),
    getOpponentsMap()
  ]);

  const boardEvents: CalendarBoardEvent[] = events.map((event) => {
    const names = event.relatedMatch ? getMatchDisplayNames(event.relatedMatch, locale) : null;
    const opponentName = event.relatedMatch
      ? (event.relatedMatch.isHomeFixture ? event.relatedMatch.awayTeamName : event.relatedMatch.homeTeamName)
      : null;
    return {
      id: event.id,
      type: event.type,
      title: names ? `${names.homeTeamName} ${isAr ? "ضد" : "vs"} ${names.awayTeamName}` : event.title,
      opponentName,
      opponentLogo: opponentName ? findOpponentLogo(opponentLogos, opponentName) : null,
      isHomeFixture: event.relatedMatch?.isHomeFixture ?? null,
      startDateTime: event.startDateTime.toISOString(),
      location: event.location,
      team: event.team ? tTeams(`categories.${event.team.category}` as any) : null,
      href: event.relatedMatchId
        ? `/${locale}/dashboard/matches/${event.relatedMatchId}`
        : event.relatedTrainingId
          ? `/${locale}/dashboard/training/${event.relatedTrainingId}`
          : `/${locale}/dashboard/calendar/${event.id}`
    };
  });
  const today = new Date();
  const todayKey = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;
  const day = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : month === todayKey.slice(0, 7) ? todayKey : monthStart.toISOString().slice(0, 10);
  const counts = [
    { label: isAr ? "كل المواعيد" : "Événements", count: events.length, icon: Calendar, tone: "text-foreground" },
    { label: isAr ? "المباريات" : "Matchs", count: events.filter((event) => event.type === "MATCH").length, icon: Trophy, tone: "text-rose-500" },
    { label: isAr ? "التدريبات" : "Entraînements", count: events.filter((event) => event.type === "TRAINING").length, icon: Activity, tone: "text-sky-500" },
    { label: isAr ? "الاجتماعات" : "Réunions", count: events.filter((event) => event.type === "MEETING").length, icon: ClipboardList, tone: "text-violet-500" }
  ];

  return <div className="space-y-5">
    <NoticeToast notice={sp.notice} />
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-club-primary/10 text-club-primary"><CalendarDays className="h-6 w-6" /></span>
        <div>
          <p className="text-xs font-bold text-club-primary">{isAr ? "رزنامة النادي" : "CALENDRIER DU CLUB"}</p>
          <h1 className="mt-0.5 text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">{isAr ? "كل المواعيد القادمة" : "Tous les rendez-vous à venir"}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{isAr ? "المباريات والتدريبات والاجتماعات والمواعيد الإدارية في مكان واحد." : "Matchs, entraînements, réunions et rendez-vous administratifs au même endroit."}</p>
        </div>
      </div>
      <form className="min-w-[190px]">
        <DashboardTeamCategorySelect value={sp.team ?? effectiveTeamId ?? "ALL"} options={teams.map((team) => ({ id: team.id, label: tTeams(`categories.${team.category}` as any) }))} allLabel={tTeams("allTeams")} locale={locale} />
      </form>
    </header>

    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {counts.map(({ label, count, icon: Icon, tone }) => <div key={label} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <span className={`grid h-9 w-9 place-items-center rounded-xl bg-muted/60 ${tone}`}><Icon className="h-4 w-4" /></span>
        <span><span className="block text-lg font-extrabold leading-5 text-foreground">{count}</span><span className="text-[10px] font-medium text-muted-foreground">{label}</span></span>
      </div>)}
    </div>

    <CalendarBoard locale={locale} month={month} day={day} events={boardEvents} canManage={canManage} addEventHref={`/${locale}/dashboard/calendar/new`} />
    {events.length === 0 && <p className="text-center text-xs text-muted-foreground">{t("empty")}</p>}
  </div>;
}
