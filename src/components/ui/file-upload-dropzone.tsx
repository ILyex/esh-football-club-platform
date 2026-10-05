"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { UploadCloud, FileText, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadDropzoneProps {
  name: string;
  label: string;
  hint?: string;
  accept?: string;
  theme?: "emerald" | "amber" | "primary";
  locale?: string;
  className?: string;
}

export function FileUploadDropzone({
  name,
  label,
  hint,
  accept = ".pdf,.png,.jpg,.jpeg,.webp",
  theme = "emerald",
  locale = "ar",
  className
}: FileUploadDropzoneProps) {
  const isAr = locale === "ar";
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const themeClasses = {
    emerald: {
      border: "border-emerald-500/40 hover:border-emerald-500",
      borderDrag: "border-emerald-600 bg-emerald-500/10 ring-2 ring-emerald-500/20",
      bg: "bg-emerald-500/[0.03]",
      iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      button: "bg-emerald-600 hover:bg-emerald-700 text-white",
      badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
    },
    amber: {
      border: "border-amber-500/40 hover:border-amber-500",
      borderDrag: "border-amber-600 bg-amber-500/10 ring-2 ring-amber-500/20",
      bg: "bg-amber-500/[0.03]",
      iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      button: "bg-amber-600 hover:bg-amber-700 text-white",
      badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
    },
    primary: {
      border: "border-club-primary/40 hover:border-club-primary",
      borderDrag: "border-club-primary bg-club-primary/10 ring-2 ring-club-primary/20",
      bg: "bg-club-primary/[0.03]",
      iconBg: "bg-club-primary/10 text-club-primary",
      button: "bg-club-primary hover:bg-club-primary/90 text-white",
      badge: "bg-club-primary/10 text-club-primary border-club-primary/20"
    }
  }[theme];

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (inputRef.current) {
        const dt = new DataTransfer();
        dt.items.add(file);
        inputRef.current.files = dt.files;
      }
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleRemove = () => {
    setSelectedFile(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const formatSize = (bytes: number) => {
    const kb = Math.floor(bytes / 1024);
    if (kb < 1024) {
      return `${kb} KB`;
    }
    const mbInteger = Math.floor(kb / 1024);
    const mbFraction = Math.floor((kb % 1024) / 102);
    return `${mbInteger}.${mbFraction} MB`;
  };

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      <label htmlFor={name} className="block text-xs font-semibold text-foreground">
        {label}
      </label>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        role={selectedFile ? "group" : "button"}
        tabIndex={selectedFile ? undefined : 0}
        aria-label={label}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-xl border border-dashed p-4 text-center transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary/30",
          themeClasses.border,
          themeClasses.bg,
          isDragging && themeClasses.borderDrag
        )}
      >
        <input
          ref={inputRef}
          id={name}
          type="file"
          name={name}
          accept={accept}
          onChange={handleChange}
          className="sr-only"
        />

        {selectedFile ? (
          <div
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-lg border p-2.5 text-xs shadow-2xs",
              themeClasses.badge
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background shadow-xs">
                <FileText className="h-4 w-4" />
              </div>
              <div className="text-start min-w-0">
                <p className="font-bold truncate max-w-[220px] sm:max-w-sm text-foreground">
                  {selectedFile.name}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{formatSize(selectedFile.size)}</span>
                  <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>{isAr ? "جاهز للرفع" : "Prêt"}</span>
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRemove}
              title={isAr ? "إلغاء الملف" : "Supprimer"}
              className="rounded-lg p-1 text-muted-foreground hover:bg-background hover:text-destructive transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2">
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-full transition-transform hover:scale-105", themeClasses.iconBg)}>
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">
                <span className="text-club-primary underline underline-offset-2">
                  {isAr ? "انقر لاختيار ملف" : "Cliquez pour parcourir"}
                </span>{" "}
                <span className="text-muted-foreground font-normal">
                  {isAr ? "أو اسحبه وأفلته هنا" : "ou glissez-déposez ici"}
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {hint || (isAr ? "PDF، PNG، JPG، WEBP (بحد أقصى 10 ميغابايت)" : "PDF, PNG, JPG, WEBP (Max 10 Mo)")}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
