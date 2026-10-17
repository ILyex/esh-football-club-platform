import { getTranslations } from "next-intl/server";
import { requirePagePermission } from "@/lib/permissions";
import { getAuthorizedTeams } from "@/lib/team-context";
import { createAnnouncementAction } from "../actions";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MultiImageUploader } from "@/components/shared/multi-image-uploader";
import { DateInput } from "@/components/ui/date-input";
import { FormSelect } from "@/components/ui/form-select";
import { Save } from "lucide-react";

export default async function NewAnnouncementPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requirePagePermission("announcements.manage", locale);
  const t = await getTranslations("announcements");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");
  const teams = await getAuthorizedTeams();
  const isAr = locale === "ar";

  async function action(formData: FormData) {
    "use server";
    const { id } = await createAnnouncementAction(formData);
    redirect(`/${locale}/dashboard/announcements/${id}?created=1`);
  }

  const inputClass = "h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-club-primary/35 focus-visible:border-club-primary focus-visible:ring-2 focus-visible:ring-club-primary/20";
  const textareaClass = "min-h-36 w-full resize-y rounded-xl border border-border bg-background px-3.5 py-3 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-club-primary/35 focus-visible:border-club-primary focus-visible:ring-2 focus-visible:ring-club-primary/20";
  const labelClass = "mb-2 block text-xs font-semibold text-foreground";
  const priorityOptions = ["LOW", "NORMAL", "HIGH", "URGENT"].map((value) => ({ value, label: t(`priorities.${value}` as any) }));
  const statusOptions = ["DRAFT", "PUBLISHED", "SCHEDULED"].map((value) => ({
    value,
    label: value === "DRAFT"
      ? (isAr ? "مسودة / مخفي" : "Brouillon / masqué")
      : t(`statuses.${value}` as any)
  }));

  return (
    <div dir={isAr ? "rtl" : "ltr"} className="mx-auto w-full max-w-5xl space-y-5">
      <header className="border-b border-border/70 pb-4">
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">{t("addAnnouncement")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAr ? "أدخل نص الإعلان وحدد ظهوره والفئة المعنية." : "Rédigez l’annonce et définissez sa visibilité et sa catégorie."}
        </p>
      </header>

      <form action={action} encType="multipart/form-data" className="space-y-5">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
          <div className="mb-5 border-b border-border/70 pb-3">
            <h2 className="text-sm font-bold text-foreground">{isAr ? "محتوى الإعلان" : "Contenu de l’annonce"}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{isAr ? "اكتب النص بالعربية والفرنسية ليظهر حسب لغة الموقع." : "Renseignez les deux langues pour l’affichage sur le site."}</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4 rounded-xl border border-border/70 bg-background/30 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-foreground">{isAr ? "العربية" : "Arabe"}</h3>
                <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">AR</span>
              </div>
              <div>
                <label htmlFor="titleAr" className={labelClass}>{t("fields.title")} <span className="text-destructive">*</span></label>
                <input id="titleAr" name="titleAr" dir="rtl" required maxLength={180} className={inputClass} />
              </div>
              <div>
                <label htmlFor="contentAr" className={labelClass}>{t("fields.content")} <span className="text-destructive">*</span></label>
                <textarea id="contentAr" name="contentAr" dir="rtl" rows={5} required maxLength={10000} className={textareaClass} />
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-border/70 bg-background/30 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-foreground">{isAr ? "الفرنسية" : "Français"}</h3>
                <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">FR</span>
              </div>
              <div>
                <label htmlFor="titleFr" className={labelClass}>{t("fields.title")} <span className="text-destructive">*</span></label>
                <input id="titleFr" name="titleFr" dir="ltr" required maxLength={180} className={inputClass} />
              </div>
              <div>
                <label htmlFor="contentFr" className={labelClass}>{t("fields.content")} <span className="text-destructive">*</span></label>
                <textarea id="contentFr" name="contentFr" dir="ltr" rows={5} required maxLength={10000} className={textareaClass} />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
          <div className="mb-5 border-b border-border/70 pb-3">
            <h2 className="text-sm font-bold text-foreground">{isAr ? "النشر والاستهداف" : "Publication et ciblage"}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{isAr ? "حدد أولوية الإعلان ومدته ومكان عرضه." : "Choisissez la priorité, la période et l’emplacement."}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className={labelClass}>{t("fields.priority")}</label>
              <FormSelect name="priority" defaultValue="NORMAL" locale={locale} ariaLabel={t("fields.priority")} options={priorityOptions} />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>{t("fields.team")}</label>
              <FormSelect name="teamId" defaultValue="" locale={locale} ariaLabel={t("fields.team")} placeholder={t("clubWide")} options={[{ value: "", label: t("clubWide") }, ...teams.map((team) => ({ value: team.id, label: tTeams(`categories.${team.category}` as any) }))]} />
            </div>
            <div className="space-y-2">
              <DateInput label={t("fields.startDate")} name="startDate" required defaultValue={new Date()} locale={locale} className="space-y-2" />
            </div>
            <div className="space-y-2">
              <DateInput label={t("fields.endDate")} name="endDate" locale={locale} className="space-y-2" />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>{t("fields.status")}</label>
              <FormSelect name="status" defaultValue="PUBLISHED" locale={locale} ariaLabel={t("fields.status")} options={statusOptions} />
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border bg-background/50 px-3.5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-club-primary/35 hover:bg-club-primary/[0.035]">
              <input type="hidden" name="homepageVisibility" value="false" />
              <input name="homepageVisibility" type="checkbox" value="true" defaultChecked className="h-4 w-4 shrink-0 accent-club-primary focus-visible:ring-2 focus-visible:ring-club-primary/30" />
              <span>{t("fields.homepageVisibility")}</span>
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
          <MultiImageUploader
            name="images"
            locale={locale}
            label={isAr ? "صور وملصقات الإعلان" : "Images et affiches de l’annonce"}
            description={isAr ? "أضف عدة صور، ثم عاينها ورتبها قبل الحفظ." : "Ajoutez plusieurs images, puis prévisualisez-les et organisez-les avant l’enregistrement."}
          />
        </section>

        <div className="flex flex-wrap items-center justify-start gap-3 border-t border-border/70 pt-4">
          <Button type="submit" className="h-10 gap-2 rounded-xl px-5 font-semibold">
            <Save className="h-4 w-4" aria-hidden="true" />
            <span>{tCommon("save")}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
