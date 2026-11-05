"use client";

import { useState, useEffect } from "react";
import { Eye, Download, X, FileText, Image as ImageIcon, ExternalLink, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ESH_PRINT_WATERMARK_DATA_URL } from "@/lib/documents/watermark";
import { printPdfOrDocumentUrl } from "@/lib/documents/print-helper";

interface DocumentPreviewModalProps {
  documentId: string;
  title: string;
  mimeType?: string | null;
  fileName?: string | null;
  buttonLabel?: string;
  buttonVariant?: "default" | "outline" | "ghost" | "destructive";
  buttonSize?: "default" | "sm" | "icon";
  className?: string;
  locale?: string;
}

export function DocumentPreviewModal({
  documentId,
  title,
  mimeType,
  fileName,
  buttonLabel,
  buttonVariant = "outline",
  buttonSize = "sm",
  className,
  locale = "ar"
}: DocumentPreviewModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const previewUrl = `/api/documents/${documentId}/download?inline=true`;
  const downloadUrl = `/api/documents/${documentId}/download`;

  const isPdf =
    mimeType?.includes("pdf") ||
    fileName?.toLowerCase().endsWith(".pdf") ||
    title.toLowerCase().endsWith(".pdf");

  const isImage =
    mimeType?.startsWith("image/") ||
    /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(fileName || "") ||
    /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(title);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      setIsLoading(true);
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const defaultLabel = locale === "ar" ? "معاينة الوثيقة" : "Aperçu";

  return (
    <>
      <Button
        type="button"
        variant={buttonVariant}
        size={buttonSize}
        onClick={() => setIsOpen(true)}
        className={cn("inline-flex items-center gap-1.5 shadow-2xs text-xs font-semibold", className)}
      >
        <Eye className="h-3.5 w-3.5" />
        <span>{buttonLabel || defaultLabel}</span>
      </Button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        >
          {/* Backdrop Click Dismiss */}
          <div className="absolute inset-0" onClick={() => setIsOpen(false)} />

          {/* Modal Container */}
          <div className="relative z-10 flex flex-col w-full max-w-5xl h-[88vh] bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3.5 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-club-primary/10 text-club-primary">
                  {isImage ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-foreground truncate">{title}</h3>
                  <p className="text-[11px] text-muted-foreground truncate">{fileName || title}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void printPdfOrDocumentUrl(previewUrl, title);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-2xs"
                  title={locale === "ar" ? "طباعة الوثيقة الرسمية" : "Imprimer le document"}
                >
                  <Printer className="h-3.5 w-3.5 text-club-primary" />
                  <span>{locale === "ar" ? "طباعة" : "Imprimer"}</span>
                </button>

                <a
                  href={downloadUrl}
                  download
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-2xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{locale === "ar" ? "تحميل الملف" : "Télécharger"}</span>
                </a>

                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  title={locale === "ar" ? "فتح في نافذة جديدة" : "Ouvrir dans un nouvel onglet"}
                  className="inline-flex items-center justify-center rounded-lg border border-border bg-background p-1.5 text-muted-foreground hover:text-foreground transition-colors shadow-2xs"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex items-center justify-center rounded-lg border border-border bg-background p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shadow-2xs"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Modal Content Body */}
            <div className="relative flex-1 min-h-0 bg-zinc-950/20 flex items-center justify-center overflow-hidden">
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-card/60 z-10 backdrop-blur-2xs">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin text-club-primary" />
                    <span>{locale === "ar" ? "جارٍ تحميل المعاينة..." : "Chargement de l'aperçu..."}</span>
                  </div>
                </div>
              )}

              {isPdf ? (
                <iframe
                  id={`doc-preview-frame-${documentId}`}
                  src={previewUrl}
                  title={title}
                  onLoad={() => setIsLoading(false)}
                  className="w-full h-full border-0 rounded-b-2xl bg-white"
                />
              ) : isImage ? (
                <div className="flex items-center justify-center w-full h-full p-4 overflow-auto">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt={title}
                    onLoad={() => setIsLoading(false)}
                    className="max-h-full max-w-full object-contain rounded-lg shadow-lg"
                  />
                </div>
              ) : (
                <div className="p-8 text-center max-w-md">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
                  <h4 className="text-sm font-bold text-foreground">
                    {locale === "ar" ? "لا يمكن معاينة هذا الملف مباشرة" : "Aperçu direct non disponible"}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    {locale === "ar"
                      ? "هذا التنسيق يتطلب تحميله لفتحه عبر التطبيق المخصص (مثل Microsoft Word أو Excel)."
                      : "Ce format nécessite d'être téléchargé pour être ouvert dans une application dédiée."}
                  </p>
                  <a
                    href={downloadUrl}
                    download
                    className="inline-flex items-center gap-2 rounded-xl bg-club-primary px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-club-primary/90 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    <span>{locale === "ar" ? "تحميل الملف الآن" : "Télécharger le fichier"}</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
