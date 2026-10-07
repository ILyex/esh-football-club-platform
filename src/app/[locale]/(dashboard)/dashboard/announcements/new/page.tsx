import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions";
import { getAuthorizedTeams } from "@/lib/team-context";
import { createAnnouncementAction } from "../actions";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MultiImageUploader } from "@/components/shared/multi-image-uploader";
import { DateInput } from "@/components/ui/date-input";
import { Save } from "lucide-react";

export default async function NewAnnouncementPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requirePagePermission("announcements.manage", locale);
  const t = await getTranslations("announcements");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");

  const teams = await getAuthorizedTeams();

  async function action(formData: FormData) {
    "use server";
    const { id } = await createAnnouncementAction(formData);
    redirect(`/${locale}/dashboard/announcements/${id}`);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("addAnnouncement")}</h1>
      </div>
      <form action={action} encType="multipart/form-data" className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.title")} (AR)</label>
          <input name="titleAr" dir="rtl" required className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.content")} (AR)</label>
          <textarea name="contentAr" dir="rtl" rows={4} required className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.title")} (FR)</label>
          <input name="titleFr" dir="ltr" required className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.content")} (FR)</label>
          <textarea name="contentFr" dir="ltr" rows={4} required className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.priority")}</label>
          <select name="priority" defaultValue="NORMAL" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            {["LOW", "NORMAL", "HIGH", "URGENT"].map((p) => (
              <option key={p} value={p}>
                {t(`priorities.${p}` as any)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.team")}</label>
          <select name="teamId" defaultValue="" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="">{t("clubWide")}</option>
            {teams.map((tm) => (
              <option key={tm.id} value={tm.id}>
                {tTeams(`categories.${tm.category}` as any)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <DateInput
            label={t("fields.startDate")}
            name="startDate"
            required
            defaultValue={new Date()}
            locale={locale}
          />
        </div>
        <div>
          <DateInput
            label={t("fields.endDate")}
            name="endDate"
            locale={locale}
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input name="homepageVisibility" type="checkbox" defaultChecked /> {t("fields.homepageVisibility")}
        </label>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.status")}</label>
          <select name="status" defaultValue="DRAFT" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="DRAFT">{locale === "ar" ? "مخفي / مسودة" : "Masqué / Brouillon"}</option>
            <option value="PUBLISHED">{locale === "ar" ? "منشور / مرئي" : "Publié / Visible"}</option>
            <option value="SCHEDULED">{locale === "ar" ? "مجدول" : "Programmé"}</option>
          </select>
        </div>

        {/* Multi-Image Uploader */}
        <div className="col-span-2 pt-2">
          <MultiImageUploader
            name="images"
            locale={locale}
            label={locale === "ar" ? "صور وملصقات الإعلان (إضافة متعددة، معاينة وترتيب)" : "Photos et affiches de l'annonce"}
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
