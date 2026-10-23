"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Home, MapPin, Plane } from "lucide-react";
import { OpponentCrest } from "@/components/public/opponent-crest";

export type CalendarBoardEvent = {
  id: string;
  type: string;
  title: string;
  startDateTime: string;
  location: string | null;
  team: string | null;
  href: string;
  opponentName?: string | null;
  opponentLogo?: string | null;
  isHomeFixture?: boolean | null;
};

type ViewMode = "month" | "week" | "day";

function toKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function fromKey(key: string) {
  const [year = 2000, month = 1, day = 1] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function shift(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function typeName(type: string, locale: string) {
  const values: Record<string, [string, string]> = {
    MATCH: ["مباراة", "Match"], TRAINING: ["تدريب", "Entraînement"],
    MEETING: ["اجتماع", "Réunion"], OTHER: ["موعد", "Rendez-vous"]
  };
  return (values[type] ?? ["موعد", "Rendez-vous"])[locale === "ar" ? 0 : 1];
}

function typeColor(type: string) {
  if (type === "MATCH") return "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300";
  if (type === "TRAINING") return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  if (type === "MEETING") return "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
}

export function CalendarBoard({
  locale, month, day, events, addEventHref, canManage
}: {
  locale: string;
  month: string;
  day: string;
  events: CalendarBoardEvent[];
  addEventHref: string;
  canManage: boolean;
}) {
  const [view, setView] = useState<ViewMode>("month");
  const [selectedDay, setSelectedDay] = useState(day);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isAr = locale === "ar";
  const weekStart = isAr ? 0 : 1;
  const today = toKey(new Date());
  const [year = 2000, monthNumber = 1] = month.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, monthNumber - 1, 1));
  const firstGridDay = shift(monthStart, -((monthStart.getUTCDay() - weekStart + 7) % 7));
  const monthDays = Array.from({ length: 42 }, (_, index) => shift(firstGridDay, index));
  const focused = fromKey(selectedDay);
  const periodDays = view === "day"
    ? [focused]
    : view === "week"
      ? Array.from({ length: 7 }, (_, index) => shift(focused, -((focused.getUTCDay() - weekStart + 7) % 7) + index))
      : monthDays;
  const eventGroups = useMemo(() => {
    const map = new Map<string, CalendarBoardEvent[]>();
    for (const event of events) {
      const key = event.startDateTime.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return map;
  }, [events]);
  const localeTag = isAr ? "ar-DZ" : "fr-FR";
  const monthLabel = new Intl.DateTimeFormat(localeTag, { month: "long", year: "numeric", timeZone: "UTC" }).format(monthStart);
  const weekdayLabels = Array.from({ length: 7 }, (_, index) => {
    const date = shift(firstGridDay, index);
    return new Intl.DateTimeFormat(localeTag, { weekday: "short", timeZone: "UTC" }).format(date);
  });
  const selectedEvents = eventGroups.get(selectedDay) ?? [];
  const monthParam = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  const prevMonth = new Date(Date.UTC(year, monthNumber - 2, 1));
  const nextMonth = new Date(Date.UTC(year, monthNumber, 1));
  function navigateTo(date: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", monthParam(date));
    params.set("day", toKey(date));
    router.push(`${pathname}?${params.toString()}`);
    setSelectedDay(toKey(date));
  }

  function eventTime(value: string) {
    return new Intl.DateTimeFormat(localeTag, { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Algiers" }).format(new Date(value));
  }

  function eventCard(event: CalendarBoardEvent) {
    const isMatch = event.type === "MATCH";
    const VenueIcon = event.isHomeFixture === true ? Home : Plane;
    const venueLabel = event.isHomeFixture === true
      ? (isAr ? "مباراة على ملعبنا" : "Match à domicile")
      : (isAr ? "مباراة خارج ملعبنا" : "Match à l’extérieur");
    const label = isMatch
      ? `${event.opponentName ?? event.title} · ${venueLabel}`
      : `${typeName(event.type, locale)}${event.team ? ` · ${event.team}` : ""}: ${event.title}`;
    return <a key={event.id} href={event.href} aria-label={label} title={label} className={`group flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2.5 transition hover:border-club-primary/35 hover:bg-muted/40 ${typeColor(event.type)}`}>
      {isMatch ? <span className="flex min-w-0 flex-1 items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-rose-500/20 bg-background/70 p-1.5"><OpponentCrest src={event.opponentLogo} alt={event.opponentName ?? ""} iconClassName="h-6 w-6 text-rose-400" /></span>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-500/10 text-rose-500" title={venueLabel}><VenueIcon className="h-5 w-5" aria-hidden="true" /></span>
        <span className="min-w-0"><span className="block text-[10px] font-bold uppercase tracking-wide opacity-80">{typeName(event.type, locale)}{event.team ? ` · ${event.team}` : ""}</span><span className="block truncate text-xs font-semibold text-foreground">{venueLabel}</span></span>
      </span> : <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold opacity-80">{typeName(event.type, locale)}{event.team ? ` · ${event.team}` : ""}</span>
        <span className="mt-0.5 block truncate text-sm font-semibold text-foreground">{event.title}</span>
        {event.location && <span className="mt-1 flex items-center gap-1 truncate text-[10px] text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" />{event.location}</span>}
      </span>}
      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{eventTime(event.startDateTime)}</span>
    </a>;
  }

  return <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => navigateTo(fromKey(today))} className="h-9 rounded-xl border border-border px-3 text-sm font-semibold text-foreground transition hover:bg-muted">{isAr ? "اليوم" : "Aujourd’hui"}</button>
        <button type="button" aria-label={isAr ? "الفترة السابقة" : "Période précédente"} onClick={() => navigateTo(view === "month" ? prevMonth : shift(focused, view === "week" ? -7 : -1))} className="grid h-9 w-9 place-items-center rounded-xl border border-border text-foreground transition hover:bg-muted"><ChevronLeft className="h-4 w-4 rtl:rotate-180" /></button>
        <button type="button" aria-label={isAr ? "الفترة التالية" : "Période suivante"} onClick={() => navigateTo(view === "month" ? nextMonth : shift(focused, view === "week" ? 7 : 1))} className="grid h-9 w-9 place-items-center rounded-xl border border-border text-foreground transition hover:bg-muted"><ChevronRight className="h-4 w-4 rtl:rotate-180" /></button>
        <h2 className="ms-2 text-lg font-bold capitalize text-foreground">{view === "day" ? new Intl.DateTimeFormat(localeTag, { dateStyle: "full", timeZone: "UTC" }).format(focused) : view === "week" ? `${new Intl.DateTimeFormat(localeTag, { day: "numeric", month: "short", timeZone: "UTC" }).format(periodDays[0])} – ${new Intl.DateTimeFormat(localeTag, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(periodDays[6])}` : monthLabel}</h2>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex rounded-xl border border-border bg-muted/40 p-1" role="group" aria-label={isAr ? "عرض الرزنامة" : "Vue du calendrier"}>
          {(["month", "week", "day"] as const).map((mode) => <button key={mode} type="button" onClick={() => setView(mode)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${view === mode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{mode === "month" ? isAr ? "شهر" : "Mois" : mode === "week" ? isAr ? "أسبوع" : "Semaine" : isAr ? "يوم" : "Jour"}</button>)}
        </div>
        {canManage && <a href={addEventHref} className="inline-flex h-9 items-center gap-2 rounded-xl bg-club-primary px-3 text-xs font-bold text-white transition hover:brightness-110"><CalendarDays className="h-4 w-4" />{isAr ? "موعد جديد" : "Nouvel événement"}</a>}
      </div>
    </div>

    <div className={`grid grid-cols-7 ${view === "day" ? "hidden" : ""}`}>
      {weekdayLabels.map((label, index) => <div key={`${label}-${index}`} className="border-b border-e border-border bg-muted/20 px-2 py-2 text-center text-[10px] font-semibold uppercase text-muted-foreground last:border-e-0">{label}</div>)}
      {periodDays.map((date, index) => {
        const key = toKey(date);
        const isCurrentMonth = date.getUTCMonth() === monthStart.getUTCMonth();
        const isSelected = key === selectedDay;
        const dayEvents = eventGroups.get(key) ?? [];
        return <button type="button" key={key} onClick={() => { if (!isCurrentMonth && view === "month") navigateTo(date); else setSelectedDay(key); if (view === "month") setView("day"); }} className={`min-h-24 border-b border-e border-border p-1.5 text-start transition hover:bg-muted/30 sm:min-h-28 sm:p-2 ${index % 7 === 6 ? "border-e-0" : ""} ${isCurrentMonth || view !== "month" ? "" : "bg-muted/10 text-muted-foreground/55"} ${isSelected ? "bg-club-primary/[0.04]" : ""}`}>
          <span className={`mx-auto grid h-7 w-7 place-items-center rounded-full text-xs font-semibold ${key === today ? "bg-club-primary text-white" : isSelected ? "bg-club-primary/10 text-club-primary" : "text-foreground"}`}>{date.getUTCDate()}</span>
          <span className="mt-1 hidden space-y-1 sm:block">
            {dayEvents.slice(0, 2).map((event) => event.type === "MATCH" ? <span key={event.id} className={`mx-auto inline-flex w-fit max-w-full items-center justify-center gap-1.5 overflow-hidden rounded-md border px-2 py-1 text-[10px] font-semibold ${typeColor(event.type)}`} title={`${event.opponentName ?? event.title} · ${eventTime(event.startDateTime)} · ${event.isHomeFixture === true ? (isAr ? "على ملعبنا" : "À domicile") : (isAr ? "خارج الديار" : "À l’extérieur")}`}><OpponentCrest src={event.opponentLogo} alt={event.opponentName ?? ""} className="h-4 w-4 shrink-0" iconClassName="h-3 w-3 text-rose-400" />{event.isHomeFixture === true ? <Home className="h-4 w-4 shrink-0 text-rose-500" aria-hidden="true" /> : <Plane className="h-4 w-4 shrink-0 text-rose-500" aria-hidden="true" />}</span> : <span key={event.id} className={`block truncate rounded-md border px-1.5 py-1 text-[10px] font-semibold ${typeColor(event.type)}`}><span className="opacity-75">{eventTime(event.startDateTime)}</span> {event.title}</span>)}
            {dayEvents.length > 2 && <span className="block px-1 text-[9px] font-semibold text-muted-foreground">+{dayEvents.length - 2} {isAr ? "مواعيد" : "autres"}</span>}
          </span>
          {dayEvents.length > 0 && <span className="mt-1 flex flex-wrap justify-center gap-1 sm:hidden">{dayEvents.slice(0, 3).map((event) => event.type === "MATCH" ? <span key={event.id} className="inline-flex h-6 w-fit max-w-full items-center justify-center gap-1 rounded border border-rose-500/30 bg-rose-500/10 px-1.5" title={`${event.opponentName ?? event.title} · ${event.isHomeFixture === true ? (isAr ? "على ملعبنا" : "À domicile") : (isAr ? "خارج الديار" : "À l’extérieur")}`}><OpponentCrest src={event.opponentLogo} alt={event.opponentName ?? ""} className="h-4 w-4 shrink-0" iconClassName="h-3 w-3 text-rose-400" />{event.isHomeFixture === true ? <Home className="h-4 w-4 shrink-0 text-rose-500" aria-hidden="true" /> : <Plane className="h-4 w-4 shrink-0 text-rose-500" aria-hidden="true" />}</span> : <i key={event.id} className={`h-1.5 w-1.5 rounded-full ${event.type === "TRAINING" ? "bg-sky-500" : event.type === "MEETING" ? "bg-violet-500" : "bg-emerald-500"}`} title={typeName(event.type, locale)} />)}</span>}
        </button>;
      })}
    </div>

    <div className="border-t border-border bg-muted/10 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-bold text-foreground">{isAr ? "أحداث اليوم المحدد" : "Événements du jour sélectionné"}</h3>
        <span className="text-xs text-muted-foreground">{selectedEvents.length} {isAr ? "موعد" : "événement(s)"}</span>
      </div>
      {selectedEvents.length ? <div className="grid gap-2 md:grid-cols-2">{selectedEvents.map(eventCard)}</div> : <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{isAr ? "لا توجد أحداث في هذا اليوم. اختر يومًا آخر أو أضف موعدًا للنادي." : "Aucun événement ce jour. Choisissez une autre date ou ajoutez un rendez-vous."}</p>}
    </div>
  </section>;
}
