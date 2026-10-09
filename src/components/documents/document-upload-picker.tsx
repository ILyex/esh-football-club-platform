"use client";

import { useState } from "react";
import { FileUp } from "lucide-react";

interface DocumentUploadPickerProps {
  name: string;
  locale: string;
  accept?: string;
  required?: boolean;
  label: string;
  emptyLabel: string;
}

export function DocumentUploadPicker({
  name,
  locale,
  accept,
  required = false,
  label,
  emptyLabel
}: DocumentUploadPickerProps) {
  const [fileName, setFileName] = useState("");

  return (
    <div dir={locale === "ar" ? "rtl" : "ltr"} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-border bg-background p-1.5">
      <label className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-lg bg-club-primary px-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-club-primary/90 focus-within:ring-2 focus-within:ring-club-primary/30">
        <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{label}</span>
        <input
          type="file"
          name={name}
          required={required}
          accept={accept}
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
          className="sr-only"
        />
      </label>
      <span className="min-w-0 truncate text-xs text-muted-foreground" dir="ltr" title={fileName || emptyLabel}>
        {fileName || emptyLabel}
      </span>
    </div>
  );
}
