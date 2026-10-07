import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { getMutationScopeContext, assertTeamScope } from "@/lib/mutation-guards";
import { notFound, redirect } from "next/navigation";
import { updateTrainingSessionAction, deleteTrainingSessionAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TrainingAttendanceSheet, type AttendanceStatus } from "@/components/training/training-attendance-sheet";
import { getPlayerDisplayName } from "@/lib/utils";
import { DateInput } from "@/components/ui/date-input";
import { TimeInput } from "@/components/ui/time-input";
import { Save,  Calendar, Users, MapPin, Clock } from "lucide-react";

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

export default async function TrainingDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const user = await requirePagePermission("training.view", locale);
  const t = await getTranslations("training");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");
  const canManage = hasPermission(user, "training.manage");
  const isAr = locale === "ar";

  const session = await db.trainingSession.findUnique({
    where: { id },
    include: { attendances: { include: { player: true } } }
  });
  if (!session) notFound();

  const scopeContext = await getMutationScopeContext();
  try {
    assertTeamScope(scopeContext, session.teamId, "TrainingSession", { allowClubWide: true });
  } catch {
    notFound();
  }

  const [coaches, players, teams, scannedDoc] = await Promise.all([
    db.staff.findMany({
      where: { role: { in: ["HEAD_COACH", "ASSISTANT_COACH", "GOALKEEPING_COACH", "FITNESS_COACH"] }, status: "ACTIVE" },
      orderBy: { lastName: "asc" }
    }),
    db.player.findMany({
      where: {
        ...(session.teamId ? { teamId: session.teamId } : {}),
        status: { not: "ARCHIVED" }
      },
      orderBy: [{ shirtNumber: "asc" }, { lastName: "asc" }]
    }),
    db.team.findMany({ orderBy: { category: "asc" } }),
    db.document.findFirst({
      where: { description: { contains: `TRAINING_ATTENDANCE:${id}` } },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const currentTeam = teams.find((tm) => tm.id === session.teamId);
  const currentCoach = coaches.find((c) => c.id === session.coachId);
  const teamLabel = currentTeam ? tTeams(`categories.${currentTeam.category}` as any) : (isAr ? "الفريق الأول" : "Équipe");

  const sessionData = {
    id: session.id,
    date: session.date,
    startTime: session.startTime,
    endTime: session.endTime,
    teamName: teamLabel,
    teamCategory: currentTeam?.category || "",
    coachName: currentCoach ? getPlayerDisplayName(currentCoach, locale) : null,
    location: session.location,
    status: session.status,
    notes: session.notes
  };

  const attendanceByPlayer = new Map(session.attendances.map((a) => [a.playerId, a.status] as const));
  const rosterPlayers = players.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    firstNameFr: p.firstNameFr,
    lastNameFr: p.lastNameFr,
    shirtNumber: p.shirtNumber,
    position: p.position,
    currentStatus: (attendanceByPlayer.get(p.id) as AttendanceStatus) ?? "PRESENT"
  }));

  async function update(formData: FormData) {
    "use server";
    await updateTrainingSessionAction(id, formData);
  }
  async function remove() {
    "use server";
    await deleteTrainingSessionAction(id);
    redirect(`/${locale}/dashboard/training`);
  }

  const statusTone: Record<string, "success" | "danger" | "neutral"> = {
    COMPLETED: "success",
    CANCELLED: "danger",
    SCHEDULED: "neutral"
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              {new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(session.date)}
            </h1>
            <Badge tone={statusTone[session.status] || "neutral"}>
              {t(`statuses.${session.status}` as any)}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-muted-foreground mt-1.5">
            <span className="flex items-center gap-1 font-medium text-foreground">
              <Users className="h-3.5 w-3.5 text-club-primary" />
              {teamLabel}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {hhmm(session.startTime)} - {hhmm(session.endTime)}
            </span>
            {session.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                {session.location}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Side-by-side Grid: Training Programming (5 cols) & Attendance List (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Column 1: Training Session Details Form (5 cols) */}
        <div className="lg:col-span-5 rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4 text-club-primary" />
              {isAr ? "برمجة الحصة التدريبية" : "Programmation de la Séance"}
            </h2>
          </div>

          <form action={update} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">{tTeams("title")}</label>
                <select
                  name="teamId"
                  defaultValue={session.teamId ?? ""}
                  disabled={!canManage}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
                >
                  {teams.map((tm) => (
                    <option key={tm.id} value={tm.id}>
                      {tTeams(`categories.${tm.category}` as any)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <DateInput
                  label={t("fields.date")}
                  name="date"
                  defaultValue={session.date}
                  disabled={!canManage}
                  locale={locale}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">{t("fields.startTime")}</label>
                <TimeInput
                  name="startTime"
                  defaultValue={hhmm(session.startTime)}
                  disabled={!canManage}
                  locale={locale}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">{t("fields.endTime")}</label>
                <TimeInput
                  name="endTime"
                  defaultValue={hhmm(session.endTime)}
                  disabled={!canManage}
                  locale={locale}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">{t("fields.coach")}</label>
              <select
                name="coachId"
                defaultValue={session.coachId ?? ""}
                disabled={!canManage}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
              >
                <option value="">—</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">{t("fields.status")}</label>
                <select
                  name="status"
                  defaultValue={session.status}
                  disabled={!canManage}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
                >
                  {["SCHEDULED", "COMPLETED", "CANCELLED"].map((s) => (
                    <option key={s} value={s}>
                      {t(`statuses.${s}` as any)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">{t("fields.location")}</label>
                <input
                  name="location"
                  defaultValue={session.location ?? ""}
                  disabled={!canManage}
                  placeholder={isAr ? "الملعب البلدي..." : "Stade municipal..."}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">{t("fields.notes")}</label>
              <textarea
                name="notes"
                rows={3}
                defaultValue={session.notes ?? ""}
                disabled={!canManage}
                placeholder={isAr ? "أهداف الحصة، ملاحظات فنية..." : "Objectifs de la séance..."}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              {canManage && (
                <Button type="submit" size="sm" className="font-semibold gap-2"><Save className="h-4 w-4" /><span>{tCommon("save")}</span></Button>
              )}
              {canManage && (
                <ConfirmDialog onConfirm={remove}>
                  <Button type="button" variant="destructive" size="sm">
                    {tCommon("delete")}
                  </Button>
                </ConfirmDialog>
              )}
            </div>
          </form>
        </div>

        {/* Right / Column 2: Training Attendance Sheet (7 cols) */}
        <div className="lg:col-span-7 rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs">
          <TrainingAttendanceSheet
            sessionId={session.id}
            session={sessionData}
            players={rosterPlayers}
            canManage={canManage}
            locale={locale}
            scannedDocument={
              scannedDoc
                ? {
                    id: scannedDoc.id,
                    name: scannedDoc.name,
                    originalName: scannedDoc.originalName,
                    mimeType: scannedDoc.mimeType,
                    sizeBytes: scannedDoc.sizeBytes,
                    createdAt: scannedDoc.createdAt.toISOString()
                  }
                : null
            }
          />
        </div>
      </div>
    </div>
  );
}
