"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MultiImageUploader } from "@/components/shared/multi-image-uploader";
import { prepareGalleryImage } from "@/components/gallery/new-album-form";

export function GalleryMediaUploadForm({
  locale,
  uploadAction,
  captionPlaceholder,
  submitLabel
}: {
  locale: string;
  uploadAction: (formData: FormData) => Promise<unknown>;
  captionPlaceholder: string;
  submitLabel: string;
}) {
  const isAr = locale === "ar";
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const formData = new FormData(event.currentTarget);
      const files = formData.getAll("images").filter((item): item is File => item instanceof File && item.size > 0);
      const caption = String(formData.get("caption") ?? "");
      if (!files.length) throw new Error(isAr ? "اختر صورة واحدة على الأقل." : "Sélectionnez au moins un média.");

      for (const [index, original] of files.entries()) {
        setProgress(isAr ? `رفع ${index + 1} من ${files.length}...` : `Envoi ${index + 1}/${files.length}...`);
        const file = await prepareGalleryImage(original);
        const oneFile = new FormData();
        oneFile.append("images", file, file.name);
        oneFile.set("caption", caption);
        const result = await uploadAction(oneFile) as { error?: string } | undefined;
        if (result?.error) throw new Error(result.error);
      }
      toast.success(isAr ? `تم رفع ${files.length} ملف بنجاح` : `${files.length} média(aux) envoyé(s)`);
      window.location.reload();
    } catch (error) {
      console.error("Gallery media upload failed:", error);
      toast.error(error instanceof Error ? error.message : (isAr ? "تعذر رفع الوسائط." : "Impossible d’envoyer les médias."));
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <form onSubmit={submit} encType="multipart/form-data" className="space-y-5 rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-6">
      <div>
        <h2 className="text-base font-black text-foreground">{isAr ? "إضافة صور للألبوم" : "Ajouter des médias"}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{isAr ? "ترفع الملفات بالتتابع لتفادي تعطل الطلب عند اختيار صور كثيرة." : "Les fichiers sont envoyés séparément pour éviter les échecs de lots volumineux."}</p>
      </div>
      <MultiImageUploader
        name="images"
        locale={locale}
        label={isAr ? "اختر الصور أو اسحبها هنا" : "Sélectionnez ou glissez vos médias"}
        description={isAr ? "يمكن اختيار عدة صور؛ تُضغط الصور الكبيرة تلقائيًا." : "Plusieurs médias peuvent être sélectionnés; les grandes images sont optimisées."}
      />
      <div className="flex flex-col gap-3 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <input name="caption" placeholder={captionPlaceholder} className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground shadow-2xs outline-none transition-colors placeholder:text-muted-foreground focus:border-club-primary focus:ring-2 focus:ring-club-primary/20 sm:max-w-sm" />
        <Button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-club-primary px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-club-primary-hover disabled:opacity-60">
          <Save className="h-4 w-4" />
          <span>{busy ? progress : submitLabel}</span>
        </Button>
      </div>
    </form>
  );
}
