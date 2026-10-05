"use client";

import { useState, useRef, useEffect } from "react";
import { Eye, FileText, Image as ImageIcon, Upload, X, Download, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExistingDocument {
  id: string;
  name: string;
  mimeType: string;
  originalName: string;
  sizeBytes: number;
  positiveDrugTest?: boolean;
}

interface DocumentUploadFieldProps {
  label: string;
  name: string;
  description?: string;
  required?: boolean;
  locale: string;
  existingDocument?: ExistingDocument | null;
}

export function DocumentUploadField({
  label,
  name,
  description,
  required,
  locale,
  existingDocument
}: DocumentUploadFieldProps) {
  const isRtl = locale === "ar";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [selectedFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
  };

  const clearSelection = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isPdf = selectedFile
    ? selectedFile.type === "application/pdf"
    : existingDocument?.mimeType === "application/pdf";

  const isImage = selectedFile
    ? selectedFile.type.startsWith("image/")
    : existingDocument?.mimeType.startsWith("image/");

  const activePreviewUrl = selectedFile
    ? previewUrl
    : existingDocument
    ? `/api/documents/${existingDocument.id}/download?inline=true`
    : null;

  return (
    <div className="rounded-xl border border-border/80 bg-background/50 p-4 transition-all hover:border-border">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-foreground">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
          {description && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>

        {/* Existing doc badge */}
        {existingDocument && !selectedFile && (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            <span>{isRtl ? "مرفوع ومحفوظ" : "Déjà enregistré"}</span>
          </span>
        )}
      </div>

      {existingDocument?.positiveDrugTest && !selectedFile && (
        <p role="alert" className="mb-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
          {isRtl
            ? "نتيجة الفحص إيجابية حسب الفحص الآلي. أبقِ التقرير سرياً وأحله إلى مراجعة مختصة."
            : "Résultat positif détecté automatiquement. Gardez le rapport confidentiel et demandez une vérification spécialisée."}
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        name={name}
        required={required && !existingDocument}
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Upload Zone & Selection State */}
      <div className="mt-2">
        {selectedFile ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {isPdf ? <FileText className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground truncate max-w-[200px] sm:max-w-xs">
                  {selectedFile.name}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(1)} KB • {isPdf ? "PDF" : "Image"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted shadow-2xs transition-colors"
              >
                <Eye className="h-3.5 w-3.5 text-primary" />
                <span>{isRtl ? "معاينة الملف" : "Aperçu"}</span>
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                title={isRtl ? "إلغاء الملف" : "Supprimer"}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : existingDocument ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                {isPdf ? <FileText className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground truncate max-w-[200px] sm:max-w-xs">
                  {existingDocument.originalName || existingDocument.name}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {(existingDocument.sizeBytes / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted shadow-2xs transition-colors"
              >
                <Eye className="h-3.5 w-3.5 text-primary" />
                <span>{isRtl ? "معاينة" : "Aperçu"}</span>
              </button>
              <a
                href={`/api/documents/${existingDocument.id}/download`}
                download
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted shadow-2xs transition-colors"
              >
                <Download className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{isRtl ? "تحميل" : "Télécharger"}</span>
              </a>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted shadow-2xs transition-colors"
              >
                <span>{isRtl ? "تغيير" : "Modifier"}</span>
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="group flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-border/80 bg-muted/20 p-4 text-center transition-all hover:border-primary/50 hover:bg-muted/40 cursor-pointer"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground group-hover:scale-110 group-hover:text-primary transition-all">
              <Upload className="h-4 w-4" />
            </div>
            <p className="mt-1.5 text-xs font-bold text-foreground">
              {isRtl ? "اضغط لرفع الملف (صورة أو PDF)" : "Cliquez pour téléverser (Image ou PDF)"}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              PNG, JPG, WEBP, PDF • Max 25MB
            </p>
          </button>
        )}
      </div>

      {/* In-Browser Preview Modal */}
      {isPreviewOpen && activePreviewUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="relative flex flex-col w-full max-w-3xl max-h-[90vh] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/80 px-5 py-3.5 bg-muted/30">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  {isRtl ? `معاينة: ${label}` : `Aperçu: ${label}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Close preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-zinc-950/20 min-h-[350px]">
              {isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activePreviewUrl}
                  alt={label}
                  className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain shadow-lg"
                />
              ) : (
                <iframe
                  src={activePreviewUrl}
                  title={label}
                  className="w-full h-[70vh] rounded-lg border border-border bg-white"
                />
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-border/80 px-5 py-3 bg-card">
              <span className="text-xs text-muted-foreground">
                {selectedFile ? selectedFile.name : existingDocument?.name}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPreviewOpen(false)}
              >
                {isRtl ? "إغلاق" : "Fermer"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
