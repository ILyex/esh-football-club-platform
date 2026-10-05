"use client";

import { useEffect, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { ImagePlus, LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateHomepageHeroImageAction } from "@/app/[locale]/(dashboard)/dashboard/website/actions";

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
          message: result.warning || (isAr ? "تم تحديث صورة الهيدر بنجاح." : "L’image de l’en-tête a été mise à jour.")
        });
      } else {
        setFeedback({
          success: false,
          message: result.error || (isAr ? "تعذر حفظ الصورة." : "Impossible d’enregistrer l’image.")
        });
      }
    });
  };

  const displayedImage = previewUrl || savedUrl;

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6" aria-labelledby="website-appearance-title">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-club-primary/10 text-club-primary">
          <ImagePlus className="h-5 w-5" />
        </span>
        <div>
          <h2 id="website-appearance-title" className="text-base font-bold text-foreground">
            {isAr ? "صور الموقع العام" : "Images du site public"}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {isAr
              ? "غيّر صورة الهيدر الرئيسية وشاهد معاينتها قبل الحفظ. الحد الأقصى 8 ميغابايت."
              : "Modifiez l’image d’en-tête de la page d’accueil et prévisualisez-la avant l’enregistrement. 8 Mo maximum."}
          </p>
        </div>
      </div>

      <div className="relative h-40 overflow-hidden rounded-xl border border-border bg-muted sm:h-52">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={displayedImage} alt={isAr ? "معاينة صورة الهيدر" : "Aperçu de l’image d’en-tête"} className="h-full w-full object-cover" />
        <span className="absolute bottom-3 start-3 rounded-lg bg-black/65 px-2.5 py-1 text-xs font-semibold text-white">
          {isAr ? (previewUrl ? "معاينة قبل الحفظ" : "صورة الهيدر الحالية") : (previewUrl ? "Aperçu avant enregistrement" : "Image actuelle")}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-semibold text-foreground">
          <span>{isAr ? "اختر صورة جديدة" : "Choisir une nouvelle image"}</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={isSaving}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs file:me-3 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-foreground"
          />
        </label>
        <Button type="submit" disabled={!file || isSaving} className="shrink-0 gap-2 sm:self-end">
          {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>{isAr ? "حفظ الصورة" : "Enregistrer l’image"}</span>
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
