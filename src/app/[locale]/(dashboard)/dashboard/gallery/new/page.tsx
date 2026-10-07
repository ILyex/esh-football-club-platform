import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions";
import { createAlbumAction } from "../actions";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MultiImageUploader } from "@/components/shared/multi-image-uploader";
import { Save } from "lucide-react";

const CATEGORIES = ["MATCHES", "TRAINING", "TEAM", "EVENTS", "CLUB"] as const;

export default async function NewAlbumPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requirePagePermission("gallery.manage", locale);
  const t = await getTranslations("gallery");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");

  const teams = await db.team.findMany({ orderBy: { category: "asc" } });

  async function action(formData: FormData) {
    "use server";
    const { id } = await createAlbumAction(formData);
    redirect(`/${locale}/dashboard/gallery/${id}`);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("addAlbum")}</h1>
      </div>
      <form action={action} encType="multipart/form-data" className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.albumTitle")}</label>
          <input name="name" required className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.category")}</label>
          <select name="category" required className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}` as any)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.team")}</label>
          <select name="teamId" defaultValue="" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="">—</option>
            {teams.map((tm) => (
              <option key={tm.id} value={tm.id}>
                {tTeams(`categories.${tm.category}` as any)}
              </option>
            ))}
          </select>
        </div>
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input name="published" type="checkbox" defaultChecked /> {t("fields.published")}
        </label>

        {/* Multi-Image and Video Uploader with live preview and reordering */}
        <div className="col-span-2 pt-2">
          <MultiImageUploader
            name="images"
            locale={locale}
            label={locale === "ar" ? "وسائط الألبوم (صور وفيديوهات مع المعاينة والترتيب - العنصر الأول هو الغلاف)" : "Médias de l'album (photos & vidéos)"}
            description={locale === "ar" ? "يمكنك رفع صور وفيديوهات قصيرة وخفيفة (MP4/WebM حتى 35MB)" : "Photos et vidéos légères (MP4/WebM max 35MB)"}
          />
        </div>

        <div className="col-span-2 pt-2 border-t border-border flex items-center gap-3">
          <Button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center gap-2 px-5 py-2 rounded-lg transition-colors shadow-xs"
          >
            <Save className="h-4 w-4" />
            <span>{tCommon("save")}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
