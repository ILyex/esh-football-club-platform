import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { notFound, redirect } from "next/navigation";
import { updateAnnouncementAction, setAnnouncementStatusAction, deleteAnnouncementAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { actionControlClass } from "@/components/shared/action-controls";
import { MultiImageUploader } from "@/components/shared/multi-image-uploader";
import { DateInput } from "@/components/ui/date-input";
import { FormSelect } from "@/components/ui/form-select";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Eye, EyeOff, ImagePlus, Languages, Megaphone, Save, Settings2, Trash2 } from "lucide-react";
import { AnnouncementCreatedNotice } from "@/components/announcements/announcement-created-notice";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  SCHEDULED: "warning",
  ARCHIVED: "danger"
};

export default async function AnnouncementEditPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ created?: string }> }) {
  const [{ locale, id }, query] = await Promise.all([params, searchParams]);
  const user = await requirePagePermission("announcements.view", locale);
  const t = await getTranslations("announcements");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");
  const canManage = hasPermission(user, "announcements.manage");

  const [announcement, teams] = await Promise.all([
    db.announcement.findUnique({ where: { id }, include: { translations: true } }),
    db.team.findMany({ orderBy: { category: "asc" } })
  ]);
  if (!announcement) notFound();

  const ar = announcement.translations.find((tr) => tr.locale === "ar");
  const fr = announcement.translations.find((tr) => tr.locale === "fr");
  const isAr = locale === "ar";
  const inputClass = "h-12 w-full rounded-xl border border-border/80 bg-background/75 px-4 text-sm text-foreground shadow-inner shadow-black/[0.025] outline-none transition duration-200 placeholder:text-muted-foreground/70 hover:border-club-primary/40 focus-visible:border-club-primary focus-visible:ring-4 focus-visible:ring-club-primary/10 disabled:cursor-not-allowed disabled:opacity-60";
  const textareaClass = "min-h-36 w-full resize-y rounded-xl border border-border/80 bg-background/75 px-4 py-3.5 text-sm leading-7 text-foreground shadow-inner shadow-black/[0.025] outline-none transition duration-200 placeholder:text-muted-foreground/70 hover:border-club-primary/40 focus-visible:border-club-primary focus-visible:ring-4 focus-visible:ring-club-primary/10 disabled:cursor-not-allowed disabled:opacity-60";
  const labelClass = "mb-2 block text-xs font-bold tracking-wide text-foreground";
  const sectionHeadingClass = "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-club-primary/20 bg-club-primary/10 text-club-primary";
  const selectClass = "!min-h-12 !rounded-xl !border-border/80 !bg-background/75 !px-4 !shadow-inner !shadow-black/[0.025] hover:!border-club-primary/40 focus-visible:!ring-4 focus-visible:!ring-club-primary/10";
  const priorityOptions = ["LOW", "NORMAL", "HIGH", "URGENT"].map((value) => ({ value, label: t(`priorities.${value}` as any) }));
  const statusOptions = ["DRAFT", "PUBLISHED", "SCHEDULED"].map((value) => ({
    value,
    label: value === "DRAFT"
      ? (isAr ? "مسودة / مخفي" : "Brouillon / masqué")
      : t(`statuses.${value}` as any)
  }));

  async function update(formData: FormData) {
    "use server";
    await updateAnnouncementAction(id, formData);
  }
  async function publish() {
    "use server";
    await setAnnouncementStatusAction(id, "PUBLISHED");
  }
  async function unpublish() {
    "use server";
    await setAnnouncementStatusAction(id, "DRAFT");
  }
  async function removeAnnouncement() {
    "use server";
    await deleteAnnouncementAction(id);
    redirect(`/${locale}/dashboard/announcements`);
  }

  return (
    <div dir={isAr ? "rtl" : "ltr"} className="mx-auto w-full max-w-6xl space-y-5 pb-6">
      <AnnouncementCreatedNotice locale={locale} created={query.created === "1"} />
      <header className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-5">
        <div aria-hidden="true" className="pointer-events-none absolute -end-12 -top-20 h-48 w-48 rounded-full bg-club-primary/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-club-primary/25 bg-gradient-to-br from-club-primary/20 to-club-primary/5 text-club-primary shadow-sm">
            <Megaphone className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-lg font-extrabold tracking-tight text-foreground sm:text-xl">{isAr ? "تعديل الإعلان" : "Modifier l’annonce"}</h1>
              <Badge tone={STATUS_TONE[announcement.status]}>
                {announcement.status === "DRAFT"
                  ? (isAr ? "مسودة / مخفي" : "Masqué / Brouillon")
                  : t(`statuses.${announcement.status}` as any)}
              </Badge>
            </div>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{ar?.title ?? fr?.title} · {isAr ? "حدّث المحتوى وحدد الجمهور وموعد الظهور." : "Mettez à jour le contenu, le public et la période de diffusion."}</p>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Link href={`/${locale}/dashboard/announcements`} className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-background/70 px-3 text-xs font-semibold text-muted-foreground transition hover:border-club-primary/40 hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
            <span>{isAr ? "العودة للإعلانات" : "Retour aux annonces"}</span>
          </Link>
          {canManage && (
            announcement.status === "PUBLISHED" ? (
              <form action={unpublish}>
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className={actionControlClass("hide")}
                >
                  <EyeOff className="h-3.5 w-3.5" />
                  <span>{locale === "ar" ? "إخفاء الإعلان" : "Masquer"}</span>
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
      </header>

      <form action={update} encType="multipart/form-data" className="space-y-5">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
          <div className="mb-5 flex items-center gap-3 border-b border-border/70 pb-4">
            <span className={sectionHeadingClass}><Languages className="h-5 w-5" aria-hidden="true" /></span>
            <div><h2 className="text-sm font-bold text-foreground">{isAr ? "محتوى الإعلان" : "Contenu de l’annonce"}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{isAr ? "حدّث العنوان والنص بالعربية والفرنسية." : "Mettez à jour le titre et le texte en arabe et en français."}</p></div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4 rounded-2xl border border-border/70 bg-gradient-to-b from-background/80 to-background/35 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-foreground">{isAr ? "العربية" : "Arabe"}</h3>
                <span className="rounded-full border border-club-primary/20 bg-club-primary/10 px-2.5 py-1 text-[10px] font-bold tracking-wider text-club-primary">AR</span>
              </div>
              <div>
                <label htmlFor="titleAr" className={labelClass}>{t("fields.title")} (AR)</label>
                <input id="titleAr" name="titleAr" dir="rtl" defaultValue={ar?.title} disabled={!canManage} className={inputClass} />
              </div>
              <div>
                <label htmlFor="contentAr" className={labelClass}>{t("fields.content")} (AR)</label>
                <textarea id="contentAr" name="contentAr" dir="rtl" rows={5} defaultValue={ar?.content} disabled={!canManage} className={textareaClass} />
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-border/70 bg-gradient-to-b from-background/80 to-background/35 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-foreground">{isAr ? "الفرنسية" : "Français"}</h3>
                <span className="rounded-full border border-club-primary/20 bg-club-primary/10 px-2.5 py-1 text-[10px] font-bold tracking-wider text-club-primary">FR</span>
              </div>
              <div>
                <label htmlFor="titleFr" className={labelClass}>{t("fields.title")} (FR)</label>
                <input id="titleFr" name="titleFr" dir="ltr" defaultValue={fr?.title} disabled={!canManage} className={inputClass} />
              </div>
              <div>
                <label htmlFor="contentFr" className={labelClass}>{t("fields.content")} (FR)</label>
                <textarea id="contentFr" name="contentFr" dir="ltr" rows={5} defaultValue={fr?.content} disabled={!canManage} className={textareaClass} />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
          <div className="mb-5 flex items-center gap-3 border-b border-border/70 pb-4">
            <span className={sectionHeadingClass}><Settings2 className="h-5 w-5" aria-hidden="true" /></span>
            <div><h2 className="text-sm font-bold text-foreground">{isAr ? "النشر والاستهداف" : "Publication et ciblage"}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{isAr ? "اضبط الأولوية والفئة والمدة وموضع الظهور." : "Réglez la priorité, la catégorie, la période et la visibilité."}</p></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="announcement-priority" className={labelClass}>{t("fields.priority")}</label>
              <FormSelect id="announcement-priority" name="priority" defaultValue={announcement.priority} locale={locale} ariaLabel={t("fields.priority")} disabled={!canManage} triggerClassName={selectClass} options={priorityOptions} />
            </div>
            <div className="space-y-2">
              <label htmlFor="announcement-team" className={labelClass}>{t("fields.team")}</label>
              <FormSelect id="announcement-team" name="teamId" defaultValue={announcement.teamId ?? ""} locale={locale} ariaLabel={t("fields.team")} disabled={!canManage} triggerClassName={selectClass} placeholder={t("clubWide")} options={[{ value: "", label: t("clubWide") }, ...teams.map((team) => ({ value: team.id, label: tTeams(`categories.${team.category}` as any) }))]} />
            </div>
            <div className="space-y-2">
              <DateInput label={t("fields.startDate")} name="startDate" defaultValue={announcement.startDate} disabled={!canManage} locale={locale} className="space-y-2" inputClassName={inputClass} />
            </div>
            <div className="space-y-2">
              <DateInput label={t("fields.endDate")} name="endDate" defaultValue={announcement.endDate} disabled={!canManage} locale={locale} className="space-y-2" inputClassName={inputClass} />
            </div>
            <div className="space-y-2">
              <label htmlFor="announcement-status" className={labelClass}>{t("fields.status")}</label>
              <FormSelect id="announcement-status" name="status" defaultValue={announcement.status} locale={locale} ariaLabel={t("fields.status")} disabled={!canManage} triggerClassName={selectClass} options={statusOptions} />
            </div>
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border/80 bg-background/70 px-4 py-3 text-sm font-semibold text-foreground transition duration-200 hover:border-club-primary/40 hover:bg-club-primary/[0.035] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 xl:col-span-2">
              <input type="hidden" name="homepageVisibility" value="false" disabled={!canManage} />
              <input name="homepageVisibility" type="checkbox" value="true" defaultChecked={announcement.homepageVisibility} disabled={!canManage} className="h-4 w-4 shrink-0 accent-club-primary focus-visible:ring-2 focus-visible:ring-club-primary/30" />
              <span>{t("fields.homepageVisibility")}</span>
            </label>
          </div>
        </section>

        {canManage && (
          <section className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
            <div className="mb-4 flex items-center gap-3 border-b border-border/70 pb-4">
              <span className={sectionHeadingClass}><ImagePlus className="h-5 w-5" aria-hidden="true" /></span>
              <div><h2 className="text-sm font-bold text-foreground">{isAr ? "مرفقات الإعلان" : "Visuels de l’annonce"}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{isAr ? "رتّب الصور التي ستظهر مع الإعلان." : "Organisez les images associées à l’annonce."}</p></div>
            </div>
            <MultiImageUploader
              name="images"
              locale={locale}
              existingImages={
                announcement.imageUrls && announcement.imageUrls.length > 0
                  ? announcement.imageUrls.map((url) => ({ url }))
                  : (announcement.imageUrl ? [{ url: announcement.imageUrl }] : [])
              }
              label={locale === "ar" ? "صور وملصقات الإعلان (إضافة متعددة، معاينة وترتيب)" : "Photos et affiches de l'annonce"}
            />
          </section>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-border/70 pt-4">
          {canManage && (
            <Button
              type="submit"
              className="h-10 gap-2 rounded-xl px-5 font-semibold"
            >
              <Save className="h-4 w-4" />
              <span>{tCommon("save")}</span>
            </Button>
          )}

          {canManage && (
            <ConfirmDialog
              title={locale === "ar" ? "تأكيد الحذف النهائي" : "Confirmation de suppression"}
              body={locale === "ar" ? "هل أنت متأكد من حذف هذا الإعلان نهائياً؟ لا يمكن التراجع عن هذا الإجراء." : "Êtes-vous sûr de vouloir supprimer définitivement cette annonce ? Cette action est irréversible."}
              onConfirm={removeAnnouncement}
            >
              <Button
                type="button"
                variant="destructive"
                className="h-10 gap-2 rounded-xl px-5 font-semibold"
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
