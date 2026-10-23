"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import { Save, Upload, Image as ImageIcon, AlertCircle, X } from "lucide-react";
import { uploadCompetitionLogoAction } from "@/app/[locale]/(dashboard)/dashboard/competitions/actions";
import { IMAGE_UPLOAD_ACTION, IMAGE_UPLOAD_FRAME, IMAGE_UPLOAD_PREVIEW } from "@/components/ui/image-upload-frame";

interface CompetitionLogoManagerProps {
  competitionId: string;
  currentLogoUrl?: string | null;
  competitionName: string;
  locale: string;
  onSuccess?: (newUrl: string) => void;
}

export function CompetitionLogoManager({
  competitionId,
  currentLogoUrl,
  competitionName,
  locale,
  onSuccess
}: CompetitionLogoManagerProps) {
  const isAr = locale === "ar";
  const [isOpen, setIsOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentLogoUrl || null);
  const [urlInput, setUrlInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
  }, [preview]);

  const selectFile = (selected?: File) => {
    if (!selected) return;
    if (!selected.type.startsWith("image/")) {
      setError(isAr ? "يرجى اختيار ملف صورة صالح" : "Veuillez choisir un fichier image valide");
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setError(isAr ? "حجم الصورة يتجاوز الحد المسموح به (5MB)" : "Image trop grande (max 5MB)");
      return;
    }
    setFile(selected);
    setUrlInput("");
    setError(null);
    setPreview(URL.createObjectURL(selected));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    selectFile(e.target.files?.[0]);
    e.target.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !urlInput.trim()) {
      setError(isAr ? "يرجى اختيار ملف صورة أو كتابة الرابط" : "Veuillez choisir une image ou un lien");
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        const formData = new FormData();
        if (file) formData.set("logoFile", file);
        if (urlInput.trim()) formData.set("logoUrl", urlInput.trim());

        const res = await uploadCompetitionLogoAction(competitionId, formData);
        if (res.logoUrl && onSuccess) {
          onSuccess(res.logoUrl);
        }
        setIsOpen(false);
      } catch (err: any) {
        setError(err?.message || (isAr ? "فشل رفع شعار المسابقة" : "Échec du téléchargement"));
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/90 px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:border-club-primary hover:text-foreground transition-all shadow-2xs"
        title={isAr ? "تغيير أو رفع شعار المسابقة" : "Changer le logo de la compétition"}
      >
        <Upload className="h-3 w-3 text-club-primary" />
        <span>{isAr ? "شعار المسابقة" : "Logo"}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {isAr ? "تحديد أو رفع شعار المسابقة" : "Logo de la compétition"}
                </h3>
                <p className="text-xs text-muted-foreground truncate max-w-[280px]">
                  {competitionName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Preview Box */}
              <div
                onDragEnter={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setIsDragging(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  event.dataTransfer.dropEffect = "copy";
                  setIsDragging(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setIsDragging(false);
                  selectFile(event.dataTransfer.files?.[0]);
                }}
                className={`${IMAGE_UPLOAD_FRAME} min-h-40 w-full flex-col justify-center p-4 ${
                  isDragging
                    ? "border-club-primary bg-club-primary/10"
                    : ""
                }`}
              >
                <div className={`${IMAGE_UPLOAD_PREVIEW} mb-2 h-20 w-20 rounded-2xl p-2 shadow-2xs`}>
                  {preview ? (
                    <img src={preview} alt="Logo" className="h-full w-full object-contain" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={IMAGE_UPLOAD_ACTION}
                >
                  <Upload className="h-3.5 w-3.5 text-club-primary" />
                  <span>{isAr ? "اختيار صورة من الجهاز" : "Choisir un fichier"}</span>
                </button>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {isDragging
                    ? isAr ? "أفلت الصورة هنا" : "Déposez l’image ici"
                    : isAr ? "أو اسحب الصورة وأفلتها هنا (حتى 5MB)" : "Ou glissez-déposez une image ici (5 Mo max)"}
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                />
              </div>

              {/* URL fallback */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  {isAr ? "أو أدخل رابط الشعار مباشرة (URL):" : "Ou lien direct (URL):"}
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    setFile(null);
                    if (e.target.value.startsWith("http") || e.target.value.startsWith("/")) {
                      setPreview(e.target.value);
                    }
                  }}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-club-primary focus:outline-hidden"
                />
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  {isAr ? "إلغاء" : "Annuler"}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-club-primary px-4 py-1.5 text-xs font-bold text-white hover:bg-club-primary/90 transition-colors shadow-xs disabled:opacity-50"
                >
                  <> <Save className="h-3.5 w-3.5" /> <span>{isPending ? (isAr ? "جاري الحفظ..." : "Enregistrement...") : isAr ? "حفظ الشعار" : "Enregistrer"}</span> </>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
