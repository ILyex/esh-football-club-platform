"use client";

import { useId, useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, UploadCloud } from "lucide-react";

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
      <div className="group flex min-h-[68px] items-center gap-3 rounded-xl border border-dashed border-border bg-background/70 px-3 py-2.5 transition-colors hover:border-club-primary/60 hover:bg-club-primary/5 sm:px-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-club-primary/15 bg-club-primary/10 text-club-primary transition-colors group-hover:bg-club-primary/15">
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
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground shadow-xs transition-colors hover:border-club-primary/30 hover:text-club-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary/40 disabled:cursor-wait disabled:opacity-60"
        >
          <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
          {isAr ? "استعراض" : "Parcourir"}
        </button>
      </div>
    </div>
  );
}
