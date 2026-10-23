"use client";

import { useEffect, useId, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { FileCheck2, ImagePlus, LoaderCircle, Save, UploadCloud } from "lucide-react";
import { IMAGE_UPLOAD_ACTION, IMAGE_UPLOAD_FRAME, IMAGE_UPLOAD_ICON } from "@/components/ui/image-upload-frame";
import { Button } from "@/components/ui/button";
import { updateDashboardWelcomeBannerAction } from "@/app/[locale]/(dashboard)/dashboard/website/actions";

interface DashboardWelcomeBannerManagerProps {
  locale: string;
  currentImageUrl: string | null;
}

export function DashboardWelcomeBannerManager({ locale, currentImageUrl }: DashboardWelcomeBannerManagerProps) {
  const isAr = locale === "ar";
  const inputId = useId();
  const [savedUrl, setSavedUrl] = useState(currentImageUrl || "/branding/esh-header-crest.png");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [isSaving, startSaving] = useTransition();

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setPreviewUrl(nextFile ? URL.createObjectURL(nextFile) : null);
    setFeedback(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || isSaving) return;
    const form = event.currentTarget;
    const formData = new FormData();
    formData.set("bannerImage", file);
    startSaving(async () => {
      const result = await updateDashboardWelcomeBannerAction(formData);
      if (result.success && result.imageUrl) {
        setSavedUrl(result.imageUrl);
        setFile(null);
        setPreviewUrl(null);
        form.reset();
        setFeedback({
          success: true,
          message: result.warning || (isAr ? "تم تحديث بانر الترحيب." : "La bannière d’accueil a été mise à jour.")
        });
      } else {
        setFeedback({
          success: false,
          message: result.error || (isAr ? "تعذر حفظ صورة البانر." : "Impossible d’enregistrer l’image.")
        });
      }
    });
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6" aria-labelledby="dashboard-banner-title">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-club-primary/10 text-club-primary">
          <ImagePlus className="h-5 w-5" />
        </span>
        <div>
          <h2 id="dashboard-banner-title" className="text-base font-bold text-foreground">
            {isAr ? "بانر الترحيب الرسمي" : "Bannière d’accueil officielle"}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {isAr
              ? "غيّر خلفية بانر لوحة الإدارة مع إبقاء الشعار والنص واضحين. يدعم GIF حتى 2 ميغابايت وبدقة لا تتجاوز 1920×1080."
              : "Modifiez le fond de la bannière du tableau de bord tout en gardant le logo et le texte lisibles. GIF jusqu’à 2 Mo et 1920×1080 maximum."}
          </p>
        </div>
      </div>

      <div className="relative h-36 overflow-hidden rounded-xl border border-border bg-zinc-900 sm:h-44">
        {/* GIFs animate natively; no client animation loop or repeated decoding is used. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl || savedUrl}
          alt={isAr ? "معاينة بانر الترحيب" : "Aperçu de la bannière d’accueil"}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/40" />
        <div className="absolute inset-0 flex items-center justify-between px-5 text-white">
          <div>
            <p className="text-lg font-extrabold">{isAr ? "مرحباً، اسم المستخدم" : "Bienvenue, utilisateur"}</p>
            <p className="mt-1 text-xs text-zinc-200">{isAr ? "نحو المزيد من الإنجازات" : "Vers de nouvelles victoires"}</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/branding/esh-logo-64.png" alt="ESH" className="h-11 w-11 rounded-lg bg-black/40 p-1.5 object-contain" />
        </div>
        <span className="absolute end-3 top-3 rounded-lg border border-white/15 bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white">
          {isAr ? "المقاس المناسب: 1920 × 1080 px" : "Format conseillé : 1920 × 1080 px"}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <span className="mb-1.5 block text-xs font-semibold text-foreground">{isAr ? "اختر صورة أو GIF" : "Choisir une image ou un GIF"}</span>
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileChange}
            disabled={isSaving}
            className="sr-only"
          />
          <label
            htmlFor={inputId}
            aria-disabled={isSaving}
            className={`${IMAGE_UPLOAD_FRAME} min-h-12 w-full gap-3 px-3 py-2.5 text-start ${isSaving ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
          >
            <span className={`${IMAGE_UPLOAD_ICON} h-8 w-8 rounded-lg`}>
              {file ? <FileCheck2 className="h-4 w-4" /> : <UploadCloud className="h-4 w-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-foreground">
                {file?.name || (isAr ? "اضغط لاختيار صورة" : "Cliquer pour choisir une image")}
              </span>
              <span className="mt-0.5 block text-[10px] text-muted-foreground">
                {isAr ? "JPG أو PNG أو WebP أو GIF · حتى 2 ميغابايت" : "JPG, PNG, WebP ou GIF · jusqu’à 2 Mo"}
              </span>
            </span>
            <span className={`${IMAGE_UPLOAD_ACTION} h-8 px-2.5 text-[11px]`}>
              {isAr ? (file ? "تغيير الملف" : "اختيار ملف") : (file ? "Changer" : "Parcourir")}
            </span>
          </label>
        </div>
        <Button type="submit" disabled={!file || isSaving} className="shrink-0 gap-2">
          {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>{isAr ? "حفظ البانر" : "Enregistrer la bannière"}</span>
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
