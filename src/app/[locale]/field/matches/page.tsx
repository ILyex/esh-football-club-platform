import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { CalendarDays, CalendarClock, CheckCircle2, Clock3, ExternalLink, Flag, Globe2, Layers3, Pencil, Play, Radio, RotateCcw, Save, Trash2, Trophy } from "lucide-react";
import { db } from "@/lib/db";
import { hasPermission, requirePagePermission } from "@/lib/permissions";
import { getMutationScopeContext } from "@/lib/mutation-guards";
import { getMatchDisplayNames } from "@/lib/matches/team-names";
import { OFFICIAL_CATEGORY_NAMES } from "@/lib/competitions/types";
import { FormSelect } from "@/components/ui/form-select";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LogoutButton } from "@/components/shared/logout-button";
import { MatchEventEntryForm } from "../match-event-entry-form";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { updateMatchStatusAction, addMatchEventAction, updateMatchEventAction, deleteMatchEventAction } from "../../(dashboard)/dashboard/matches/actions";

const fieldControl = "h-9 w-full appearance-none rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground outline-none transition focus:border-club-primary focus:ring-2 focus:ring-club-primary/15";

export const metadata: Metadata = {
  title: "إدارة المباريات الميدانية",
  robots: { index: false, follow: false, noarchive: true }
};

function SelectField({ label, name, defaultValue, options, locale }: { label: string; name: string; defaultValue: string; options: Array<{ value: string; label: string }>; locale: string }) {
  return <label className="block min-w-0 text-[10px] font-semibold text-muted-foreground">
    <span className="mb-1 block">{label}</span>
    <FormSelect name={name} defaultValue={defaultValue} options={options} locale={locale} compact triggerClassName="!h-9" />
  </label>;
}

export default async function FieldMatchesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ category?: string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const isAr = locale === "ar";
  const activeLocale = isAr ? "ar" : "fr";
  const user = await requirePagePermission("matches.view", locale);
  const canUpdate = hasPermission(user, "matches.update");
  const canReport = hasPermission(user, "matches.report");
  const scopeContext = await getMutationScopeContext();
  const teams = await db.team.findMany({
    where: scopeContext.isUnrestricted ? undefined : { id: { in: scopeContext.authorizedTeamIds } },
    select: { id: true, category: true },
    orderBy: { category: "asc" }
  });
  const selectedTeam = teams.find((team) => team.category === query.category);
  const selectedCategory = selectedTeam?.category ?? null;
  const matches = await db.match.findMany({
    where: { status: { in: ["SCHEDULED", "LIVE", "FINISHED", "POSTPONED"] }, ...(selectedTeam ? { teamId: selectedTeam.id } : {}) },
    include: { competition: true, events: { orderBy: { minute: "asc" }, select: { id: true, type: true, side: true, minute: true, playerName: true } } },
    orderBy: { matchDate: "desc" },
    take: 20
  });
  const matchTeamIds = [...new Set(matches.map((match) => match.teamId).filter((teamId): teamId is string => Boolean(teamId)))];
  const visibleMatchTeamIds = scopeContext.isUnrestricted
    ? matchTeamIds
    : matchTeamIds.filter((teamId) => scopeContext.authorizedTeamIds.includes(teamId));
  const availablePlayers = await db.player.findMany({
    where: {
      status: "ACTIVE",
      teamId: { in: visibleMatchTeamIds }
    },
    select: { id: true, firstName: true, lastName: true, firstNameFr: true, lastNameFr: true, teamId: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }]
  });
  const playersByTeam = new Map<string, typeof availablePlayers>();
  for (const player of availablePlayers) {
    if (!player.teamId) continue;
    const teamPlayers = playersByTeam.get(player.teamId) ?? [];
    teamPlayers.push(player);
    playersByTeam.set(player.teamId, teamPlayers);
  }

  async function setStatus(matchId: string, formData: FormData) {
    "use server";
    await updateMatchStatusAction(matchId, String(formData.get("status") || ""));
    redirect(`/${locale}/field/matches`);
  }
  async function addEvent(matchId: string, formData: FormData) {
    "use server";
    await addMatchEventAction(matchId, formData);
    redirect(`/${locale}/field/matches`);
  }
  async function editEvent(matchId: string, eventId: string, formData: FormData) {
    "use server";
    await updateMatchEventAction(matchId, eventId, formData);
    redirect(`/${locale}/field/matches`);
  }
  async function deleteEvent(matchId: string, eventId: string) {
    "use server";
    await deleteMatchEventAction(matchId, eventId);
  }

  return <main className="min-h-screen bg-muted/30 px-3 py-4 text-foreground sm:px-6 sm:py-6" dir={isAr ? "rtl" : "ltr"}>
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <header className="relative rounded-2xl border border-border bg-card shadow-xs">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-px top-px h-1 rounded-t-[calc(1rem-1px)] bg-club-primary" />
        <div className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-club-primary/10 text-club-primary"><Radio className="h-5 w-5" /></span>
              <div className="min-w-0"><p className="text-[10px] font-bold tracking-wide text-club-primary">{isAr ? "إدارة ميدانية" : "GESTION TERRAIN"}</p><h1 className="mt-0.5 text-lg font-black leading-tight">{isAr ? "المباريات" : "Matchs"}</h1><p className="mt-0.5 text-[10px] text-muted-foreground">{isAr ? "إدارة النتائج وأحداث المباريات مباشرة" : "Gérez les scores et événements en direct"}</p></div>
            </div>
            <div className="flex w-full flex-nowrap items-center justify-between gap-1.5 sm:w-auto sm:justify-start sm:flex-wrap sm:gap-2">
              <span title={isAr ? "متصل" : "En ligne"} aria-label={isAr ? "متصل" : "En ligne"} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 sm:h-9 sm:w-auto sm:gap-1.5 sm:px-2.5 sm:text-[10px] sm:font-bold"><CheckCircle2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">{isAr ? "متصل" : "En ligne"}</span></span>
              <Link href={`/${locale}`} aria-label={isAr ? "الموقع العام" : "Site public"} title={isAr ? "الموقع العام" : "Site public"} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:border-club-primary hover:text-foreground sm:h-9 sm:w-auto sm:gap-1.5 sm:px-2.5 sm:text-[10px] sm:font-semibold"><ExternalLink className="h-3.5 w-3.5" /><span className="hidden sm:inline">{isAr ? "الموقع" : "Site"}</span></Link>
              <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                <ThemeToggle locale={locale} className="[&_button]:h-7 [&_button]:w-7 [&_button]:px-1 [&_button]:py-1 sm:[&_button]:h-8 sm:[&_button]:w-8" />
                <div className="flex h-8 items-center gap-0.5 rounded-lg border border-border bg-background p-0.5 sm:h-9 sm:gap-1 sm:p-1" aria-label={isAr ? "تغيير اللغة" : "Changer de langue"}>
                  <Globe2 className="mx-1 h-3.5 w-3.5 text-muted-foreground" />
                  {(["ar", "fr"] as const).map((targetLocale) => <Link key={targetLocale} href={`/${targetLocale}/field/matches${selectedCategory ? `?category=${selectedCategory}` : ""}`} lang={targetLocale} aria-current={activeLocale === targetLocale ? "page" : undefined} className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[9px] font-bold transition sm:min-w-8 sm:px-2 sm:text-[10px] ${activeLocale === targetLocale ? "bg-club-primary text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{targetLocale.toUpperCase()}</Link>)}
                </div>
              </div>
              <LogoutButton locale={locale} variant="icon" className="!order-last !h-8 !w-8 !shrink-0 !rounded-lg !border-destructive/40 !bg-destructive/10 !p-0 !text-destructive hover:!border-destructive hover:!bg-destructive hover:!text-white sm:hidden" />
              <LogoutButton locale={locale} variant="icon" className="hidden !h-9 !w-9 !shrink-0 !rounded-lg !border-destructive/40 !bg-destructive/10 !p-0 !text-destructive hover:!border-destructive hover:!bg-destructive hover:!text-white sm:inline-flex" />
            </div>
          </div>
          <div className="mt-4 grid gap-3 border-t border-border/70 pt-3 sm:grid-cols-2 sm:items-stretch">
            <form method="get" aria-label={isAr ? "تصفية المباريات حسب الفئة" : "Filtrer les matchs par catégorie"} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-2.5 rounded-xl border border-border/70 bg-muted/20 p-2.5 sm:max-w-none">
              <label className="min-w-0 text-[10px] font-bold text-muted-foreground">
                <span className="mb-1.5 flex items-center gap-1.5"><span className="flex h-5 w-5 items-center justify-center rounded-md bg-club-primary/10 text-club-primary"><Layers3 className="h-3 w-3" aria-hidden="true" /></span>{isAr ? "الفئة" : "Catégorie"}</span>
                <FormSelect name="category" defaultValue={selectedCategory ?? "ALL"} locale={locale} compact ariaLabel={isAr ? "اختيار فئة الفريق" : "Choisir une catégorie"} triggerClassName="!h-9 !rounded-lg !text-xs !font-semibold" options={[{ value: "ALL", label: isAr ? "كل الفئات" : "Toutes les catégories" }, ...teams.map((team) => ({ value: team.category, label: OFFICIAL_CATEGORY_NAMES[team.category][activeLocale] }))]} />
              </label>
              <button type="submit" className="inline-flex !h-9 !min-h-9 items-center justify-center gap-1.5 rounded-lg bg-club-primary px-3 !py-0 text-[10px] font-bold leading-none text-white shadow-sm transition hover:-translate-y-px hover:bg-club-primary-hover">{isAr ? "تطبيق" : "Appliquer"}</button>
            </form>
            <div className="grid w-full min-w-0 grid-cols-3 gap-1.5 sm:gap-2">
              <div className="flex min-h-10 flex-col justify-center rounded-lg bg-muted/40 px-2 py-1 sm:min-h-[68px] sm:px-3 sm:py-2"><p className="truncate text-[8px] leading-3 text-muted-foreground sm:text-[10px] sm:leading-4">{isAr ? "المعروضة" : "Affichés"}</p><p className="text-xs font-extrabold leading-4 tabular-nums sm:text-base sm:leading-5">{matches.length}</p></div>
              <div className="flex min-h-10 flex-col justify-center rounded-lg bg-rose-500/[0.045] px-2 py-1 sm:min-h-[68px] sm:px-3 sm:py-2"><p className="truncate text-[8px] leading-3 text-muted-foreground sm:text-[10px] sm:leading-4">{isAr ? "مباشرة" : "En direct"}</p><p className="text-xs font-extrabold leading-4 tabular-nums text-rose-500 sm:text-base sm:leading-5">{matches.filter((match) => match.status === "LIVE").length}</p></div>
              <div className="flex min-h-10 flex-col justify-center rounded-lg bg-amber-500/[0.045] px-2 py-1 sm:min-h-[68px] sm:px-3 sm:py-2"><p className="truncate text-[8px] leading-3 text-muted-foreground sm:text-[10px] sm:leading-4">{isAr ? "المؤجلة" : "Reportés"}</p><p className="text-xs font-extrabold leading-4 tabular-nums text-amber-600 dark:text-amber-400 sm:text-base sm:leading-5">{matches.filter((match) => match.status === "POSTPONED").length}</p></div>
            </div>
          </div>
        </div>
      </header>

      {matches.length === 0 ? <section className="rounded-2xl border border-border bg-card px-4 py-10 text-center"><span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground"><CalendarDays className="h-4 w-4" /></span><p className="mt-3 text-sm font-bold">{isAr ? "لا توجد مباريات لعرضها" : "Aucun match à afficher"}</p><p className="mt-1 text-xs text-muted-foreground">{isAr ? "ستظهر هنا المباريات القادمة والمباشرة والمنتهية حديثاً." : "Les matchs à venir, en direct et récemment terminés apparaîtront ici."}</p></section> : <div className="space-y-3">{matches.map((match) => {
        const names = getMatchDisplayNames(match, locale);
        const isLive = match.status === "LIVE";
        const isFinished = match.status === "FINISHED";
        const isPostponed = match.status === "POSTPONED";
        const homeSide = match.isHomeFixture ? "HOME" : "AWAY";
        const statusActions = isLive
          ? [
              { status: "FINISHED", label: isAr ? "إنهاء المباراة" : "Terminer le match", icon: Flag, primary: true },
              { status: "POSTPONED", label: isAr ? "تأجيل المباراة" : "Reporter le match", icon: CalendarClock, primary: false }
            ]
          : isPostponed
            ? [{ status: "SCHEDULED", label: isAr ? "إعادة المباراة إلى الجدول" : "Remettre au calendrier", icon: CalendarDays, primary: true }]
            : isFinished
              ? [{ status: "LIVE", label: isAr ? "إعادة فتح المباراة" : "Rouvrir le match", icon: RotateCcw, primary: false }]
              : [
                  { status: "LIVE", label: isAr ? "بدء المباراة" : "Démarrer le match", icon: Play, primary: true },
                  { status: "POSTPONED", label: isAr ? "تأجيل المباراة" : "Reporter le match", icon: CalendarClock, primary: false }
                ];
        return <article key={match.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-colors hover:border-club-primary/30">
          <div className={`h-0.5 ${isLive ? "bg-rose-500" : isFinished ? "bg-emerald-500" : isPostponed ? "bg-amber-500" : "bg-border"}`} />
          <div className="p-3.5 sm:p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1 font-semibold text-club-primary"><Trophy className="h-3 w-3" />{match.competition.name}</span>
                  <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(match.matchDate)}</span>
                </div>
                <div className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                  <h2 className="min-w-0 truncate text-end text-sm font-extrabold leading-snug sm:text-base">{names.homeTeamName}</h2>
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="inline-flex items-center rounded-lg border border-border bg-background px-3 py-1"><span className="font-mono text-xl font-extrabold tabular-nums tracking-wider">{match.homeScore ?? 0}<span className="px-1.5 text-muted-foreground">:</span>{match.awayScore ?? 0}</span></div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${isLive ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : isFinished ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : isPostponed ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground"}`}>{isLive ? <Radio className="h-2.5 w-2.5" /> : <Clock3 className="h-2.5 w-2.5" />}{isLive ? (isAr ? "مباشرة" : "En direct") : isFinished ? (isAr ? "منتهية" : "Terminée") : isPostponed ? (isAr ? "مؤجلة" : "Reportée") : (isAr ? "قادمة" : "À venir")}</span>
                  </div>
                  <h2 className="min-w-0 truncate text-start text-sm font-extrabold leading-snug sm:text-base">{names.awayTeamName}</h2>
                </div>
              </div>

              {canUpdate && <div className="flex flex-wrap items-center justify-center gap-2 border-t border-border/70 pt-3 md:justify-end md:border-0 md:pt-0">
                {statusActions.map(({ status, label, icon: ActionIcon, primary }) => <form key={status} action={setStatus.bind(null, match.id)}><input type="hidden" name="status" value={status} /><button type="submit" aria-label={label} className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-[11px] font-bold transition hover:-translate-y-px ${primary ? status === "FINISHED" ? "border-rose-600 bg-rose-600 text-white shadow-sm hover:bg-rose-700" : "border-club-primary bg-club-primary text-white shadow-sm hover:bg-club-primary-hover" : "border-border bg-background text-muted-foreground hover:border-club-primary hover:text-foreground"}`}><ActionIcon aria-hidden="true" className="size-3 shrink-0" strokeWidth={1.8} />{label}</button></form>)}
              </div>}
            </div>

            {match.events.length > 0 && <div className="mt-3 space-y-2 border-t border-border/70 pt-2.5">
              <p className="text-[10px] font-bold text-muted-foreground">{isAr ? "أحداث المباراة" : "Événements du match"}</p>
              {match.events.map((event) => <details key={event.id} className="group relative rounded-lg border border-border/80 bg-background">
                <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 pe-14 ps-2.5 text-[11px] font-semibold marker:hidden">
                  <span className="flex min-w-0 items-center gap-2"><span className={event.type === "RED_CARD" ? "text-rose-500" : event.type === "YELLOW_CARD" ? "text-amber-500" : "text-emerald-600 dark:text-emerald-400"}>{event.type === "GOAL" || event.type === "PENALTY_GOAL" || event.type === "OWN_GOAL" ? "⚽" : event.type === "RED_CARD" ? "🟥" : event.type === "YELLOW_CARD" ? "🟨" : "•"}</span><span className="shrink-0 font-mono tabular-nums">{event.minute}{"'"}</span><span className="truncate">{event.playerName || (isAr ? "بدون اسم" : "Sans nom")}</span><span className="hidden text-[10px] font-normal text-muted-foreground sm:inline">{event.side === "HOME" ? names.homeTeamName : names.awayTeamName}</span></span>
                  {canReport && <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-club-primary"><Pencil className="h-3 w-3" />{isAr ? "تعديل" : "Modifier"}</span>}
                </summary>
                {canReport && <div className="absolute end-1.5 top-0.5">
                  <ConfirmDialog
                    onConfirm={deleteEvent.bind(null, match.id, event.id)}
                    title={isAr ? "حذف الحدث؟" : "Supprimer l’événement ?"}
                    body={isAr ? "سيُحذف الحدث، وستُحدّث النتيجة تلقائياً إذا كان هدفاً." : "L’événement sera supprimé. Le score sera ajusté automatiquement s’il s’agit d’un but."}
                    successMessage={isAr ? "تم حذف الحدث" : "Événement supprimé"}
                    errorMessage={isAr ? "تعذر حذف الحدث" : "Impossible de supprimer l’événement"}
                  >
                    <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-destructive transition hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40" aria-label={isAr ? "حذف الحدث" : "Supprimer l’événement"} title={isAr ? "حذف الحدث" : "Supprimer l’événement"}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </ConfirmDialog>
                </div>}
                {canReport && <form action={editEvent.bind(null, match.id, event.id)} className="grid grid-cols-2 gap-2 border-t border-border/70 p-2 sm:grid-cols-[1fr_1fr_72px_minmax(100px,1.3fr)_auto] sm:items-end">
                  <SelectField locale={locale} label={isAr ? "نوع الحدث" : "Type"} name="type" defaultValue={event.type} options={[{ value: "GOAL", label: isAr ? "هدف" : "But" }, { value: "PENALTY_GOAL", label: isAr ? "هدف جزاء" : "Penalty" }, { value: "PENALTY_MISSED", label: isAr ? "جزاء ضائع" : "Penalty manqué" }, { value: "OWN_GOAL", label: isAr ? "هدف عكسي" : "But contre son camp" }, { value: "YELLOW_CARD", label: isAr ? "بطاقة صفراء" : "Carton jaune" }, { value: "RED_CARD", label: isAr ? "بطاقة حمراء" : "Carton rouge" }, { value: "ASSIST", label: isAr ? "تمريرة حاسمة" : "Passe décisive" }, { value: "SUBSTITUTION_IN", label: isAr ? "دخول لاعب" : "Entrée" }, { value: "SUBSTITUTION_OUT", label: isAr ? "خروج لاعب" : "Sortie" }]} />
                  <SelectField locale={locale} label={isAr ? "الفريق" : "Équipe"} name="side" defaultValue={event.side} options={[{ value: "HOME", label: names.homeTeamName }, { value: "AWAY", label: names.awayTeamName }]} />
                  <label className="block text-[10px] font-semibold text-muted-foreground"><span className="mb-1 block">{isAr ? "الدقيقة" : "Minute"}</span><input name="minute" type="number" min="0" max="130" defaultValue={event.minute} className={`${fieldControl} px-2 text-center`} /></label>
                  <label className="col-span-2 block min-w-0 text-[10px] font-semibold text-muted-foreground sm:col-span-1"><span className="mb-1 block">{isAr ? "اسم اللاعب" : "Joueur"}</span><input name="playerName" required maxLength={120} defaultValue={event.playerName ?? ""} className={`${fieldControl} placeholder:font-normal`} /></label>
                  <button type="submit" className="col-span-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-club-primary px-3 text-[10px] font-bold text-white transition hover:bg-club-primary-hover sm:col-span-1"><Save className="h-3.5 w-3.5" />{isAr ? "حفظ" : "Enregistrer"}</button>
                </form>}
              </details>)}
            </div>}

            {canReport && isLive && <MatchEventEntryForm
              action={addEvent.bind(null, match.id)}
              locale={locale}
              homeTeamName={names.homeTeamName}
              awayTeamName={names.awayTeamName}
              defaultSide={homeSide}
              clubSide={match.isHomeFixture ? "HOME" : "AWAY"}
              players={match.teamId ? playersByTeam.get(match.teamId) ?? [] : []}
            />}
          </div>
        </article>;
      })}</div>}
      <p className="px-1 text-center text-[10px] text-muted-foreground">{isAr ? "تُحفظ التحديثات في قاعدة المنصة وتظهر على الموقع العام." : "Les modifications sont enregistrées et publiées sur le site."}</p>
    </div>
  </main>;
}
