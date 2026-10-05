import { DashboardTeamCategorySelect } from "@/components/shared/dashboard-team-category-select";
import { MasterFilterSelect } from "@/components/shared/master-filter-select";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { getEffectiveTeamId, getAuthorizedTeams } from "@/lib/team-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StaffThematicCharts } from "@/components/staff/staff-thematic-charts";
import { getPlayerDisplayName } from "@/lib/utils";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  ACTIVE: "success",
  INACTIVE: "warning",
  ARCHIVED: "neutral"
};

const ROLES = [
  "HEAD_COACH",
  "ASSISTANT_COACH",
  "GOALKEEPING_COACH",
  "FITNESS_COACH",
  "MEDICAL_STAFF",
  "ADMINISTRATIVE_STAFF",
  "OTHER"
] as const;

export default async function StaffListPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; role?: string; status?: string; team?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  await requirePermission("staff.view");

  const t = await getTranslations("staff");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");

  const pageSize = 20;
  const page = Math.max(1, Number(sp.page ?? "1"));
  const effectiveTeamId = await getEffectiveTeamId(sp.team);

  const where = {
    ...(sp.role ? { role: sp.role as any } : {}),
    ...(sp.status ? { status: sp.status as any } : { status: { not: "ARCHIVED" as const } }),
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

  const [staff, total, teams, allActiveStaff] = await Promise.all([
    db.staff.findMany({
      where,
      include: { team: true },
      orderBy: [{ role: "asc" }, { lastName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    db.staff.count({ where }),
    getAuthorizedTeams(),
    db.staff.findMany({
      where: {
        status: { not: "ARCHIVED" as const },
        ...(effectiveTeamId ? { teamId: effectiveTeamId } : {})
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        team: {
          select: {
            id: true,
            category: true,
            name: true
          }
        }
      }
    })
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{t("title")}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {locale === "ar"
              ? "إدارة وتوزيع الطواقم الفنية والطبية والإدارية المشرفة على فرق النادي"
              : "Gestion et répartition des encadrements technique, médical et administratif du club"}
          </p>
        </div>
        <Link href={`/${locale}/dashboard/staff/new`}>
          <Button>{t("addStaff")}</Button>
        </Link>
      </div>

      {/* Thematic Visual Charts for Coaching, Medical, and Administrative staff */}
      <StaffThematicCharts staff={allActiveStaff} locale={locale} />

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
        <MasterFilterSelect
          name="role"
          locale={locale === "ar" ? "ar" : "fr"}
          label={locale === "ar" ? "الدور:" : "Rôle :"}
          value={sp.role ?? ""}
          options={[{ id: "", label: tCommon("filter") }, ...ROLES.map((r) => ({ id: r, label: t(`roles.${r}` as any) }))]}
          headerTitle={locale === "ar" ? "تصفية حسب الدور" : "Filtrer par rôle"}
        />
        <Button type="submit" variant="outline">
          {tCommon("filter")}
        </Button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[650px] text-start text-sm">
          <thead className="border-b border-border bg-muted/50 text-start">
            <tr>
              <th className="px-4 py-2 text-start w-14">{t("fields.photo")}</th>
              <th className="px-4 py-2 text-start">{t("fields.firstName")}</th>
              <th className="px-4 py-2 text-start">{t("fields.role")}</th>
              <th className="px-4 py-2 text-start">{tTeams("title")}</th>
              <th className="px-4 py-2 text-start">{tCommon("status")}</th>
              <th className="px-4 py-2 text-start">{tCommon("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2">
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted shadow-2xs">
                    {s.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.photoUrl}
                        alt={`${s.firstName} ${s.lastName}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-bold text-muted-foreground uppercase">
                        {(s.firstName[0] || "") + (s.lastName[0] || "")}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2 font-medium">
                  {getPlayerDisplayName(s, locale)}
                </td>
                <td className="px-4 py-2">
                  <span className="inline-block rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                    {t(`roles.${s.role}` as any)}
                  </span>
                </td>
                <td className="px-4 py-2">{s.team ? tTeams(`categories.${s.team.category}` as any) : "—"}</td>
                <td className="px-4 py-2">
                  <Badge tone={STATUS_TONE[s.status]}>{t(`statuses.${s.status}` as any)}</Badge>
                </td>
                <td className="px-4 py-2">
                  <Link href={`/${locale}/dashboard/staff/${s.id}`} className="text-sm font-semibold text-club-primary hover:underline">
                    {tCommon("edit")}
                  </Link>
                </td>
              </tr>
            ))}
            {staff.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
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
            <Link
              href={`/${locale}/dashboard/staff?${new URLSearchParams({ ...sp, page: String(page - 1) } as any)}`}
              className="text-club-primary underline"
            >
              ‹
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={`/${locale}/dashboard/staff?${new URLSearchParams({ ...sp, page: String(page + 1) } as any)}`}
              className="text-club-primary underline"
            >
              ›
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
