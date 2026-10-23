"use client";

import { useEffect, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { ImagePlus, LoaderCircle, Save, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IMAGE_UPLOAD_ACTION, IMAGE_UPLOAD_FRAME, IMAGE_UPLOAD_ICON } from "@/components/ui/image-upload-frame";
import { updateHomepageHeroImageAction } from "@/app/[locale]/(dashboard)/dashboard/website/actions";
import { isVideoUrl } from "@/lib/media-utils";

interface WebsiteAppearanceManagerProps {
  locale: string;
  currentImageUrl: string | null;
}

export function WebsiteAppearanceManager({ locale, currentImageUrl }: WebsiteAppearanceManagerProps) {
  const isAr = locale === "ar";
  const [savedUrl, setSavedUrl] = useState(currentImageUrl || "/branding/esh-header-stadium.png");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [isSaving, startSaving] = useTransition();

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setFeedback(null);
    setPreviewUrl(nextFile ? URL.createObjectURL(nextFile) : null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || isSaving) return;

    const form = event.currentTarget;
    const formData = new FormData();
    formData.set("heroImage", file);
    startSaving(async () => {
      const result = await updateHomepageHeroImageAction(formData);
      if (result.success && result.imageUrl) {
        setSavedUrl(result.imageUrl);
        setFile(null);
        setPreviewUrl(null);
        form.reset();
        setFeedback({
          success: true,
          message: result.warning || (isAr ? "تم تحديث خلفية الهيدر بنجاح." : "Le fond de l’en-tête a été mis à jour.")
        });
      } else {
        setFeedback({
          success: false,
          message: result.error || (isAr ? "تعذر حفظ الوسيط." : "Impossible d’enregistrer le média.")
        });
      }
    });
  };

  const displayedMedia = previewUrl || savedUrl;
  const displayedVideo = previewUrl ? Boolean(file?.type.startsWith("video/")) : isVideoUrl(displayedMedia);

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6" aria-labelledby="website-appearance-title">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-club-primary/10 text-club-primary">
          <ImagePlus className="h-5 w-5" />
        </span>
        <div>
          <h2 id="website-appearance-title" className="text-base font-bold text-foreground">
            {isAr ? "خلفية هيدر الموقع العام" : "Fond d’en-tête du site public"}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {isAr
              ? "اختر صورة للهيدر (JPG أو PNG أو WebP، حتى 8 ميغابايت) أو فيديو MP4 (حتى 20 ميغابايت). الفيديو يعمل تلقائياً بصمت وبشكل متكرر كخلفية دون عناصر تحكم."
              : "Choisissez une image (JPG, PNG, WebP, 8 Mo max.) ou une vidéo MP4 (20 Mo max.). La vidéo est muette, en boucle et sans commandes, en arrière-plan."}
          </p>
        </div>
      </div>

      <div className="relative h-40 overflow-hidden rounded-xl border border-border bg-[#0C0D0E] sm:h-52">
        {displayedVideo ? (
          <video key={displayedMedia} src={displayedMedia} autoPlay loop muted playsInline controls={false} preload="metadata" aria-label={isAr ? "معاينة فيديو خلفية الهيدر" : "Aperçu de la vidéo d’en-tête"} className="h-full w-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={displayedMedia} alt={isAr ? "معاينة صورة الهيدر" : "Aperçu de l’image d’en-tête"} className="h-full w-full object-cover" />
        )}
        <span className="absolute bottom-3 start-3 rounded-lg bg-black/65 px-2.5 py-1 text-xs font-semibold text-white">
          {isAr ? (previewUrl ? "معاينة قبل الحفظ" : displayedVideo ? "فيديو الهيدر الحالي" : "صورة الهيدر الحالية") : (previewUrl ? "Aperçu avant enregistrement" : displayedVideo ? "Vidéo d’en-tête actuelle" : "Image d’en-tête actuelle")}
          {displayedVideo && <Video className="ms-1.5 inline h-3.5 w-3.5" aria-hidden="true" />}
        </span>
        <span className="absolute end-3 top-3 rounded-lg border border-white/15 bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white">
          {isAr ? "المقاس المناسب: 1920 × 700 px" : "Format conseillé : 1920 × 700 px"}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className={`${IMAGE_UPLOAD_FRAME} min-w-0 flex-1 cursor-pointer gap-3 px-3 py-2.5 text-xs font-semibold text-foreground`}>
          <span className={`${IMAGE_UPLOAD_ICON} h-9 w-9`}><ImagePlus className="h-4 w-4" aria-hidden="true" /></span>
          <span className="min-w-0 flex-1">
            <span className="block">{isAr ? "اختر صورة أو فيديو جديداً" : "Choisir une nouvelle image ou vidéo"}</span>
            <span className="mt-0.5 block truncate text-[10px] font-normal text-muted-foreground">{file?.name ?? (isAr ? "JPG أو PNG أو WebP أو MP4" : "JPG, PNG, WebP ou MP4")}</span>
          </span>
          <span className={`${IMAGE_UPLOAD_ACTION} h-8 px-2.5 text-[11px]`}>{isAr ? "اختيار" : "Choisir"}</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,.mp4"
            onChange={handleFileChange}
            disabled={isSaving}
            className="sr-only"
          />
        </label>
        <Button type="submit" disabled={!file || isSaving} className="shrink-0 gap-2 sm:self-end">
          {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>{isAr ? "حفظ خلفية الهيدر" : "Enregistrer le fond"}</span>
        </Button>
      </form>

      {feedback && (
        <p role="status" className={`text-xs font-semibold ${feedback.success ? "text-emerald-600" : "text-destructive"}`}>
          {feedback.message}
        </p>
      )}
    </section>
  );
}
