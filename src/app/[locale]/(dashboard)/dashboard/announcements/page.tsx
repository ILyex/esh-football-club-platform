import { DashboardTeamCategorySelect } from "@/components/shared/dashboard-team-category-select";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { getEffectiveTeamId, getAuthorizedTeams } from "@/lib/team-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setAnnouncementStatusAction, deleteAnnouncementAction } from "./actions";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Eye, EyeOff, Trash2, Edit } from "lucide-react";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  SCHEDULED: "warning",
  ARCHIVED: "danger"
};
const PRIORITY_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  LOW: "neutral",
  NORMAL: "neutral",
  HIGH: "warning",
  URGENT: "danger"
};

export default async function AnnouncementsListPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ team?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await requirePermission("announcements.view");
  const t = await getTranslations("announcements");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");
  const canManage = hasPermission(user, "announcements.manage");

  const effectiveTeamId = await getEffectiveTeamId(sp.team);

  const [announcements, teams] = await Promise.all([
    db.announcement.findMany({
      where: effectiveTeamId ? { teamId: effectiveTeamId } : {},
      include: { translations: true, team: true },
      orderBy: { startDate: "desc" },
      take: 100
    }),
    getAuthorizedTeams()
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        {canManage && (
          <Link href={`/${locale}/dashboard/announcements/new`}>
            <Button>{t("addAnnouncement")}</Button>
          </Link>
        )}
      </div>

      <form className="dashboard-filter-toolbar mb-4">
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

      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-xs">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-start font-semibold">{t("fields.title")}</th>
              <th className="px-4 py-3 text-center font-semibold">{t("fields.team")}</th>
              <th className="px-4 py-3 text-center font-semibold">{t("fields.priority")}</th>
              <th className="px-4 py-3 text-center font-semibold">{t("fields.status")}</th>
              <th className="px-4 py-3 text-center font-semibold">{tCommon("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {announcements.map((a) => {
              const title = a.translations.find((tr) => tr.locale === locale)?.title ?? a.translations[0]?.title ?? "—";
              async function publish() {
                "use server";
                await setAnnouncementStatusAction(a.id, "PUBLISHED");
              }
              async function unpublish() {
                "use server";
                await setAnnouncementStatusAction(a.id, "DRAFT");
              }
              async function remove() {
                "use server";
                await deleteAnnouncementAction(a.id);
              }
              return (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{title}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{a.team ? tTeams(`categories.${a.team.category}` as any) : t("clubWide")}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge tone={PRIORITY_TONE[a.priority]}>{t(`priorities.${a.priority}` as any)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge tone={STATUS_TONE[a.status]}>
                      {a.status === "DRAFT"
                        ? (locale === "ar" ? "مخفي / مسودة" : "Masqué")
                        : t(`statuses.${a.status}` as any)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <Link
                        href={`/${locale}/dashboard/announcements/${a.id}`}
                        className="text-xs font-semibold text-club-primary hover:underline flex items-center gap-1"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        <span>{tCommon("edit")}</span>
                      </Link>

                      {canManage && a.status === "PUBLISHED" && (
                        <form action={unpublish}>
                          <button
                            type="submit"
                            className="text-xs font-medium text-amber-600 hover:text-amber-700 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <EyeOff className="h-3.5 w-3.5" />
                            <span>{locale === "ar" ? "إخفاء" : "Masquer"}</span>
                          </button>
                        </form>
                      )}

                      {canManage && a.status !== "PUBLISHED" && (
                        <form action={publish}>
                          <button
                            type="submit"
                            className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>{locale === "ar" ? "إظهار" : "Publier"}</span>
                          </button>
                        </form>
                      )}

                      {canManage && (
                        <ConfirmDialog
                          title={locale === "ar" ? "تأكيد الحذف" : "Confirmer la suppression"}
                          body={locale === "ar" ? "هل أنت متأكد من حذف هذا الإعلان نهائياً؟" : "Êtes-vous sûr de vouloir supprimer cette annonce ?"}
                          onConfirm={remove}
                        >
                          <button
                            type="button"
                            className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>{tCommon("delete")}</span>
                          </button>
                        </ConfirmDialog>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {announcements.length === 0 && (
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
