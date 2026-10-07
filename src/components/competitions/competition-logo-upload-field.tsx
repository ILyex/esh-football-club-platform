"use client";

import { Image as ImageIcon, Upload } from "lucide-react";
import { useEffect, useState } from "react";

type CompetitionLogoUploadFieldProps = {
  locale: string;
  currentLogoUrl?: string | null;
};

export function CompetitionLogoUploadField({ locale, currentLogoUrl }: CompetitionLogoUploadFieldProps) {
  const isAr = locale === "ar";
  const [preview, setPreview] = useState<string | null>(currentLogoUrl ?? null);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => () => {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
  }, [preview]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setFileName(file.name);
    setPreview(URL.createObjectURL(file));
  }

  return (
    <div className="col-span-2">
      <label className="mb-1 block text-sm font-medium">
        {isAr ? "شعار المسابقة (اختياري)" : "Logo de la compétition (optionnel)"}
      </label>
      <label className="flex min-h-24 cursor-pointer items-center gap-4 rounded-md border border-dashed border-border bg-background px-4 py-3 transition-colors hover:border-primary/70 hover:bg-muted/30">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-card">
          {preview ? <img src={preview} alt="" className="h-full w-full object-contain" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Upload className="h-4 w-4 text-primary" />
            {isAr ? "رفع صورة الشعار" : "Télécharger le logo"}
          </span>
          <span className="mt-1 block truncate text-xs text-muted-foreground">
            {fileName ?? (isAr ? "PNG أو JPG أو WebP، بحد أقصى 8 ميغابايت" : "PNG, JPG ou WebP, 8 Mo maximum")}
          </span>
        </span>
        <input name="logoFile" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleChange} className="sr-only" />
      </label>
      {currentLogoUrl && <input type="hidden" name="logoUrl" value={currentLogoUrl} />}
    </div>
  );
}
