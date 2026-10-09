import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions";
import { createAlbumAction } from "../actions";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MultiImageUploader } from "@/components/shared/multi-image-uploader";
import { FormSelect } from "@/components/ui/form-select";
import { GalleryActionForm } from "@/components/gallery/gallery-action-form";
import { Save } from "lucide-react";

const CATEGORIES = ["MATCHES", "TRAINING", "TEAM", "EVENTS", "CLUB"] as const;

export default async function NewAlbumPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requirePagePermission("gallery.manage", locale);
  const t = await getTranslations("gallery");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");

  const teams = await db.team.findMany({ orderBy: { category: "asc" } });
  const categoryOptions = CATEGORIES.map((category) => ({
    value: category,
    label: t(`categories.${category}` as any)
  }));
  const teamOptions = [
    { value: "", label: locale === "ar" ? "بدون فريق" : "Sans équipe" },
    ...teams.map((team) => ({
      value: team.id,
      label: tTeams(`categories.${team.category}` as any)
    }))
  ];

  async function action(formData: FormData) {
    "use server";
    return createAlbumAction(formData);
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div className="flex items-center justify-between border-b border-border/70 pb-4">
        <div>
          <h1 className="text-xl font-black tracking-tight text-foreground">{t("addAlbum")}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{locale === "ar" ? "أنشئ ألبومًا جديدًا ونظّم وسائطه قبل النشر." : "Créez un album et organisez ses médias avant publication."}</p>
        </div>
      </div>
      <GalleryActionForm action={action} successMessage={locale === "ar" ? "تم حفظ الألبوم بنجاح" : "Album enregistré avec succès"} errorMessage={locale === "ar" ? "تعذر حفظ الألبوم" : "Impossible d’enregistrer l’album"} redirectTo={`/${locale}/dashboard/gallery`} encType="multipart/form-data" className="grid grid-cols-1 gap-5 rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:grid-cols-2 sm:p-6">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-bold text-foreground">{t("fields.albumTitle")}</label>
          <input name="name" required className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground shadow-2xs outline-none transition-colors placeholder:text-muted-foreground focus:border-club-primary focus:ring-2 focus:ring-club-primary/20" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold text-foreground">{t("fields.category")}</label>
          <FormSelect name="category" required locale={locale} options={categoryOptions} ariaLabel={t("fields.category")} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold text-foreground">{t("fields.team")}</label>
          <FormSelect name="teamId" locale={locale} options={teamOptions} ariaLabel={t("fields.team")} />
        </div>
        <label className="group sm:col-span-2 inline-flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/70 bg-background px-3.5 text-xs font-semibold text-foreground">
          <input type="hidden" name="published" value="false" />
          <span className="group-has-[:checked]:hidden">{locale === "ar" ? "غير منشور" : "Non publié"}</span>
          <span className="hidden group-has-[:checked]:inline">{locale === "ar" ? "منشور" : "Publié"}</span>
          <span className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-muted transition-colors has-[:checked]:bg-club-primary">
            <input name="published" type="checkbox" defaultChecked className="peer sr-only" />
            <span className="pointer-events-none absolute start-1 h-4 w-4 rounded-full bg-white shadow-sm transition-[inset-inline-start] peer-checked:start-6" />
          </span>
        </label>

        {/* Multi-Image and Video Uploader with live preview and reordering */}
        <div className="sm:col-span-2 pt-2">
          <MultiImageUploader
            name="images"
            locale={locale}
            label={locale === "ar" ? "وسائط الألبوم (صور وفيديوهات مع المعاينة والترتيب - العنصر الأول هو الغلاف)" : "Médias de l'album (photos & vidéos)"}
            description={locale === "ar" ? "يمكنك رفع صور وفيديوهات قصيرة وخفيفة (MP4/WebM حتى 35MB)" : "Photos et vidéos légères (MP4/WebM max 35MB)"}
          />
        </div>

        <div className="sm:col-span-2 flex items-center gap-3 border-t border-border/70 pt-5">
          <Button
            type="submit"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-club-primary px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-club-primary-hover"
          >
            <Save className="h-4 w-4" />
            <span>{tCommon("save")}</span>
          </Button>
        </div>
      </GalleryActionForm>
    </div>
  );
}
