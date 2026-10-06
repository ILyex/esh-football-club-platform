"use client";

import { useState, type ChangeEvent } from "react";

/** Compresses avatars before the server action so the online DB stores only a small image. */
export function AvatarUploadField({ locale }: { locale: string }) {
  const [busy, setBusy] = useState(false);

  async function compress(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
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
    <>
      <input name="photo" type="file" accept="image/png,image/jpeg,image/webp" onChange={compress} disabled={busy} className="w-full text-xs file:me-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer rounded-md border border-border bg-background p-1.5" />
      <p className="mt-1 text-[11px] text-muted-foreground">
        {busy
          ? (locale === "ar" ? "جارٍ ضغط الصورة…" : "Compression de l’image…")
          : (locale === "ar" ? "تُضغط الصورة تلقائيًا لتوفير المساحة." : "La photo est compressée automatiquement pour économiser l’espace.")}
      </p>
    </>
  );
}
