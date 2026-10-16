import { Plus } from "lucide-react";
import { DashboardTeamCategorySelect } from "@/components/shared/dashboard-team-category-select";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { getEffectiveTeamId, getAuthorizedTeams } from "@/lib/team-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentsNavTabs } from "@/components/documents/documents-nav-tabs";
import { MasterFilterSelect } from "@/components/shared/master-filter-select";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  NEW: "neutral",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  ARCHIVED: "danger"
};
const PRIORITY_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  LOW: "neutral",
  NORMAL: "neutral",
  HIGH: "warning",
  URGENT: "danger"
};

export default async function CorrespondenceListPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; type?: string; status?: string; priority?: string; team?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await requirePagePermission("correspondence.view", locale);
  const canViewContracts = hasPermission(user, "contracts.view");
  const canViewMeetings = hasPermission(user, "meetings.view");

  const t = await getTranslations("correspondence");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");

  const pageSize = 20;
  const page = Math.max(1, Number(sp.page ?? "1"));
  const effectiveTeamId = await getEffectiveTeamId(sp.team);

  const where = {
    ...(sp.type ? { type: sp.type as any } : {}),
    ...(sp.status ? { status: sp.status as any } : {}),
    ...(sp.priority ? { priority: sp.priority as any } : {}),
    ...(effectiveTeamId ? { teamId: effectiveTeamId } : {}),
    ...(sp.q
      ? {
          OR: [
            { subject: { contains: sp.q, mode: "insensitive" as const } },
            { referenceNumber: { contains: sp.q, mode: "insensitive" as const } },
            { sender: { contains: sp.q, mode: "insensitive" as const } },
            { recipient: { contains: sp.q, mode: "insensitive" as const } }
          ]
        }
      : {})
  };

  const [items, total, teams] = await Promise.all([
    db.correspondence.findMany({
      where,
      include: { team: true },
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    db.correspondence.count({ where }),
    getAuthorizedTeams()
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <DocumentsNavTabs
        locale={locale}
        canViewDocuments={hasPermission(user, "documents.view")}
        canViewContracts={canViewContracts}
        canViewMedicalRecords={hasPermission(user, "medical.records.view")}
        canViewCorrespondence={true}
        canViewMeetings={canViewMeetings}
        canViewTemplates={hasPermission(user, "templates.view")}
        canManageTemplates={hasPermission(user, "templates.manage")}
        canViewReports={hasPermission(user, "reports.view")}
      />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <Link href={`/${locale}/dashboard/correspondence/new`}>
          <Button className="inline-flex items-center gap-2"><Plus className="h-4 w-4 shrink-0" aria-hidden="true" />{t("addCorrespondence")}</Button>
        </Link>
      </div>

      <form className="dashboard-filter-toolbar mb-4">
        <input name="q" defaultValue={sp.q} placeholder={tCommon("search")} className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <MasterFilterSelect
          name="type"
          locale={locale === "ar" ? "ar" : "fr"}
          label={locale === "ar" ? "النوع:" : "Type :"}
          value={sp.type ?? ""}
          options={[{ id: "", label: tCommon("filter") }, { id: "INCOMING", label: t("incoming") }, { id: "OUTGOING", label: t("outgoing") }]}
          headerTitle={locale === "ar" ? "تصفية حسب النوع" : "Filtrer par type"}
        />
        <MasterFilterSelect
          name="status"
          locale={locale === "ar" ? "ar" : "fr"}
          label={tCommon("status")}
          value={sp.status ?? ""}
          options={[{ id: "", label: tCommon("status") }, ...["NEW", "IN_PROGRESS", "COMPLETED", "ARCHIVED"].map((s) => ({ id: s, label: t(`statuses.${s}` as any) }))]}
          headerTitle={locale === "ar" ? "تصفية حسب الحالة" : "Filtrer par statut"}
        />
        <MasterFilterSelect
          name="priority"
          locale={locale === "ar" ? "ar" : "fr"}
          label={t("fields.priority")}
          value={sp.priority ?? ""}
          options={[{ id: "", label: t("fields.priority") }, ...["LOW", "NORMAL", "HIGH", "URGENT"].map((p) => ({ id: p, label: t(`priorities.${p}` as any) }))]}
          headerTitle={locale === "ar" ? "تصفية حسب الأولوية" : "Filtrer par priorité"}
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
        <table className="w-full text-start text-sm">
          <thead className="border-b border-border bg-muted/50 text-start">
            <tr>
              <th className="px-4 py-2 text-start">{t("fields.referenceNumber")}</th>
              <th className="px-4 py-2 text-start">{t("fields.subject")}</th>
              <th className="px-4 py-2 text-start">{t("fields.type")}</th>
              <th className="px-4 py-2 text-start">{t("fields.date")}</th>
              <th className="px-4 py-2 text-start">{t("fields.priority")}</th>
              <th className="px-4 py-2 text-start">{tCommon("status")}</th>
              <th className="px-4 py-2 text-start">{tCommon("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2 font-mono text-xs">{c.referenceNumber}</td>
                <td className="px-4 py-2">{c.subject}</td>
                <td className="px-4 py-2">{c.type === "INCOMING" ? t("incoming") : t("outgoing")}</td>
                <td className="px-4 py-2">{new Intl.DateTimeFormat(locale).format(c.date)}</td>
                <td className="px-4 py-2">
                  <Badge tone={PRIORITY_TONE[c.priority]}>{t(`priorities.${c.priority}` as any)}</Badge>
                </td>
                <td className="px-4 py-2">
                  <Badge tone={STATUS_TONE[c.status]}>{t(`statuses.${c.status}` as any)}</Badge>
                </td>
                <td className="px-4 py-2">
                  <Link href={`/${locale}/dashboard/correspondence/${c.id}`} className="text-sm text-club-primary underline">
                    {tCommon("edit")}
                  </Link>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
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
            <Link href={`/${locale}/dashboard/correspondence?${new URLSearchParams({ ...sp, page: String(page - 1) } as any)}`} className="text-club-primary underline">
              ‹
            </Link>
          )}
          {page < totalPages && (
            <Link href={`/${locale}/dashboard/correspondence?${new URLSearchParams({ ...sp, page: String(page + 1) } as any)}`} className="text-club-primary underline">
              ›
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
