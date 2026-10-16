"use client";

import { useId, useState } from "react";
import { FileCheck2, UploadCloud } from "lucide-react";

export function TeamInsuranceFileInput({ locale }: { locale: string }) {
  const id = useId();
  const [fileName, setFileName] = useState("");
  const isAr = locale === "ar";

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold">{isAr ? "وثيقة تأمين الفئة" : "Attestation d’assurance"}</label>
      <input id={id} type="file" name="file" required accept=".pdf,.png,.jpg,.jpeg,.webp" className="sr-only" onChange={(event) => setFileName(event.currentTarget.files?.[0]?.name ?? "")} />
      <label htmlFor={id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-background px-3 py-2.5 transition hover:border-primary/50 hover:bg-primary/[0.03] focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{fileName ? <FileCheck2 className="h-4 w-4" /> : <UploadCloud className="h-4 w-4" />}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{fileName || (isAr ? "اختر وثيقة التأمين" : "Choisir l’attestation")}</span><span className="mt-0.5 block text-[10px] text-muted-foreground">PDF أو صورة · 15 MB</span></span>
      </label>
    </div>
  );
}
