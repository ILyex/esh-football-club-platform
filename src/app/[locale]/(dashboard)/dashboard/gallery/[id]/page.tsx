import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { notFound, redirect } from "next/navigation";
import { updateAlbumAction, uploadMediaAction, deleteMediaAction, setAlbumCoverAction, deleteAlbumAction } from "../actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { MultiImageUploader } from "@/components/shared/multi-image-uploader";
import { Save, Trash2, Star, Play, Video } from "lucide-react";
import { isVideoUrl } from "@/lib/media-utils";

const CATEGORIES = ["MATCHES", "TRAINING", "TEAM", "EVENTS", "CLUB"] as const;

export default async function AlbumDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
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

  async function update(formData: FormData) {
    "use server";
    await updateAlbumAction(id, formData);
  }
  async function upload(formData: FormData) {
    "use server";
    await uploadMediaAction(id, formData);
  }
  async function removeAlbum() {
    "use server";
    await deleteAlbumAction(id);
    redirect(`/${locale}/dashboard/gallery`);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* ── Album Metadata Form ──────────────────────────────────── */}
      <form action={update} className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="col-span-2 flex items-center justify-between pb-2 border-b border-border">
          <h1 className="text-xl font-bold text-foreground">{album.name}</h1>
          <span className="text-xs text-muted-foreground">
            {album.media.length} {isAr ? "صور في الألبوم" : "photos"}
          </span>
        </div>

        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.albumTitle")}</label>
          <input name="name" defaultValue={album.name} disabled={!canManage} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.category")}</label>
          <select name="category" defaultValue={album.category} disabled={!canManage} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}` as any)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.team")}</label>
          <select name="teamId" defaultValue={album.teamId ?? ""} disabled={!canManage} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60">
            <option value="">—</option>
            {teams.map((tm) => (
              <option key={tm.id} value={tm.id}>
                {tTeams(`categories.${tm.category}` as any)}
              </option>
            ))}
          </select>
        </div>
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input name="published" type="checkbox" defaultChecked={album.published} disabled={!canManage} /> {t("fields.published")}
        </label>

        {/* Action Buttons: Save (Green) and Delete (Red) side-by-side */}
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
      </form>

      {/* ── Multi-Image Uploader Form ────────────────────────────── */}
      {canManage && (
        <form action={upload} encType="multipart/form-data" className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-foreground">{t("addImage")}</h2>

          <MultiImageUploader
            name="images"
            locale={locale}
            label={isAr ? "إضافة دفعات صور جديدة للألبوم" : "Ajouter de nouvelles photos"}
            description={isAr ? "اختر أو اسحب عدة صور معاً، وستظهر لك للمعاينة والترتيب قبل رفعها للألبوم" : "Glissez-déposez ou sélectionnez plusieurs photos"}
          />

          <div className="pt-2 flex items-center justify-between">
            <input
              name="caption"
              placeholder={t("fields.caption") || (isAr ? "تعليق أو وصف اختياري للصور..." : "Légende optionnelle...")}
              className="w-full max-w-sm rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center gap-2 px-5 py-2 rounded-lg shadow-xs"
            >
              <Save className="h-4 w-4" />
              <span>{isAr ? "رفع وحفظ الصور المحددة" : "Téléverser les photos"}</span>
            </Button>
          </div>
        </form>
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
                    // eslint-disable-next-line @next/next/no-img-element -- external CDN URL
                    <img
                      src={m.url}
                      alt={m.caption ?? ""}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = "/branding/esh-logo-256.png";
                      }}
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
