"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { MultiImageUploader } from "@/components/shared/multi-image-uploader";

type ActionResult = { id?: string; error?: string };
type CreateAction = (formData: FormData) => Promise<ActionResult>;
type UploadAction = (albumId: string, formData: FormData) => Promise<unknown>;

export async function prepareGalleryImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= 3 * 1024 * 1024) return file;

  const bitmap = await createImageBitmap(file);
  try {
    for (const [maxSide, quality] of [[2560, 0.86], [2048, 0.78], [1600, 0.7]] as const) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("تعذر تجهيز الصورة للرفع.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => value ? resolve(value) : reject(new Error("تعذر ضغط الصورة.")), "image/webp", quality);
      });
      if (blob.size <= 3.5 * 1024 * 1024 || maxSide === 1600) {
        const name = file.name.replace(/\.[^.]+$/u, "") + ".webp";
        return new File([blob], name, { type: "image/webp", lastModified: file.lastModified });
      }
    }
  } finally {
    bitmap.close();
  }
  return file;
}

export function NewAlbumForm({
  locale,
  categoryOptions,
  teamOptions,
  defaultTeamId,
  teamRequired,
  saveLabel,
  createAction,
  uploadAction
}: {
  locale: string;
  categoryOptions: { value: string; label: string }[];
  teamOptions: { value: string; label: string }[];
  defaultTeamId: string;
  teamRequired: boolean;
  saveLabel: string;
  createAction: CreateAction;
  uploadAction: UploadAction;
}) {
  const router = useRouter();
  const isAr = locale === "ar";
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setProgress("");
    let createdAlbumId: string | null = null;
    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      const files = formData.getAll("images").filter((entry): entry is File => entry instanceof File && entry.size > 0);
      formData.delete("images");

      if (teamRequired && !String(formData.get("teamId") ?? defaultTeamId).trim()) {
        throw new Error(isAr ? "اختر الفريق الذي تدير فئته لحفظ الألبوم." : "Choisissez une équipe que vous gérez pour enregistrer l’album.");
      }

      if (formData.get("teamId") === null) formData.set("teamId", defaultTeamId);

      const album = await createAction(formData);
      if (album.error === "team_required") {
        throw new Error(isAr ? "اختر الفريق الذي تدير فئته لحفظ الألبوم." : "Choisissez une équipe que vous gérez pour enregistrer l’album.");
      }
      if (!album.id) throw new Error(isAr ? "تعذر إنشاء الألبوم. أعد المحاولة." : "Impossible de créer l’album. Réessayez.");
      createdAlbumId = album.id;
      let uploaded = 0;
      for (const [index, original] of files.entries()) {
        setProgress(isAr ? `رفع الصور ${index + 1} من ${files.length}...` : `Envoi des médias ${index + 1}/${files.length}...`);
        const file = await prepareGalleryImage(original);
        const mediaData = new FormData();
        mediaData.append("images", file, file.name);
      const result = await uploadAction(album.id, mediaData) as { error?: string } | undefined;
        if (result?.error) throw new Error(result.error);
        uploaded += 1;
      }

      toast.success(isAr ? `تم حفظ الألبوم ورفع ${uploaded} ملف` : `Album enregistré, ${uploaded} média envoyé(s)`);
      router.push(`/${locale}/dashboard/gallery`);
      router.refresh();
    } catch (error) {
      console.error("Gallery album save failed:", error);
      const detail = error instanceof Error ? error.message : "";
      toast.error(detail || (isAr ? "تعذر حفظ الألبوم" : "Impossible d’enregistrer l’album"));
      if (createdAlbumId) {
        router.push(`/${locale}/dashboard/gallery/${createdAlbumId}`);
        router.refresh();
      }
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <form onSubmit={submit} encType="multipart/form-data" className="grid grid-cols-1 gap-5 rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:grid-cols-2 sm:p-6">
      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-xs font-bold text-foreground">{isAr ? "عنوان الألبوم" : "Titre de l’album"}</label>
        <input name="name" required className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground shadow-2xs outline-none transition-colors placeholder:text-muted-foreground focus:border-club-primary focus:ring-2 focus:ring-club-primary/20" />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-bold text-foreground">{isAr ? "الفئة" : "Catégorie"}</label>
        <FormSelect name="category" required locale={locale} options={categoryOptions} ariaLabel={isAr ? "الفئة" : "Catégorie"} />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-bold text-foreground">{isAr ? "الفريق" : "Équipe"}</label>
        <FormSelect name="teamId" defaultValue={defaultTeamId} locale={locale} options={teamOptions} ariaLabel={isAr ? "الفريق" : "Équipe"} />
      </div>
      <label className="group sm:col-span-2 inline-flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/70 bg-background px-3.5 text-xs font-semibold text-foreground">
        <input type="hidden" name="published" value="false" />
        <span className="group-has-[:checked]:hidden">{isAr ? "غير منشور" : "Non publié"}</span>
        <span className="hidden group-has-[:checked]:inline">{isAr ? "منشور" : "Publié"}</span>
        <span className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-muted transition-colors has-[:checked]:bg-club-primary">
          <input name="published" type="checkbox" defaultChecked className="peer sr-only" />
          <span className="pointer-events-none absolute start-1 h-4 w-4 rounded-full bg-white shadow-sm transition-[inset-inline-start] peer-checked:start-6" />
        </span>
      </label>
      <div className="sm:col-span-2 pt-2">
        <MultiImageUploader
          name="images"
          locale={locale}
          label={isAr ? "وسائط الألبوم (العنصر الأول هو الغلاف)" : "Médias de l'album (le premier devient la couverture)"}
          description={isAr ? "ترفع الصور واحدة تلو الأخرى لتفادي فشل الطلبات الكبيرة، وتُضغط الصور الكبيرة تلقائيًا." : "Les médias sont envoyés un par un; les grandes images sont automatiquement optimisées."}
        />
      </div>
      {progress && <p aria-live="polite" className="sm:col-span-2 text-xs font-semibold text-muted-foreground">{progress}</p>}
      <div className="sm:col-span-2 flex items-center gap-3 border-t border-border/70 pt-5">
        <Button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-club-primary px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-club-primary-hover disabled:opacity-60">
          <Save className="h-4 w-4" />
          <span>{busy ? (isAr ? "جارٍ الحفظ والرفع..." : "Enregistrement et envoi...") : saveLabel}</span>
        </Button>
      </div>
    </form>
  );
}
