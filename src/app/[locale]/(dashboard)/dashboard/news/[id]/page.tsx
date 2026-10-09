import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { notFound, redirect } from "next/navigation";
import { updateNewsAction, setNewsStatusAction, deleteNewsAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { MultiImageUploader } from "@/components/shared/multi-image-uploader";
import { NewsPublishingSettings } from "@/components/news/news-publishing-settings";
import { FrenchOnlyField } from "@/components/news/french-only-field";
import { ActionFeedbackForm } from "@/components/shared/action-feedback-form";
import { actionControlClass } from "@/components/shared/action-controls";
import { NewsTagsInput } from "@/components/news/news-tags-input";
import { FileText, Languages, Save, Settings2, Trash2, Eye, EyeOff } from "lucide-react";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  SCHEDULED: "warning",
  ARCHIVED: "danger"
};

export default async function NewsEditPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const user = await requirePagePermission("news.view", locale);
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
    return await updateNewsAction(id, formData);
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
    <div className="mx-auto w-full max-w-5xl space-y-5">
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
                  className={actionControlClass("hide")}
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
                  className={actionControlClass("publish")}
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>{locale === "ar" ? "إظهار / نشر" : "Publier"}</span>
                </Button>
              </form>
            )
          )}

        </div>
      </div>

      {news.featuredImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- external CDN URL, not a local /public asset
        <img src={news.featuredImageUrl} alt="" className="h-52 w-full rounded-xl object-cover border border-border shadow-xs" />
      )}

      {/* ── Edit Form ────────────────────────────────────────────── */}
      <ActionFeedbackForm
        action={update}
        encType="multipart/form-data"
        refreshOnSuccess
        successMessage={locale === "ar" ? "تم تحديث الخبر بنجاح" : "Actualité mise à jour avec succès"}
        errorMessage={locale === "ar" ? "تعذر تحديث الخبر" : "Échec de la mise à jour de l’actualité"}
        className="space-y-5"
      >
        <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-2 border-b border-border/70 pb-3 text-sm font-black text-foreground"><Languages className="h-4 w-4 text-club-primary" />{locale === "ar" ? "المحتوى متعدد اللغات" : "Contenu multilingue"}</div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-border/70 bg-background/50 p-4" dir="rtl">
              <p className="text-xs font-black text-club-primary">العربية</p>
              <label className="block text-xs font-bold text-foreground">{t("fields.title")}</label>
              <input name="titleAr" dir="rtl" defaultValue={ar?.title ?? ""} disabled={!canUpdate} className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm outline-none focus:border-club-primary focus:ring-2 focus:ring-club-primary/20 disabled:opacity-60" />
              <label className="block text-xs font-bold text-foreground">{t("fields.content")}</label>
              <textarea name="contentAr" dir="rtl" rows={9} defaultValue={ar?.content ?? ""} disabled={!canUpdate} className="w-full resize-y rounded-xl border border-border bg-background px-3.5 py-3 text-sm leading-7 outline-none focus:border-club-primary focus:ring-2 focus:ring-club-primary/20 disabled:opacity-60" />
            </div>
            <div className="space-y-3 rounded-xl border border-border/70 bg-background/50 p-4" dir="ltr">
              <p className="text-xs font-black text-club-primary">Français</p>
              <label className="block text-xs font-bold text-foreground">{t("fields.title")}</label>
              <FrenchOnlyField name="titleFr" locale={locale} defaultValue={fr?.title ?? ""} disabled={!canUpdate} />
              <label className="block text-xs font-bold text-foreground">{t("fields.content")}</label>
              <FrenchOnlyField name="contentFr" locale={locale} multiline defaultValue={fr?.content ?? ""} disabled={!canUpdate} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-2 border-b border-border/70 pb-3 text-sm font-black text-foreground"><Settings2 className="h-4 w-4 text-club-primary" />{locale === "ar" ? "إعدادات الخبر" : "Paramètres"}</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="mb-1.5 block text-xs font-bold">{t("fields.category")}</label><input name="category" defaultValue={news.category ?? ""} disabled={!canUpdate} className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm outline-none focus:border-club-primary focus:ring-2 focus:ring-club-primary/20 disabled:opacity-60" /></div>
            <div><label className="mb-1.5 block text-xs font-bold">{t("fields.tags")}</label><NewsTagsInput name="tags" locale={locale} defaultValue={news.tags.join(", ")} disabled={!canUpdate} /></div>
            <NewsPublishingSettings locale={locale} statusLabel={t("fields.status")} scheduledForLabel={t("fields.scheduledFor")} defaultStatus={news.status} defaultScheduledFor={news.scheduledFor} disabled={!canUpdate} />
          </div>
        </section>

        {/* ── Multi-Image Uploader with live preview & reordering ── */}
        {canUpdate && (
        <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-6">
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
        </section>
        )}

        {/* ── Action Buttons: Save (Green) and Delete (Red) side-by-side ── */}
        <div className="flex flex-wrap items-center gap-3 border-t border-border/70 pt-5">
          {canUpdate && (
            <Button
              type="submit"
              className="min-h-10 gap-2 rounded-xl bg-club-primary px-5 text-sm font-bold text-white shadow-sm hover:bg-club-primary-hover"
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
                className="min-h-10 gap-2 rounded-xl bg-red-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-red-700"
              >
                <Trash2 className="h-4 w-4" />
                <span>{tCommon("delete")}</span>
              </Button>
            </ConfirmDialog>
          )}
        </div>
      </ActionFeedbackForm>
    </div>
  );
}
