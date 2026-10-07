import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MasterFilterSelect } from "@/components/shared/master-filter-select";
import { setNewsStatusAction, deleteNewsAction } from "./actions";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Eye, EyeOff, Trash2, Edit, Plus} from "lucide-react";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  SCHEDULED: "warning",
  ARCHIVED: "danger"
};

export default async function NewsListPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await requirePagePermission("news.view", locale);
  const t = await getTranslations("news");
  const tCommon = await getTranslations("common");
  const canPublish = hasPermission(user, "news.publish");
  const canDelete = hasPermission(user, "news.delete");

  const articles = await db.news.findMany({
    where: sp.status ? { status: sp.status as any } : {},
    include: { translations: true },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <Link href={`/${locale}/dashboard/news/new`}>
          <Button className="inline-flex items-center gap-2"><Plus className="h-4 w-4 shrink-0" aria-hidden="true" />{t("addNews")}</Button>
        </Link>
      </div>

      <form className="dashboard-filter-toolbar mb-4">
        <MasterFilterSelect
          name="status"
          locale={locale === "ar" ? "ar" : "fr"}
          label={tCommon("status")}
          value={sp.status ?? ""}
          options={[{ id: "", label: tCommon("filter") }, ...["DRAFT", "PUBLISHED", "SCHEDULED"].map((s) => ({ id: s, label: s === "DRAFT" ? (locale === "ar" ? "مخفي / مسودة" : "Masqué / Brouillon") : t(`statuses.${s}` as any) }))]}
          headerTitle={locale === "ar" ? "تصفية حسب الحالة" : "Filtrer par statut"}
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
              <th className="px-4 py-3 text-center font-semibold">{t("fields.category")}</th>
              <th className="px-4 py-3 text-center font-semibold">{t("fields.status")}</th>
              <th className="px-4 py-3 text-center font-semibold">{tCommon("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((a) => {
              const title = a.translations.find((tr) => tr.locale === locale)?.title ?? a.translations[0]?.title ?? "—";
              async function publish() {
                "use server";
                await setNewsStatusAction(a.id, "PUBLISHED");
              }
              async function unpublish() {
                "use server";
                await setNewsStatusAction(a.id, "DRAFT");
              }
              async function remove() {
                "use server";
                await deleteNewsAction(a.id);
              }
              return (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{title}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{a.category ?? "—"}</td>
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
                        href={`/${locale}/dashboard/news/${a.id}`}
                        className="text-xs font-semibold text-club-primary hover:underline flex items-center gap-1"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        <span>{tCommon("edit")}</span>
                      </Link>

                      {canPublish && a.status === "PUBLISHED" && (
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

                      {canPublish && a.status !== "PUBLISHED" && (
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

                      {canDelete && (
                        <ConfirmDialog
                          title={locale === "ar" ? "تأكيد الحذف" : "Confirmer la suppression"}
                          body={locale === "ar" ? "هل أنت متأكد من حذف هذا الخبر نهائياً؟" : "Êtes-vous sûr de vouloir supprimer cet article ?"}
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
            {articles.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
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
