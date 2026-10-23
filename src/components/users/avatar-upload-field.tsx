"use client";

import { useId, useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, UploadCloud } from "lucide-react";
import { IMAGE_UPLOAD_ACTION, IMAGE_UPLOAD_FRAME, IMAGE_UPLOAD_ICON } from "@/components/ui/image-upload-frame";

/** Compresses avatars before the server action so the online DB stores only a small image. */
export function AvatarUploadField({ locale }: { locale: string }) {
  const [busy, setBusy] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const isAr = locale === "ar";

  async function compress(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setSelectedName(file.name);
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      const max = 320;
      const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
      if (!blob) throw new Error("compression_failed");
      const compressed = new File([blob], "avatar.jpg", { type: "image/jpeg", lastModified: Date.now() });
      const transfer = new DataTransfer();
      transfer.items.add(compressed);
      input.files = transfer.files;
    } catch {
      // Keep the original file; the server still validates its real MIME type.
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        id={inputId}
        ref={inputRef}
        name="photo"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={compress}
        disabled={busy}
        className="peer sr-only"
      />
      <div className={`${IMAGE_UPLOAD_FRAME} min-h-[68px] px-3 py-2.5 sm:px-4`}>
        <span className={`${IMAGE_UPLOAD_ICON} h-10 w-10`}>
          {selectedName ? <ImagePlus className="h-5 w-5" aria-hidden="true" /> : <UploadCloud className="h-5 w-5" aria-hidden="true" />}
        </span>
        <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-club-primary/40">
          <span className="block truncate text-sm font-semibold text-foreground">
            {busy
              ? (isAr ? "جارٍ تجهيز الصورة…" : "Préparation de la photo…")
              : selectedName ?? (isAr ? "اختر صورة من جهازك" : "Choisir une photo sur l’appareil")}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {isAr ? "PNG أو JPG أو WebP · تُضغط تلقائيًا لتوفير المساحة" : "PNG, JPG ou WebP · compression automatique"}
          </span>
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className={IMAGE_UPLOAD_ACTION}
        >
          <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
          {isAr ? "استعراض" : "Parcourir"}
        </button>
      </div>
    </div>
  );
}
