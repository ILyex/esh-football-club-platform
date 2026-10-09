import { getTranslations } from "next-intl/server";
import { requirePagePermission } from "@/lib/permissions";
import { createNewsAction } from "../actions";
import { Button } from "@/components/ui/button";
import { MultiImageUploader } from "@/components/shared/multi-image-uploader";
import { FileText, Languages, Save, Settings2 } from "lucide-react";
import { NewsPublishingSettings } from "@/components/news/news-publishing-settings";
import { FrenchOnlyField } from "@/components/news/french-only-field";
import { ActionFeedbackForm } from "@/components/shared/action-feedback-form";
import { NewsTagsInput } from "@/components/news/news-tags-input";

export default async function NewNewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requirePagePermission("news.create", locale);
  const t = await getTranslations("news");
  const tCommon = await getTranslations("common");

  async function action(formData: FormData) {
    "use server";
    return await createNewsAction(formData);
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div className="border-b border-border/70 pb-4">
        <div className="flex items-center gap-2 text-club-primary">
          <FileText className="h-4 w-4" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-wider">{t("title")}</span>
        </div>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-foreground">{t("addNews")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{locale === "ar" ? "أنشئ خبرًا باللغتين مع وسائطه وحالته قبل النشر." : "Créez une actualité bilingue avec ses médias et son statut."}</p>
      </div>
      <ActionFeedbackForm
        action={action}
        encType="multipart/form-data"
        resetOnSuccess
        successMessage={locale === "ar" ? "تم حفظ الخبر بنجاح" : "Actualité enregistrée avec succès"}
        errorMessage={locale === "ar" ? "تعذر حفظ الخبر" : "Échec de l’enregistrement de l’actualité"}
        className="space-y-5"
      >
        <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-2 border-b border-border/70 pb-3 text-sm font-black text-foreground"><Languages className="h-4 w-4 text-club-primary" />{locale === "ar" ? "المحتوى متعدد اللغات" : "Contenu multilingue"}</div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-border/70 bg-background/50 p-4" dir="rtl">
              <p className="text-xs font-black text-club-primary">العربية</p>
              <label className="block text-xs font-bold text-foreground">{t("fields.title")}</label>
              <input name="titleAr" dir="rtl" required className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm outline-none focus:border-club-primary focus:ring-2 focus:ring-club-primary/20" />
              <label className="block text-xs font-bold text-foreground">{t("fields.content")}</label>
              <textarea name="contentAr" dir="rtl" rows={9} required className="w-full resize-y rounded-xl border border-border bg-background px-3.5 py-3 text-sm leading-7 outline-none focus:border-club-primary focus:ring-2 focus:ring-club-primary/20" />
            </div>
            <div className="space-y-3 rounded-xl border border-border/70 bg-background/50 p-4" dir="ltr">
              <p className="text-xs font-black text-club-primary">Français</p>
              <label className="block text-xs font-bold text-foreground">{t("fields.title")}</label>
              <FrenchOnlyField name="titleFr" locale={locale} required />
              <label className="block text-xs font-bold text-foreground">{t("fields.content")}</label>
              <FrenchOnlyField name="contentFr" locale={locale} multiline required />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-2 border-b border-border/70 pb-3 text-sm font-black text-foreground"><Settings2 className="h-4 w-4 text-club-primary" />{locale === "ar" ? "إعدادات الخبر" : "Paramètres"}</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="mb-1.5 block text-xs font-bold">{t("fields.category")}</label><input name="category" className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm outline-none focus:border-club-primary focus:ring-2 focus:ring-club-primary/20" /></div>
            <div><label className="mb-1.5 block text-xs font-bold">{t("fields.tags")}</label><NewsTagsInput name="tags" locale={locale} /></div>
            <NewsPublishingSettings locale={locale} defaultStatus="PUBLISHED" statusLabel={t("fields.status")} scheduledForLabel={t("fields.scheduledFor")} />
          </div>
        </section>

        {/* Multi-Media Uploader (Images & Videos) */}
        <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-6">
          <MultiImageUploader
            name="images"
            locale={locale}
            label={locale === "ar" ? "وسائط الخبر (صور وفيديوهات مع المعاينة والترتيب - العنصر الأول هو الغلاف)" : "Médias de l'article (photos & vidéos)"}
            description={locale === "ar" ? "يمكنك رفع صور وفيديوهات قصيرة وخفيفة (MP4/WebM حتى 35MB)" : "Photos et vidéos légères (MP4/WebM max 35MB)"}
          />
        </section>

        <div className="flex items-center gap-3 border-t border-border/70 pt-5">
          <Button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-club-primary px-5 text-sm font-bold text-white shadow-sm hover:bg-club-primary-hover">
            <Save className="h-4 w-4" />
            <span>{tCommon("save")}</span>
          </Button>
        </div>
      </ActionFeedbackForm>
    </div>
  );
}
