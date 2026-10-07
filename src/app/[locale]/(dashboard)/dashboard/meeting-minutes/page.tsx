import { DashboardTeamCategorySelect } from "@/components/shared/dashboard-team-category-select";
import { MasterFilterSelect } from "@/components/shared/master-filter-select";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { getEffectiveTeamId, getAuthorizedTeams } from "@/lib/team-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentsNavTabs } from "@/components/documents/documents-nav-tabs";
import { CalendarClock, ClipboardPenLine, Plus} from "lucide-react";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  DRAFT: "neutral",
  APPROVED: "success",
  ARCHIVED: "danger"
};

export default async function MeetingMinutesListPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; team?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await requirePagePermission("meetings.view", locale);
  const canViewContracts = hasPermission(user, "contracts.view");
  const canViewCorrespondence = hasPermission(user, "correspondence.view");
  const t = await getTranslations("meetings");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");

  const effectiveTeamId = await getEffectiveTeamId(sp.team);
  const where = {
    ...(sp.status ? { status: sp.status as any } : {}),
    ...(effectiveTeamId ? { teamId: effectiveTeamId } : {})
  };

  const [meetings, teams, pendingEvents] = await Promise.all([
    db.meetingMinute.findMany({ where, include: { team: true }, orderBy: { date: "desc" }, take: 100 }),
    getAuthorizedTeams(),
    db.calendarEvent.findMany({
      where: { type: "MEETING", endDateTime: { lt: new Date() }, meetingMinute: { is: null }, ...(effectiveTeamId ? { OR: [{ teamId: effectiveTeamId }, { teamId: null }] } : {}) },
      include: { team: true }, orderBy: { startDateTime: "desc" }, take: 50
    })
  ]);

  return (
    <div className="space-y-6">
      <DocumentsNavTabs
        locale={locale}
        canViewDocuments={hasPermission(user, "documents.view")}
        canViewContracts={canViewContracts}
        canViewInsurance={hasPermission(user, "documents.view")}
        canViewCorrespondence={canViewCorrespondence}
        canViewMeetings={true}
        canViewTemplates={hasPermission(user, "templates.view")}
        canManageTemplates={hasPermission(user, "templates.manage")}
        canViewReports={hasPermission(user, "reports.view")}
      />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <Link href={`/${locale}/dashboard/meeting-minutes/new`}>
          <Button className="inline-flex items-center gap-2"><Plus className="h-4 w-4 shrink-0" aria-hidden="true" />{t("addMeeting")}</Button>
        </Link>
      </div>

      {pendingEvents.length > 0 && <section className="overflow-hidden rounded-2xl border border-amber-500/25 bg-card shadow-sm" aria-labelledby="pending-meeting-minutes">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-amber-500/[0.06] px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-300">
              <CalendarClock className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="pending-meeting-minutes" className="font-semibold text-foreground">{t("pendingMinutes.title")}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("pendingMinutes.description")}</p>
            </div>
          </div>
          <Badge tone="warning" className="shrink-0 px-3 py-1">{t("pendingMinutes.count", { count: pendingEvents.length })}</Badge>
        </div>
        <ul className="divide-y divide-border px-4 sm:px-5">
          {pendingEvents.map((event) => <li key={event.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="break-words font-medium text-foreground">{event.title}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <time dateTime={event.startDateTime.toISOString()} className="inline-flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                  {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", calendar: locale === "ar" ? "gregory" : undefined }).format(event.startDateTime)}
                </time>
                {event.team && <span>{tTeams(`categories.${event.team.category}` as any)}</span>}
              </div>
            </div>
            <Link
              href={`/${locale}/dashboard/meeting-minutes/new?event=${encodeURIComponent(event.id)}`}
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-club-primary px-3.5 py-2 text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card sm:self-auto"
            >
              <ClipboardPenLine className="h-4 w-4" aria-hidden="true" />
              {t("pendingMinutes.create")}
            </Link>
          </li>)}
        </ul>
      </section>}

      <form className="dashboard-filter-toolbar mb-4">
        <DashboardTeamCategorySelect
          value={sp.team ?? effectiveTeamId ?? "ALL"}
          options={teams.map((tm) => ({ id: tm.id, label: tTeams(`categories.${tm.category}` as any) }))}
          allLabel={tTeams("allTeams")}
          locale={locale}
        />
        <MasterFilterSelect
          name="status"
          locale={locale === "ar" ? "ar" : "fr"}
          label={tCommon("status")}
          value={sp.status ?? ""}
          options={[{ id: "", label: tCommon("filter") }, ...["DRAFT", "APPROVED", "ARCHIVED"].map((s) => ({ id: s, label: t(`statuses.${s}` as any) }))]}
          headerTitle={locale === "ar" ? "تصفية حسب الحالة" : "Filtrer par statut"}
        />
        <Button type="submit" variant="outline">
          {tCommon("filter")}
        </Button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-border bg-muted/50 text-start">
            <tr>
              <th className="px-4 py-2 text-start">{t("fields.meetingTitle")}</th>
              <th className="px-4 py-2 text-start">{t("fields.date")}</th>
              <th className="px-4 py-2 text-start">{t("fields.team")}</th>
              <th className="px-4 py-2 text-start">{t("fields.status")}</th>
              <th className="px-4 py-2 text-start">{tCommon("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {meetings.map((m) => (
              <tr key={m.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">{m.title}</td>
                <td className="px-4 py-2">{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(m.date)}</td>
                <td className="px-4 py-2">{m.team ? tTeams(`categories.${m.team.category}` as any) : "—"}</td>
                <td className="px-4 py-2">
                  <Badge tone={STATUS_TONE[m.status]}>{t(`statuses.${m.status}` as any)}</Badge>
                </td>
                <td className="px-4 py-2">
                  <Link href={`/${locale}/dashboard/meeting-minutes/${m.id}`} className="text-sm text-club-primary underline">
                    {tCommon("edit")}
                  </Link>
                </td>
              </tr>
            ))}
            {meetings.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  {tCommon("noResults")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
