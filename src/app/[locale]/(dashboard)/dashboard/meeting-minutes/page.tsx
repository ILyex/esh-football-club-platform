import { formatAlgeriaDateTimeLocalized } from "@/lib/dates/algeria";
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
import { CalendarClock, ClipboardPenLine, Plus, Users, FileText, MapPin } from "lucide-react";
import { actionControlClass } from "@/components/shared/action-controls";

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
  const canManageMeetings = hasPermission(user, "meetings.manage");
  const t = await getTranslations("meetings");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");

  const effectiveTeamId = await getEffectiveTeamId(sp.team);
  const where = {
    ...(sp.status ? { status: sp.status as any } : {}),
    ...(effectiveTeamId ? { teamId: effectiveTeamId } : {})
  };

  const [minutes, teams, scheduledMeetings] = await Promise.all([
    db.meetingMinute.findMany({ where, include: { team: true }, orderBy: { date: "desc" }, take: 100 }),
    getAuthorizedTeams(),
    db.calendarEvent.findMany({
      where: { type: "MEETING", ...(effectiveTeamId ? { OR: [{ teamId: effectiveTeamId }, { teamId: null }] } : {}) },
      include: { team: true, meetingMinute: { select: { id: true } } }, orderBy: { startDateTime: "desc" }, take: 100
    })
  ]);

  return (
    <div className="space-y-6">
      <DocumentsNavTabs
        locale={locale}
        canViewDocuments={hasPermission(user, "documents.view")}
        canViewContracts={canViewContracts}
        canViewMedicalRecords={hasPermission(user, "medical.records.view")}
        canViewCorrespondence={canViewCorrespondence}
        canViewMeetings={true}
        canViewTemplates={hasPermission(user, "templates.view")}
        canManageTemplates={hasPermission(user, "templates.manage")}
        canViewReports={hasPermission(user, "reports.view")}
      />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{t("title")}</h1>
        {canManageMeetings && <Link href={`/${locale}/dashboard/meeting-minutes/schedule`}>
          <Button className="inline-flex items-center gap-2"><Plus className="h-4 w-4 shrink-0" aria-hidden="true" />{t("createMeeting")}</Button>
        </Link>}
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-labelledby="meeting-schedule">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-muted/30 px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-club-primary/10 text-club-primary">
              <Users className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="meeting-schedule" className="font-semibold text-foreground">{t("meetingsSection.title")}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("meetingsSection.description")}</p>
            </div>
          </div>
          <Badge tone="neutral" className="shrink-0 px-3 py-1">{t("meetingsSection.count", { count: scheduledMeetings.length })}</Badge>
        </div>
        {scheduledMeetings.length > 0 ? <ul className="divide-y divide-border px-4 sm:px-5">
          {scheduledMeetings.map((event) => {
            const ended = event.endDateTime <= new Date();
            return <li key={event.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="break-words font-medium text-foreground">{event.title}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <time dateTime={event.startDateTime.toISOString()} className="inline-flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                  {formatAlgeriaDateTimeLocalized(event.startDateTime, locale, { dateStyle: "medium", timeStyle: "short", calendar: "gregory" })}
                </time>
                {event.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{event.location}</span>}
                {event.team && <span>{tTeams(`categories.${event.team.category}` as any)}</span>}
              </div>
            </div>
            {event.meetingMinute
              ? <Link href={`/${locale}/dashboard/meeting-minutes/${event.meetingMinute.id}`} className={actionControlClass("edit")}><FileText className="me-1 inline h-4 w-4" />{t("meetingsSection.viewMinutes")}</Link>
              : ended
                ? <Link href={`/${locale}/dashboard/meeting-minutes/new?event=${encodeURIComponent(event.id)}`} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-club-primary px-3.5 py-2 text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card sm:self-auto"><ClipboardPenLine className="h-4 w-4" aria-hidden="true" />{t("pendingMinutes.create")}</Link>
                : <Badge tone="warning" className="shrink-0 self-start">{t("meetingsSection.upcoming")}</Badge>}
          </li>;
          })}
        </ul> : <p className="px-5 py-8 text-center text-sm text-muted-foreground">{t("meetingsSection.empty")}</p>}
      </section>

      <div className="flex items-center justify-between gap-3 pt-2">
        <div><h2 className="text-lg font-bold text-foreground">{t("minutesSection.title")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("minutesSection.description")}</p></div>
        <Badge tone="neutral">{minutes.length}</Badge>
      </div>
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
            {minutes.map((m) => (
              <tr key={m.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">{m.title}</td>
                <td className="px-4 py-2">{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(m.date)}</td>
                <td className="px-4 py-2">{m.team ? tTeams(`categories.${m.team.category}` as any) : "—"}</td>
                <td className="px-4 py-2">
                  <Badge tone={STATUS_TONE[m.status]}>{t(`statuses.${m.status}` as any)}</Badge>
                </td>
                <td className="px-4 py-2">
                  <Link href={`/${locale}/dashboard/meeting-minutes/${m.id}`} className={actionControlClass("edit")}>
                    {tCommon("edit")}
                  </Link>
                </td>
              </tr>
            ))}
            {minutes.length === 0 && (
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
