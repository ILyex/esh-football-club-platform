import { DashboardTeamCategorySelect } from "@/components/shared/dashboard-team-category-select";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions";
import { getEffectiveTeamId, getAuthorizedTeams } from "@/lib/team-context";
import { birthYearMismatch, getPlayerDisplayName } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlayerOverviewModal } from "@/components/players/player-overview-modal";
import { OfficialPlayerAttestationModal } from "@/components/players/official-player-attestation-modal";
import { PlayerPrintListModal } from "@/components/players/player-print-list-modal";
import { evaluatePlayerInsurance } from "@/lib/documents/insurance-helper";
import { arabicNationality, frenchNationality } from "@/lib/public/locale-text";
import { AlertTriangle, Plus } from "lucide-react";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  ACTIVE: "success",
  INJURED: "warning",
  SUSPENDED: "danger",
  ON_LOAN: "neutral",
  ARCHIVED: "neutral"
};

export default async function PlayersListPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; status?: string; position?: string; team?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  await requirePagePermission("players.view", locale);

  const t = await getTranslations("players");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");

  const pageSize = 20;
  const page = Math.max(1, Number(sp.page ?? "1"));

  // The URL's own ?team= wins when present (so a direct link to one
  // category always shows that category); otherwise fall back to the
  // dashboard-wide Team Switcher cookie, and "ALL" explicitly clears it.
  const effectiveTeamId = await getEffectiveTeamId(sp.team);

  const where = {
    ...(sp.status ? { status: sp.status as any } : {}),
    ...(sp.position ? { position: sp.position as any } : {}),
    ...(effectiveTeamId ? { teamId: effectiveTeamId } : {}),
    ...(sp.q
      ? {
          OR: [
            { firstName: { contains: sp.q, mode: "insensitive" as const } },
            { lastName: { contains: sp.q, mode: "insensitive" as const } },
            { firstNameFr: { contains: sp.q, mode: "insensitive" as const } },
            { lastNameFr: { contains: sp.q, mode: "insensitive" as const } }
          ]
        }
      : {})
  };

  const [players, total, teams] = await Promise.all([
    db.player.findMany({
      where,
      include: {
        team: true,
        matchEvents: {
          include: {
            match: {
              select: {
                id: true,
                isHomeFixture: true,
                homeTeamName: true,
                awayTeamName: true,
                matchDate: true,
                competition: { select: { name: true } }
              }
            }
          }
        },
        matchLineups: {
          select: { matchId: true }
        },
        trainingAttendances: {
          include: {
            training: {
              select: { id: true, date: true, location: true, notes: true }
            }
          }
        },
        documents: {
          select: { id: true, name: true, description: true, documentDate: true }
        }
      },
      orderBy: { shirtNumber: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    db.player.count({ where }),
    getAuthorizedTeams()
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <PlayerPrintListModal
            players={players.map((p) => ({
              id: p.id,
              firstName: p.firstName,
              lastName: p.lastName,
              firstNameFr: p.firstNameFr,
              lastNameFr: p.lastNameFr,
              dateOfBirth: p.dateOfBirth,
              licenceNumber: p.licenceNumber,
              shirtNumber: p.shirtNumber,
              position: p.position,
              teamCategory: p.team?.category
            }))}
            teamCategoryName={
              effectiveTeamId
                ? teams.find((t) => t.id === effectiveTeamId)
                  ? tTeams(`categories.${teams.find((t) => t.id === effectiveTeamId)!.category}` as any)
                  : undefined
                : undefined
            }
            locale={locale}
          />
          <Link href={`/${locale}/dashboard/players/new`}>
            <Button className="gap-2">
              <Plus className="h-4 w-4 shrink-0" />
              <span>{t("addPlayer")}</span>
            </Button>
          </Link>
        </div>
      </div>

      <form className="dashboard-filter-toolbar mb-4">
        <input
          name="q"
          defaultValue={sp.q}
          placeholder={tCommon("search")}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <DashboardTeamCategorySelect
          value={sp.team ?? effectiveTeamId ?? "ALL"}
          options={teams.map((tm) => ({ id: tm.id, label: tTeams(`categories.${tm.category}` as any) }))}
          allLabel={tTeams("allTeams")}
          locale={locale}
        />
        <Button type="submit" variant="outline">
          {tCommon("filter")}
        </Button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[650px] text-start text-sm">
          <thead className="border-b border-border bg-muted/50 text-start">
            <tr>
              <th className="px-4 py-2 text-start w-12">#</th>
              <th className="px-4 py-2 text-start w-14">{t("fields.photo")}</th>
              <th className="px-4 py-2 text-start">{t("fields.firstName")}</th>
              <th className="px-4 py-2 text-start">{t("fields.team")}</th>
              <th className="px-4 py-2 text-start">{t("fields.position")}</th>
              <th className="px-4 py-2 text-start">{t("fields.nationality")}</th>
              <th className="px-4 py-2 text-start">{locale === "ar" ? "التأمين" : "Assurance"}</th>
              <th className="px-4 py-2 text-start">{tCommon("status")}</th>
              <th className="px-4 py-2 text-start">{tCommon("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const goals = p.matchEvents.filter((e) => e.type === "GOAL" || e.type === "PENALTY_GOAL").length;
              const assists = p.matchEvents.filter((e) => e.type === "ASSIST").length;
              const yellowCards = p.matchEvents.filter((e) => e.type === "YELLOW_CARD").length;
              const redCards = p.matchEvents.filter((e) => e.type === "RED_CARD").length;
              const appearances = p.matchLineups.length;

              const totalAttendance = p.trainingAttendances.length;
              const present = p.trainingAttendances.filter((a) => a.status === "PRESENT").length;
              const absent = p.trainingAttendances.filter((a) => a.status === "ABSENT").length;
              const excused = p.trainingAttendances.filter((a) => a.status === "EXCUSED").length;
              const injured = p.trainingAttendances.filter((a) => a.status === "INJURED").length;
              const attendanceRate = totalAttendance > 0 ? Math.round((present / totalAttendance) * 100) : 0;

              const serializedPlayer = {
                id: p.id,
                slug: p.slug,
                firstName: p.firstName,
                lastName: p.lastName,
                firstNameFr: p.firstNameFr,
                lastNameFr: p.lastNameFr,
                shirtNumber: p.shirtNumber,
                position: p.position,
                nationality: p.nationality,
                licenceNumber: p.licenceNumber,
                dateOfBirth: p.dateOfBirth.toISOString(),
                height: p.height,
                weight: p.weight,
                preferredFoot: p.preferredFoot,
                status: p.status,
                photoUrl: p.photoUrl,
                joiningDate: p.joiningDate ? p.joiningDate.toISOString() : null,
                team: p.team ? { id: p.team.id, name: p.team.name, category: p.team.category } : null,
                isInsured: evaluatePlayerInsurance(p.documents).isInsured,
                stats: {
                  goals,
                  assists,
                  yellowCards,
                  redCards,
                  appearances
                },
                attendance: {
                  total: totalAttendance,
                  present,
                  absent,
                  excused,
                  injured,
                  rate: attendanceRate
                },
                recentMatchEvents: [...p.matchEvents]
                  .sort((a, b) => new Date(b.match.matchDate).getTime() - new Date(a.match.matchDate).getTime())
                  .slice(0, 10)
                  .map((evt) => ({
                    id: evt.id,
                    type: evt.type,
                    minute: evt.minute,
                    notes: evt.notes,
                    match: {
                      id: evt.match.id,
                      opponent: evt.match.isHomeFixture ? evt.match.awayTeamName : evt.match.homeTeamName,
                      date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(evt.match.matchDate),
                      competitionName: evt.match.competition?.name || "بطولة رسمية"
                    }
                  })),
                recentAttendances: [...p.trainingAttendances]
                  .sort((a, b) => new Date(b.training.date).getTime() - new Date(a.training.date).getTime())
                  .slice(0, 5)
                  .map((att) => ({
                    trainingId: att.trainingId,
                    status: att.status,
                    date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(att.training.date)
                  }))
              };

              return (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2 font-mono font-bold text-muted-foreground">{p.shirtNumber ?? "—"}</td>
                  <td className="px-4 py-2">
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted shadow-2xs">
                      {p.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.photoUrl}
                          alt={`${p.firstName} ${p.lastName}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-bold text-muted-foreground uppercase">
                          {(p.firstName[0] || "") + (p.lastName[0] || "")}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 font-medium">
                    {getPlayerDisplayName(p, locale)}
                    {birthYearMismatch(p.dateOfBirth, p.team) && (
                      <span title={tTeams("birthYearWarning")} className="inline-flex items-center ms-1 text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">{p.team ? tTeams(`categories.${p.team.category}` as any) : "—"}</td>
                  <td className="px-4 py-2">
                    <span className="inline-block rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                      {t(`positions.${p.position}` as any)}
                    </span>
                  </td>
              <td className="px-4 py-2">{locale === "ar" ? arabicNationality(p.nationality) : frenchNationality(p.nationality)}</td>
                  <td className="px-4 py-2">
                    {(() => {
                      const evalRes = evaluatePlayerInsurance(p.documents);
                      if (evalRes.status === "INSURED") {
                        return (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <span>{locale === "ar" ? "مؤمّن" : "Assuré"}</span>
                          </span>
                        );
                      }
                      if (evalRes.status === "EXPIRING_SOON") {
                        return (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400" title={locale === "ar" ? `ينتهي خلال ${evalRes.daysRemaining} يوم` : `Expire dans ${evalRes.daysRemaining} jours`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            <span>{locale === "ar" ? `ينتهي قريباً (${evalRes.daysRemaining}ي)` : `Expire bientôt`}</span>
                          </span>
                        );
                      }
                      if (evalRes.status === "EXPIRED") {
                        return (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-600/15 border border-red-600/30 px-2.5 py-0.5 text-[11px] font-bold text-red-600 dark:text-red-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
                            <span>{locale === "ar" ? "منتهي الصلاحية" : "Expiré"}</span>
                          </span>
                        );
                      }
                      return (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 border border-red-500/30 px-2.5 py-0.5 text-[11px] font-bold text-red-600 dark:text-red-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                          <span>{locale === "ar" ? "غير مؤمّن" : "Non assuré"}</span>
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone={STATUS_TONE[p.status]}>{t(`statuses.${p.status}` as any)}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <OfficialPlayerAttestationModal
                        player={{
                          id: p.id,
                          firstName: p.firstName,
                          lastName: p.lastName,
                          firstNameFr: p.firstNameFr,
                          lastNameFr: p.lastNameFr,
                          dateOfBirth: p.dateOfBirth,
                          nationality: p.nationality,
                          licenceNumber: p.licenceNumber,
                          joiningDate: p.joiningDate,
                          position: t(`positions.${p.position}` as any),
                          shirtNumber: p.shirtNumber,
                          teamName: p.team?.name,
                          teamCategory: p.team ? tTeams(`categories.${p.team.category}` as any) : null,
                          photoUrl: p.photoUrl
                        }}
                        locale={locale}
                        triggerVariant="outline"
                        triggerLabel={locale === "ar" ? "وثيقة اللاعب" : "Attestation"}
                      />
                      <PlayerOverviewModal player={serializedPlayer} locale={locale} />
                      <span className="text-muted-foreground/40 text-xs">|</span>
                      <Link href={`/${locale}/dashboard/players/${p.id}`} className="text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline">
                        {tCommon("edit")}
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
            {players.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  {tCommon("noResults")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <p>
          {total} • {tCommon("view")} {page}/{totalPages}
        </p>
        <div className="flex gap-2">
          {page > 1 && (
            <Link href={`/${locale}/dashboard/players?${new URLSearchParams({ ...sp, page: String(page - 1) } as any)}`} className="text-club-primary underline">
              ‹
            </Link>
          )}
          {page < totalPages && (
            <Link href={`/${locale}/dashboard/players?${new URLSearchParams({ ...sp, page: String(page + 1) } as any)}`} className="text-club-primary underline">
              ›
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
