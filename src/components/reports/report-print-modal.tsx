"use client";
import { A4Pager } from "@/components/shared/a4-pager";

import { useState } from "react";
import { Printer, X, FileBarChart, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OfficialDocumentHeader } from "@/components/documents/official-document-header";
import { printDocumentElement } from "@/lib/documents/print-helper";
import { ESH_DOCUMENT_FONT_FAMILY, ESH_WATERMARK_CSS_URL } from "@/lib/documents/watermark";

export interface ReportItemData {
  title: string;
  department: string;
  scope: string;
  date: string;
  summary: string;
  stats: Array<{ label: string; value: string | number }>;
}

interface ReportPrintModalProps {
  report: ReportItemData;
  locale?: string;
}

export function ReportPrintModal({ report, locale = "ar" }: ReportPrintModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isAr = locale === "ar";
  const elementId = `report-document-${report.title.replace(/\s+/g, "-")}`;

  const handlePrint = () => {
    printDocumentElement(elementId, `${report.title} — Association Sportive Espoir Sidi Hosni de Football`);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5"
      >
        <Eye className="h-3.5 w-3.5 text-primary" />
        <span>{isAr ? "معاينة وطباعة التقرير" : "Aperçu & Impression"}</span>
      </Button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="relative flex flex-col w-full max-w-4xl max-h-[92vh] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-muted/40 px-4 py-3.5 sm:px-6">
              <div className="flex min-w-0 items-center gap-2.5">
                <FileBarChart className="h-5 w-5 shrink-0 text-primary" />
                <h3 className="min-w-0 break-words text-base font-bold text-foreground">
                  {isAr ? `معاينة: ${report.title}` : `Aperçu: ${report.title}`}
                </h3>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button size="sm" onClick={handlePrint} className="gap-1.5">
                  <Printer className="h-4 w-4" />
                  <span>{isAr ? "طباعة الآن" : "Imprimer"}</span>
                </Button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Document Content */}
            <div className="flex-1 overflow-auto p-4 sm:p-6 bg-zinc-950/20 flex justify-center">
              <A4Pager targetId={elementId} />
              <div
                id={elementId}
                className="printable-document esh-security-watermark relative flex min-h-[297mm] w-full max-w-[210mm] flex-col justify-between border border-zinc-200 bg-white p-5 text-start text-zinc-900 shadow-xl sm:p-12"
                style={{
                  fontFamily: ESH_DOCUMENT_FONT_FAMILY,
                  direction: isAr ? "rtl" : "ltr"
                }}
              >
                {/* Security watermark */}
                <div
                  className="pointer-events-none absolute inset-0 z-0 esh-document-watermark select-none print:hidden"
                  style={{
                    backgroundImage: ESH_WATERMARK_CSS_URL,
                    backgroundSize: "100px 50px",
                    backgroundRepeat: "repeat"
                  }}
                  aria-hidden="true"
                />

                <div className="relative z-10">
                  <OfficialDocumentHeader
                    documentTitle={report.title}
                    locale={locale}
                  />

                  <div className="my-4 text-center">
                    <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-zinc-600">
                      <span>{isAr ? `القسم: ${report.department}` : `Département : ${report.department}`}</span>
                      <span>{isAr ? `النطاق: ${report.scope}` : `Périmètre : ${report.scope}`}</span>
                      <span>{isAr ? `تاريخ الاستخراج: ${report.date}` : `Extrait le : ${report.date}`}</span>
                    </div>
                  </div>

                  {/* Summary / Administrative Context */}
                  <div className="my-5 text-base leading-relaxed text-zinc-900">
                    <p className="font-bold text-[15px] text-zinc-800 mb-1">
                      {isAr ? "ملخص البيانات:" : "Synthèse des données :"}
                    </p>
                    <p>{report.summary}</p>
                  </div>

                  {/* Indicators / Stats Table (Only structural table borders) */}
                  <div className="mt-5">
                    <table className="w-full text-base border-collapse border border-zinc-300">
                      <thead>
                        <tr className="bg-zinc-100 text-zinc-900">
                          <th className="py-2.5 px-4 border border-zinc-300 text-start font-bold">
                            {isAr ? "المؤشر الإداري / الميداني" : "Indicateur"}
                          </th>
                          <th className="py-2.5 px-4 border border-zinc-300 text-center font-bold w-48">
                            {isAr ? "القيمة المسجلة" : "Valeur enregistrée"}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.stats.map((s, idx) => (
                          <tr
                            key={idx}
                            className={`border-b border-zinc-300 ${idx % 2 === 1 ? "bg-zinc-50/60" : "bg-white"}`}
                          >
                            <td className="py-2.5 px-4 border border-zinc-300 font-medium text-zinc-900">
                              {s.label}
                            </td>
                            <td className="py-2.5 px-4 border border-zinc-300 text-center font-bold text-zinc-800">
                              <bdi dir="auto" className="inline-block max-w-full whitespace-nowrap">
                                {s.value}
                              </bdi>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="relative z-10 mt-10 border-t border-zinc-200 pt-4 text-center text-xs leading-relaxed text-zinc-500">
                  {isAr
                    ? "ملخص آلي للقيم المسجلة في المنصة بتاريخ الاستخراج أعلاه. لا يمثل اعتماداً أو تدقيقاً مالياً."
                    : "Synthèse automatique des valeurs enregistrées à la date d'extraction ci-dessus. Elle ne vaut ni validation ni audit financier."}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}