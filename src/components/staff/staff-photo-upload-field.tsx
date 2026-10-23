"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { ImagePlus } from "lucide-react";
import { IMAGE_UPLOAD_ACTION, IMAGE_UPLOAD_FRAME, IMAGE_UPLOAD_PREVIEW } from "@/components/ui/image-upload-frame";

export function StaffPhotoUploadField({ currentPhotoUrl, locale, disabled = false }: { currentPhotoUrl: string | null; locale: string; disabled?: boolean }) {
  const isAr = locale === "ar";
  const [previewUrl, setPreviewUrl] = useState(currentPhotoUrl);
  const [selectedName, setSelectedName] = useState("");

  useEffect(() => () => {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setSelectedName(file.name);
  }

  return (
    <label className={`${IMAGE_UPLOAD_FRAME} min-h-11 w-full cursor-pointer gap-3 px-3 py-2 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60`}>
      <span className={`${IMAGE_UPLOAD_PREVIEW} h-10 w-10 rounded-full`}>
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={isAr ? "معاينة صورة عضو الطاقم" : "Aperçu de la photo du membre"} className="h-full w-full object-cover" />
        ) : <ImagePlus className="h-4 w-4" aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
        {selectedName || (isAr ? "اختر صورة جديدة" : "Choisir une nouvelle photo")}
      </span>
      <span className={`${IMAGE_UPLOAD_ACTION} h-8 px-2.5 text-[11px]`}>{isAr ? "اختيار" : "Choisir"}</span>
      <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} onChange={handleChange} className="sr-only" />
    </label>
  );
}
