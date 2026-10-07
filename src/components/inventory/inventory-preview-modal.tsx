"use client";

import { useState } from "react";
import { Printer, Eye, X, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { printDocumentElement } from "@/lib/documents/print-helper";
import { OfficialDocumentHeader } from "@/components/documents/official-document-header";
import { ESH_DOCUMENT_FONT_FAMILY, ESH_WATERMARK_CSS_URL } from "@/lib/documents/watermark";

export interface InventoryPreviewModalProps {
  items: Array<{
    id: string;
    name: string;
    category: string;
    quantity: number;
    condition: string;
    location?: string | null;
    notes?: string | null;
    team?: {
      id: string;
      name: string;
      category: string;
    } | null;
  }>;
  locale?: string;
  categoryLabels?: Record<string, string>;
  conditionLabels?: Record<string, string>;
  teamLabels?: Record<string, string>;
}

export function InventoryPreviewModal({
  items,
  locale = "ar",
  categoryLabels = {},
  conditionLabels = {},
  teamLabels = {}
}: InventoryPreviewModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isAr = locale === "ar";

  const elementId = "official-inventory-preview-document";

  const handlePrint = () => {
    printDocumentElement(
      elementId,
      isAr ? "جرد العتاد — الجمعية الرياضية أمل سيدي حسني لكرة القدم" : "Inventaire du Matériel — Association Sportive Espoire Sidi Hosni de Football"
    );
  };

  const defaultCategoryLabels: Record<string, string> = {
    BALLS: isAr ? "كرات رسمية وتدريب" : "Ballons",
    KITS: isAr ? "أطقم وألبسة رياضية" : "Jeux de maillots",
    CONES_MARKERS: isAr ? "أقماع وحواجز تدريب" : "Plots et coupelles",
    GOALKEEPING: isAr ? "معدات حراسة المرمى" : "Équipements gardiens",
    MEDICAL: isAr ? "معدات طبية وإسعافات" : "Matériel médical",
    TRAINING_AIDS: isAr ? "أجهزة ومساعدات لياقة" : "Accessoires fitness",
    ELECTRONICS: isAr ? "أجهزة إلكترونية وتوقيت" : "Chronomètres & Élec.",
    OTHER: isAr ? "أدوات ومعدات عامة" : "Divers",
    ...categoryLabels
  };

  const defaultConditionLabels: Record<string, string> = {
    NEW: isAr ? "جديد ممتاز" : "Neuf",
    GOOD: isAr ? "حالة جيدة" : "Bon état",
    FAIR: isAr ? "مقبول / مستعمل" : "Passable",
    POOR: isAr ? "رديء بحاجة لتجديد" : "Mauvais état",
    DAMAGED: isAr ? "تالف غير صالح" : "Endommagé",
    ...conditionLabels
  };

  const categoryKeys = ["BALLS", "KITS", "CONES_MARKERS", "GOALKEEPING", "MEDICAL", "TRAINING_AIDS", "ELECTRONICS", "OTHER"];

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 shadow-2xs text-xs font-semibold"
      >
        <Eye className="h-4 w-4 text-club-primary" />
        <span>{isAr ? "معاينة وطباعة الجرد" : "Aperçu & Impression"}</span>
      </Button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200 print:static print:p-0 print:m-0 print:bg-white print:block"
        >
          {/* Backdrop Dismiss */}
          <div className="absolute inset-0 print:hidden" onClick={() => setIsOpen(false)} />

          {/* Dialog Container */}
          <div className="relative z-10 flex flex-col w-full max-w-4xl sm:max-w-5xl max-h-[92vh] bg-card rounded-2xl border border-border shadow-2xl overflow-hidden print:overflow-visible print:max-h-none print:h-auto print:border-none print:shadow-none print:bg-white print:p-0 print:m-0 print:max-w-none">
            {/* Modal Actions Header (Hidden on Print) */}
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3 shrink-0 print:hidden">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-club-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  {isAr ? "معاينة جرد العتاد" : "Aperçu — Inventaire du Matériel"}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handlePrint}
                  className="gap-1.5 text-xs font-bold"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>{isAr ? "طباعة الوثيقة" : "Imprimer"}</span>
                </Button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Printable Official Document Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-200/50 dark:bg-zinc-950/50 flex justify-center print:overflow-visible print:p-0 print:m-0 print:bg-white print:block">
              <div
                id={elementId}
                className="printable-document esh-security-watermark relative bg-white text-black print:p-0 print:m-0 print:bg-white print:text-black shadow-xl border border-zinc-200 w-full max-w-[210mm] min-h-[297mm] p-[15mm] flex flex-col print:shadow-none print:border-none print:max-w-none print:w-full"
                style={{
                  fontFamily: ESH_DOCUMENT_FONT_FAMILY,
                  boxSizing: "border-box"
                }}
              >
                {/* Dedicated Visible Anti-Counterfeit Watermark Pattern Layer */}
                <div
                  className="pointer-events-none absolute inset-0 z-0 select-none print:hidden opacity-100"
                  style={{
                    backgroundImage: ESH_WATERMARK_CSS_URL,
                    backgroundSize: "100px 50px",
                    backgroundRepeat: "repeat"
                  }}
                  aria-hidden="true"
                />

                {/* Document Content */}
                <div className="relative z-10 space-y-4">
                  {/* Official Institutional Header */}
                  <OfficialDocumentHeader
                    badgeText={isAr ? "جرد العتاد" : "INVENTAIRE"}
                    documentTitle={isAr ? "جرد العتاد والمعدات الرياضية" : "INVENTAIRE DU MATÉRIEL SPORTIF"}
                    referenceNumber={`INV-${new Date().getFullYear()}-001-ESH`}
                    date={new Date()}
                    locale={locale}
                    className="mb-2"
                  />

                  {/* Items Grouped by Category */}
                  <div className="space-y-5 text-black">
                    {categoryKeys.map((catKey) => {
                      const catItems = items.filter((it) => it.category === catKey);
                      if (catItems.length === 0) return null;
                      const catTotal = catItems.reduce((acc, it) => acc + it.quantity, 0);

                      return (
                        <div
                          key={catKey}
                          className="category-section space-y-2"
                          style={{ pageBreakInside: "auto", breakInside: "auto" }}
                        >
                          {/* Category Header */}
                          <div
                            className="category-header flex items-center justify-between bg-zinc-100 px-3 py-1.5 text-black"
                            style={{ pageBreakAfter: "avoid", breakAfter: "avoid" }}
                          >
                            <div className="font-bold text-[13px] sm:text-[14px] text-black uppercase tracking-wider flex items-center gap-2">
                              <span>{defaultCategoryLabels[catKey] || catKey}</span>
                            </div>
                            <span className="text-[12px] font-semibold text-zinc-700">
                              {catItems.length} {isAr ? "أصناف" : "articles"}
                            </span>
                          </div>

                          <table
                            className="w-full text-start text-[12px] sm:text-[13px] border-collapse border border-zinc-300 text-black"
                            style={{ width: "100%", tableLayout: "fixed" }}
                          >
                            <thead style={{ display: "table-header-group" }}>
                              <tr
                                className="bg-zinc-100 font-bold"
                                style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
                              >
                                <th className="border border-zinc-300 px-2 py-1.5 text-center" style={{ width: "8%" }}>#</th>
                                <th className="border border-zinc-300 px-3 py-1.5 text-start" style={{ width: "34%" }}>{isAr ? "اسم العتاد / التجهيز" : "Désignation"}</th>
                                <th className="border border-zinc-300 px-2 py-1.5 text-center" style={{ width: "12%" }}>{isAr ? "الكمية" : "Qté"}</th>
                                <th className="border border-zinc-300 px-2 py-1.5 text-center" style={{ width: "16%" }}>{isAr ? "الحالة الفنية" : "État"}</th>
                                <th className="border border-zinc-300 px-2 py-1.5 text-center" style={{ width: "15%" }}>{isAr ? "الموقع" : "Lieu"}</th>
                                <th className="border border-zinc-300 px-2 py-1.5 text-center" style={{ width: "15%" }}>{isAr ? "الفئة / العهدة" : "Affectation"}</th>
                              </tr>
                            </thead>
                            <tbody style={{ display: "table-row-group" }}>
                              {catItems.map((item, idx) => (
                                <tr
                                  key={item.id}
                                  className={idx % 2 === 1 ? "bg-zinc-50/50" : "bg-white"}
                                  style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
                                >
                                  <td className="border border-zinc-300 px-2 py-1.5 text-center font-mono">{idx + 1}</td>
                                  <td className="border border-zinc-300 px-3 py-1.5 font-bold text-black">{item.name}</td>
                                  <td className="border border-zinc-300 px-2 py-1.5 text-center font-mono font-bold text-[13px]">{item.quantity}</td>
                                  <td className="border border-zinc-300 px-2 py-1.5 text-center font-medium">{defaultConditionLabels[item.condition] || item.condition}</td>
                                  <td className="border border-zinc-300 px-2 py-1.5 text-center">{item.location || "—"}</td>
                                  <td className="border border-zinc-300 px-2 py-1.5 text-center">{item.team?.name || (isAr ? "عام للنادي" : "Club")}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot style={{ display: "table-footer-group" }}>
                              <tr
                                className="bg-zinc-100 font-bold"
                                style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
                              >
                                <td colSpan={2} className="border border-zinc-300 px-3 py-1.5 text-start font-bold">
                                  {isAr ? `مجموع (${defaultCategoryLabels[catKey] || catKey})` : `Total (${defaultCategoryLabels[catKey] || catKey})`}
                                </td>
                                <td className="border border-zinc-300 px-2 py-1.5 text-center font-bold font-mono">
                                  {catTotal}
                                </td>
                                <td colSpan={3} className="border border-zinc-300 px-2 py-1.5 text-end text-[11px] text-zinc-600">
                                  {catItems.length} {isAr ? "بند مسجل" : "lignes"}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      );
                    })}

                    {/* Overall grand total */}
                    <div
                      className="grand-total-section flex justify-between items-center bg-zinc-100 border border-zinc-300 px-4 py-2 text-black font-bold text-[13px]"
                      style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
                    >
                      <span>{isAr ? "المجموع الإجمالي للقطع والمعدات المفهرسة:" : "TOTAL GÉNÉRAL DU MATÉRIEL :"}</span>
                      <span className="font-mono text-[15px]">
                        {items.reduce((acc, it) => acc + it.quantity, 0)} {isAr ? "قطعة" : "unités"}
                      </span>
                    </div>
                  </div>

                  {/* Institutional Signatures strictly by role only */}
                  <div
                    className="signatures-section grid grid-cols-3 text-[13px] sm:text-[14px] pt-8 mt-6 text-black"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      pageBreakInside: "avoid",
                      breakInside: "avoid"
                    }}
                  >
                    <div>
                      <p className="font-bold text-black">
                        {isAr ? "مسؤول العتاد" : "Le Responsable du Matériel"}
                      </p>
                      <div className="h-14" />
                    </div>

                    <div className="text-center">
                      <p className="font-bold text-black">
                        {isAr ? "الأمين العام" : "Le Secrétaire Général"}
                      </p>
                      <div className="h-14" />
                    </div>

                    <div className="text-end">
                      <p className="font-bold text-black">
                        {isAr ? "رئيس النادي" : "Le Président du Club"}
                      </p>
                      <div className="h-14" />
                    </div>
                  </div>

                  {/* Document Footer */}
                  <div
                    className="print-footer pt-3 mt-4 text-[11px] text-zinc-600 flex items-center justify-between"
                    style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
                  >
                    <span>{isAr ? "جرد العتاد — الجمعية الرياضية أمل سيدي حسني لكرة القدم" : "Inventaire du matériel — Association Sportive Espoire Sidi Hosni de Football"}</span>
                    <span>{isAr ? "الموسم الرياضي: 2025 / 2026" : "Saison: 2025/2026"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
