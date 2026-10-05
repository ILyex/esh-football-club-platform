import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/permissions";
import { createNewsAction } from "../actions";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MultiImageUploader } from "@/components/shared/multi-image-uploader";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { Save } from "lucide-react";

export default async function NewNewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requirePermission("news.create");
  const t = await getTranslations("news");
  const tCommon = await getTranslations("common");

  async function action(formData: FormData) {
    "use server";
    const { id } = await createNewsAction(formData);
    redirect(`/${locale}/dashboard/news/${id}`);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("addNews")}</h1>
      </div>
      <form action={action} encType="multipart/form-data" className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.title")} (AR)</label>
          <input name="titleAr" dir="rtl" required className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.content")} (AR)</label>
          <textarea name="contentAr" dir="rtl" rows={6} required className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.title")} (FR)</label>
          <input name="titleFr" dir="ltr" required className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.content")} (FR)</label>
          <textarea name="contentFr" dir="ltr" rows={6} required className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.category")}</label>
          <input name="category" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.tags")}</label>
          <input name="tags" placeholder="tag1, tag2" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.status")}</label>
          <select name="status" defaultValue="DRAFT" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="DRAFT">{locale === "ar" ? "مخفي / مسودة" : "Masqué / Brouillon"}</option>
            <option value="PUBLISHED">{locale === "ar" ? "منشور / مرئي" : "Publié / Visible"}</option>
            <option value="SCHEDULED">{locale === "ar" ? "مجدول" : "Programmé"}</option>
          </select>
        </div>
        <div>
          <DateTimeInput
            label={t("fields.scheduledFor")}
            name="scheduledFor"
            locale={locale}
          />
        </div>

        {/* Multi-Media Uploader (Images & Videos) */}
        <div className="col-span-2 pt-2">
          <MultiImageUploader
            name="images"
            locale={locale}
            label={locale === "ar" ? "وسائط الخبر (صور وفيديوهات مع المعاينة والترتيب - العنصر الأول هو الغلاف)" : "Médias de l'article (photos & vidéos)"}
            description={locale === "ar" ? "يمكنك رفع صور وفيديوهات قصيرة وخفيفة (MP4/WebM حتى 35MB)" : "Photos et vidéos légères (MP4/WebM max 35MB)"}
          />
        </div>

        <div className="col-span-2 pt-2 border-t border-border flex items-center gap-3">
          <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center gap-2 px-5 py-2 rounded-lg transition-colors shadow-xs">
            <Save className="h-4 w-4" />
            <span>{tCommon("save")}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
