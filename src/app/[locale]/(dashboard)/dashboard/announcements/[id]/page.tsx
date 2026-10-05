import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { notFound, redirect } from "next/navigation";
import { updateAnnouncementAction, setAnnouncementStatusAction, deleteAnnouncementAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { MultiImageUploader } from "@/components/shared/multi-image-uploader";
import { DateInput } from "@/components/ui/date-input";
import { Save, Trash2, Eye, EyeOff } from "lucide-react";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  SCHEDULED: "warning",
  ARCHIVED: "danger"
};

export default async function AnnouncementEditPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const user = await requirePermission("announcements.view");
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
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ── Header Bar ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card shadow-xs">
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-bold text-foreground">{ar?.title ?? fr?.title}</h1>
          <Badge tone={STATUS_TONE[announcement.status]}>
            {announcement.status === "DRAFT"
              ? (locale === "ar" ? "مخفي / مسودة" : "Masqué")
              : t(`statuses.${announcement.status}` as any)}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {canManage && (
            announcement.status === "PUBLISHED" ? (
              <form action={unpublish}>
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20"
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
                  className="gap-1.5 text-xs text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>{locale === "ar" ? "إظهار / نشر" : "Publier"}</span>
                </Button>
              </form>
            )
          )}
        </div>
      </div>

      {/* ── Edit Form ────────────────────────────────────────────── */}
      <form action={update} encType="multipart/form-data" className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.title")} (AR)</label>
          <input name="titleAr" dir="rtl" defaultValue={ar?.title} disabled={!canManage} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60" />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.content")} (AR)</label>
          <textarea name="contentAr" dir="rtl" rows={4} defaultValue={ar?.content} disabled={!canManage} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60" />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.title")} (FR)</label>
          <input name="titleFr" dir="ltr" defaultValue={fr?.title} disabled={!canManage} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60" />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.content")} (FR)</label>
          <textarea name="contentFr" dir="ltr" rows={4} defaultValue={fr?.content} disabled={!canManage} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.priority")}</label>
          <select name="priority" defaultValue={announcement.priority} disabled={!canManage} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60">
            {["LOW", "NORMAL", "HIGH", "URGENT"].map((p) => (
              <option key={p} value={p}>
                {t(`priorities.${p}` as any)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.team")}</label>
          <select name="teamId" defaultValue={announcement.teamId ?? ""} disabled={!canManage} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60">
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
            defaultValue={announcement.startDate}
            disabled={!canManage}
            locale={locale}
          />
        </div>
        <div>
          <DateInput
            label={t("fields.endDate")}
            name="endDate"
            defaultValue={announcement.endDate}
            disabled={!canManage}
            locale={locale}
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input name="homepageVisibility" type="checkbox" defaultChecked={announcement.homepageVisibility} disabled={!canManage} />
          {t("fields.homepageVisibility")}
        </label>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.status")}</label>
          <select name="status" defaultValue={announcement.status} disabled={!canManage} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60">
            <option value="DRAFT">{locale === "ar" ? "مخفي / مسودة" : "Masqué / Brouillon"}</option>
            <option value="PUBLISHED">{locale === "ar" ? "منشور / مرئي" : "Publié / Visible"}</option>
            <option value="SCHEDULED">{locale === "ar" ? "مجدول" : "Programmé"}</option>
          </select>
        </div>

        {/* ── Multi-Image Uploader with live preview & reordering ── */}
        {canManage && (
          <div className="col-span-2 pt-2">
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
          </div>
        )}

        {/* ── Action Buttons: Save (Green) and Delete (Red) side-by-side ── */}
        <div className="col-span-2 pt-4 border-t border-border flex flex-wrap items-center gap-3">
          {canManage && (
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center gap-2 px-5 py-2 rounded-lg transition-colors shadow-xs"
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
