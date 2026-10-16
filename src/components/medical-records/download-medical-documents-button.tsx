"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";

export function DownloadMedicalDocumentsButton({ playerId, locale, hasDocuments }: { playerId: string; locale: string; hasDocuments: boolean }) {
  const [pending, setPending] = useState(false);
  const isAr = locale === "ar";

  async function downloadDocuments() {
    if (pending) return;
    if (!hasDocuments) {
      toast.info(isAr ? "لا توجد ملفات طبية لتحميلها." : "Aucun document médical à télécharger.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch(`/api/medical-records/${encodeURIComponent(playerId)}/download`, { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        if (response.status === 404 || payload?.error === "No medical documents") {
          toast.info(isAr ? "لا توجد ملفات طبية لتحميلها." : "Aucun document médical à télécharger.");
        } else if (response.status === 403) {
          toast.error(isAr ? "ليس لديك صلاحية تحميل هذه الوثائق." : "Vous n’êtes pas autorisé à télécharger ces documents.");
        } else {
          toast.error(isAr ? "تعذر تحميل الوثائق. حاول مرة أخرى." : "Impossible de télécharger les documents. Réessayez.");
        }
        return;
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const fileName = disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? "medical-documents.zip";
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch {
      toast.error(isAr ? "تعذر تحميل الوثائق. تحقق من الاتصال وحاول مجدداً." : "Téléchargement impossible. Vérifiez votre connexion et réessayez.");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={downloadDocuments}
      disabled={pending}
      className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-wait disabled:opacity-70"
    >
      <Download className="h-4 w-4" />
      {pending ? (isAr ? "جارٍ تجهيز الملفات…" : "Préparation des fichiers…") : (isAr ? "تحميل كل الوثائق" : "Télécharger tous les documents")}
    </button>
  );
}
