import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { notFound, redirect } from "next/navigation";
import { updateAlbumAction, uploadMediaAction, deleteMediaAction, setAlbumCoverAction, deleteAlbumAction } from "../actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormSelect } from "@/components/ui/form-select";
import { SafeImage } from "@/components/shared/safe-image";
import { NoticeToast } from "@/components/shared/notice-toast";
import { GalleryActionForm } from "@/components/gallery/gallery-action-form";
import { GalleryMediaUploadForm } from "@/components/gallery/gallery-media-upload-form";
import { Save, Trash2, Star, Play, Video } from "lucide-react";
import { isVideoUrl } from "@/lib/media-utils";

const CATEGORIES = ["MATCHES", "TRAINING", "TEAM", "EVENTS", "CLUB"] as const;

export default async function AlbumDetailPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { locale, id } = await params;
  const sp = await searchParams;
  const isAr = locale === "ar";
  const user = await requirePagePermission("gallery.view", locale);
  const t = await getTranslations("gallery");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");
  const canManage = hasPermission(user, "gallery.manage");

  const [album, teams] = await Promise.all([
    db.album.findUnique({ where: { id }, include: { media: { orderBy: { order: "asc" } } } }),
    db.team.findMany({ orderBy: { category: "asc" } })
  ]);
  if (!album) notFound();
  const categoryOptions = CATEGORIES.map((category) => ({ value: category, label: t(`categories.${category}` as any) }));
  const teamOptions = [
    { value: "", label: isAr ? "بدون فريق" : "Sans équipe" },
    ...teams.map((team) => ({ value: team.id, label: tTeams(`categories.${team.category}` as any) }))
  ];

  async function update(formData: FormData) {
    "use server";
    return updateAlbumAction(id, formData);
  }
  async function upload(formData: FormData) {
    "use server";
    return uploadMediaAction(id, formData);
  }
  async function removeAlbum() {
    "use server";
    await deleteAlbumAction(id);
    redirect(`/${locale}/dashboard/gallery`);
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <NoticeToast notice={sp.notice} />
      {/* ── Album Metadata Form ──────────────────────────────────── */}
      <GalleryActionForm action={update} successMessage={isAr ? "تم حفظ الألبوم بنجاح" : "Album enregistré avec succès"} errorMessage={isAr ? "تعذر حفظ الألبوم" : "Impossible d’enregistrer l’album"} className="grid grid-cols-1 gap-5 rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:grid-cols-2 sm:p-6">
        <div className="sm:col-span-2 flex items-center justify-between border-b border-border/70 pb-4">
          <h1 className="text-xl font-black tracking-tight text-foreground">{album.name}</h1>
          <span className="text-xs text-muted-foreground">
            {album.media.length} {isAr ? "صور في الألبوم" : "photos"}
          </span>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-bold text-foreground">{t("fields.albumTitle")}</label>
          <input name="name" defaultValue={album.name} disabled={!canManage} className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground shadow-2xs outline-none transition-colors focus:border-club-primary focus:ring-2 focus:ring-club-primary/20 disabled:opacity-60" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold text-foreground">{t("fields.category")}</label>
          <FormSelect name="category" defaultValue={album.category} disabled={!canManage} locale={locale} options={categoryOptions} ariaLabel={t("fields.category")} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold text-foreground">{t("fields.team")}</label>
          <FormSelect name="teamId" defaultValue={album.teamId ?? ""} disabled={!canManage} locale={locale} options={teamOptions} ariaLabel={t("fields.team")} />
        </div>
        <label className="group col-span-2 inline-flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/70 bg-background px-3.5 text-xs font-semibold text-foreground">
          <input type="hidden" name="published" value="false" disabled={!canManage} />
          <span className="group-has-[:checked]:hidden">{isAr ? "غير منشور" : "Non publié"}</span>
          <span className="hidden group-has-[:checked]:inline">{isAr ? "منشور" : "Publié"}</span>
          <span className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-muted transition-colors has-[:checked]:bg-club-primary has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
            <input name="published" type="checkbox" defaultChecked={album.published} disabled={!canManage} className="peer sr-only" />
            <span className="pointer-events-none absolute start-1 h-4 w-4 rounded-full bg-white shadow-sm transition-[inset-inline-start] peer-checked:start-6" />
          </span>
        </label>

        {/* Action Buttons: Save (Green) and Delete (Red) side-by-side */}
        <div className="sm:col-span-2 flex flex-wrap items-center gap-3 border-t border-border/70 pt-5">
          {canManage && (
            <Button
              type="submit"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-club-primary px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-club-primary-hover"
            >
              <Save className="h-4 w-4" />
              <span>{tCommon("save")}</span>
            </Button>
          )}

          {canManage && (
            <ConfirmDialog
              title={isAr ? "تأكيد حذف الألبوم" : "Supprimer l'album"}
              body={isAr ? "هل أنت متأكد من حذف هذا الألبوم وجميع الصور التابعة له نهائياً؟" : "Êtes-vous sûr de vouloir supprimer cet album et toutes ses photos ?"}
              onConfirm={removeAlbum}
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
      </GalleryActionForm>

      {/* ── Multi-Image Uploader Form ────────────────────────────── */}
      {canManage && (
        <GalleryMediaUploadForm
          locale={locale}
          uploadAction={upload}
          captionPlaceholder={t("fields.caption") || (isAr ? "تعليق أو وصف اختياري للصور..." : "Légende optionnelle...")}
          submitLabel={isAr ? "رفع وحفظ الصور المحددة" : "Téléverser les photos"}
        />
      )}

      {/* ── Album Media Gallery (Existing Images) ────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-foreground">
          {isAr ? `صور الألبوم الحالية (${album.media.length}):` : `Photos actuelles de l'album (${album.media.length}) :`}
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {album.media.map((m, idx) => {
            const isCover = album.coverImageUrl === m.url || (!album.coverImageUrl && idx === 0);
            async function remove() {
              "use server";
              await deleteMediaAction(id, m.id);
            }
            async function setCover() {
              "use server";
              await setAlbumCoverAction(id, m.url);
            }

            return (
              <div key={m.id} className={`group relative rounded-xl border overflow-hidden bg-card shadow-xs transition-all ${
                isCover ? "border-emerald-500/60 ring-2 ring-emerald-500/20" : "border-border hover:border-primary/40"
              }`}>
                <div className="relative aspect-[4/3] min-h-[160px] w-full bg-black/90 flex items-center justify-center">
                  {isVideoUrl(m.url) ? (
                    <>
                      <video src={m.url} className="h-full w-full object-cover" preload="metadata" />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                        <Play className="h-8 w-8 text-white fill-white/80" />
                      </span>
                      <span className="absolute bottom-2 start-2 bg-black/80 text-white text-[10px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 z-10">
                        <Video className="h-3 w-3 text-sky-400" />
                        <span>فيديو</span>
                      </span>
                    </>
                  ) : (
                    <SafeImage
                      src={m.url}
                      alt={m.caption ?? ""}
                      fallbackSrc="/branding/esh-logo-256.png"
                      className="h-full w-full object-cover"
                    />
                  )}

                  <span className="absolute top-2 start-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/75 text-[11px] font-black text-white shadow-xs z-10">
                    #{idx + 1}
                  </span>

                  {isCover && (
                    <span className="absolute top-2 end-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1 z-10">
                      <Star className="h-2.5 w-2.5 fill-white" />
                      <span>{isAr ? "الغلاف" : "Couverture"}</span>
                    </span>
                  )}
                </div>

                <div className="p-2.5 flex items-center justify-between gap-2 border-t border-border/60">
                  <span className="truncate text-xs text-muted-foreground">{m.caption || `صورة #${idx + 1}`}</span>

                  {canManage && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isCover && (
                        <form action={setCover}>
                          <button
                            type="submit"
                            className="p-1 rounded text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                            title={isAr ? "تعيين كغلاف للألبوم" : "Définir comme couverture"}
                          >
                            <Star className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      )}

                      <ConfirmDialog
                        title={isAr ? "تأكيد حذف الصورة" : "Supprimer la photo"}
                        body={isAr ? "هل أنت متأكد من حذف هذه الصورة نهائياً؟" : "Êtes-vous sûr de vouloir supprimer cette photo ?"}
                        onConfirm={remove}
                      >
                        <button
                          type="button"
                          className="p-1 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title={isAr ? "حذف الصورة" : "Supprimer"}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </ConfirmDialog>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {album.media.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
              {tCommon("noResults")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
