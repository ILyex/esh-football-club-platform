import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { notFound, redirect } from "next/navigation";
import { updateNewsAction, setNewsStatusAction, deleteNewsAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NewsPreviewModal } from "@/components/news/news-preview-modal";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { MultiImageUploader } from "@/components/shared/multi-image-uploader";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { Save, Trash2, Eye, EyeOff } from "lucide-react";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  SCHEDULED: "warning",
  ARCHIVED: "danger"
};

export default async function NewsEditPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const user = await requirePermission("news.view");
  const t = await getTranslations("news");
  const tCommon = await getTranslations("common");
  const canUpdate = hasPermission(user, "news.update");
  const canPublish = hasPermission(user, "news.publish");
  const canDelete = hasPermission(user, "news.delete");

  const news = await db.news.findUnique({ where: { id }, include: { translations: true } });
  if (!news) notFound();

  const ar = news.translations.find((tr) => tr.locale === "ar");
  const fr = news.translations.find((tr) => tr.locale === "fr");

  async function update(formData: FormData) {
    "use server";
    await updateNewsAction(id, formData);
  }
  async function publish() {
    "use server";
    await setNewsStatusAction(id, "PUBLISHED");
  }
  async function unpublish() {
    "use server";
    await setNewsStatusAction(id, "DRAFT");
  }
  async function removeNews() {
    "use server";
    await deleteNewsAction(id);
    redirect(`/${locale}/dashboard/news`);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ── Header Bar ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card shadow-xs">
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-bold text-foreground">{ar?.title ?? fr?.title}</h1>
          <Badge tone={STATUS_TONE[news.status]}>
            {news.status === "DRAFT"
              ? (locale === "ar" ? "مخفي / مسودة" : "Masqué")
              : t(`statuses.${news.status}` as any)}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {canPublish && (
            news.status === "PUBLISHED" ? (
              <form action={unpublish}>
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                >
                  <EyeOff className="h-3.5 w-3.5" />
                  <span>{locale === "ar" ? "إخفاء الخبر" : "Masquer"}</span>
                </Button>
              </form>
            ) : (
              <form action={publish}>
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>{locale === "ar" ? "إظهار / نشر" : "Publier"}</span>
                </Button>
              </form>
            )
          )}

          <NewsPreviewModal
            locale={locale}
            titleAr={ar?.title}
            contentAr={ar?.content}
            titleFr={fr?.title}
            contentFr={fr?.content}
            category={news.category}
            tags={news.tags}
            imageUrl={news.featuredImageUrl}
            status={news.status}
            scheduledFor={news.scheduledFor}
          />
        </div>
      </div>

      {news.featuredImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- external CDN URL, not a local /public asset
        <img src={news.featuredImageUrl} alt="" className="h-52 w-full rounded-xl object-cover border border-border shadow-xs" />
      )}

      {/* ── Edit Form ────────────────────────────────────────────── */}
      <form action={update} encType="multipart/form-data" className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="col-span-1 md:col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.title")} (AR)</label>
          <input name="titleAr" dir="rtl" defaultValue={ar?.title} disabled={!canUpdate} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60" />
        </div>
        <div className="col-span-1 md:col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.content")} (AR)</label>
          <textarea name="contentAr" dir="rtl" rows={6} defaultValue={ar?.content} disabled={!canUpdate} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60" />
        </div>
        <div className="col-span-1 md:col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.title")} (FR)</label>
          <input name="titleFr" dir="ltr" defaultValue={fr?.title} disabled={!canUpdate} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60" />
        </div>
        <div className="col-span-1 md:col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.content")} (FR)</label>
          <textarea name="contentFr" dir="ltr" rows={6} defaultValue={fr?.content} disabled={!canUpdate} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.category")}</label>
          <input name="category" defaultValue={news.category ?? ""} disabled={!canUpdate} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.tags")}</label>
          <input name="tags" defaultValue={news.tags.join(", ")} disabled={!canUpdate} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.status")}</label>
          <select name="status" defaultValue={news.status} disabled={!canUpdate} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60">
            <option value="DRAFT">{locale === "ar" ? "مخفي / مسودة" : "Masqué / Brouillon"}</option>
            <option value="PUBLISHED">{locale === "ar" ? "منشور / مرئي" : "Publié / Visible"}</option>
            <option value="SCHEDULED">{locale === "ar" ? "مجدول" : "Programmé"}</option>
          </select>
        </div>
        <div>
          <DateTimeInput
            label={t("fields.scheduledFor")}
            name="scheduledFor"
            defaultValue={news.scheduledFor}
            disabled={!canUpdate}
            locale={locale}
          />
        </div>

        {/* ── Multi-Image Uploader with live preview & reordering ── */}
        {canUpdate && (
          <div className="col-span-1 md:col-span-2 pt-2">
            <MultiImageUploader
              name="images"
              locale={locale}
              existingImages={
                news.imageUrls && news.imageUrls.length > 0
                  ? news.imageUrls.map((url) => ({ url }))
                  : (news.featuredImageUrl ? [{ url: news.featuredImageUrl }] : [])
              }
              label={locale === "ar" ? "وسائط الخبر (صور وفيديوهات مع المعاينة والترتيب - العنصر الأول هو الغلاف)" : "Médias de l'article (photos & vidéos)"}
              description={locale === "ar" ? "يمكنك رفع صور وفيديوهات قصيرة وخفيفة (MP4/WebM حتى 35MB)" : "Photos et vidéos légères (MP4/WebM max 35MB)"}
            />
          </div>
        )}

        {/* ── Action Buttons: Save (Green) and Delete (Red) side-by-side ── */}
        <div className="col-span-1 md:col-span-2 pt-4 border-t border-border flex flex-wrap items-center gap-3">
          {canUpdate && (
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center gap-2 px-5 py-2 rounded-lg transition-colors shadow-xs"
            >
              <Save className="h-4 w-4" />
              <span>{tCommon("save")}</span>
            </Button>
          )}

          {canDelete && (
            <ConfirmDialog
              title={locale === "ar" ? "تأكيد الحذف النهائي" : "Confirmation de suppression"}
              body={locale === "ar" ? "هل أنت متأكد من حذف هذا الخبر نهائياً؟ لا يمكن التراجع عن هذا الإجراء." : "Êtes-vous sûr de vouloir supprimer définitivement cet article ? Cette action est irréversible."}
              onConfirm={removeNews}
            >
              <Button
                type="button"
                variant="destructive"
                className="bg-red-600 hover:bg-red-700 text-white font-medium flex items-center gap-2 px-5 py-2 rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                <span>{tCommon("delete")}</span>
              </Button>
            </ConfirmDialog>
          )}
        </div>
      </form>
    </div>
  );
}
