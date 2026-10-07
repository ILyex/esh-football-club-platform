"use client";

import { ESH_DOCUMENT_FONT_FAMILY } from "@/lib/documents/watermark";

interface OfficialDocumentFooterProps {
  locale?: string;
}

/** Shared footer for every official paper, anchored to the A4 page box. */
export function OfficialDocumentFooter({ locale = "ar" }: OfficialDocumentFooterProps) {
  const isAr = locale === "ar";

  return (
    <div
      className="esh-document-footer pointer-events-none absolute bottom-[8mm] left-[10mm] right-[10mm] z-20 flex items-center justify-between gap-6 text-[10px] leading-tight text-zinc-500 print:absolute"
      style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY }}
      aria-hidden="true"
    >
      <span>{isAr ? "الموسم الرياضي: 2025 / 2026" : "Saison sportive : 2025 / 2026"}</span>
      <span className="text-center">{isAr ? "الجمعية الرياضية أمل سيدي حسني لكرة القدم • 2018 — ∞" : "Association Sportive Espoir Sidi Hosni de Football • 2018 — ∞"}</span>
    </div>
  );
}
