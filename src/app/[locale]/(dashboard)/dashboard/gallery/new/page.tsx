import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions";
import { createAlbumAction } from "../actions";
import { NewAlbumForm } from "@/components/gallery/new-album-form";
import { uploadMediaAction } from "../actions";

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

  async function create(formData: FormData) {
    "use server";
    return createAlbumAction(formData);
  }
  async function upload(albumId: string, formData: FormData) {
    "use server";
    return uploadMediaAction(albumId, formData);
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div className="flex items-center justify-between border-b border-border/70 pb-4">
        <div>
          <h1 className="text-xl font-black tracking-tight text-foreground">{t("addAlbum")}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{locale === "ar" ? "أنشئ ألبومًا جديدًا ونظّم وسائطه قبل النشر." : "Créez un album et organisez ses médias avant publication."}</p>
        </div>
      </div>
      <NewAlbumForm
        locale={locale}
        categoryOptions={categoryOptions}
        teamOptions={teamOptions}
        saveLabel={tCommon("save")}
        createAction={create}
        uploadAction={upload}
      />
    </div>
  );
}
