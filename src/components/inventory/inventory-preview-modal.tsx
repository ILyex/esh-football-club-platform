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
      isAr ? "جرد العتاد — الجمعية الرياضية أمل سيدي حسني لكرة القدم" : "Inventaire du Matériel — Association Sportive Espoir Sidi Hosni de Football"
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
    OLD: isAr ? "قديم" : "Ancien",
    POOR: isAr ? "رديء بحاجة لتجديد" : "Mauvais état",
    DAMAGED: isAr ? "تالف غير صالح" : "Endommagé",
    UNSPECIFIED: isAr ? "غير محدد في السجل" : "Non précisé",
    ...conditionLabels
  };

  const categoryKeys = ["BALLS", "KITS", "CONES_MARKERS", "GOALKEEPING", "MEDICAL", "TRAINING_AIDS", "ELECTRONICS", "OTHER"];
  const pages: Array<Array<{ catKey: string; items: typeof items; startIndex: number; hasCategoryTotal: boolean }>> = [[]];
  let pageUnits = 0;
  const populatedCategories = categoryKeys
    .map((catKey) => ({ catKey, items: items.filter((item) => item.category === catKey) }))
    .filter((category) => category.items.length > 0);
  populatedCategories.forEach(({ catKey, items: categoryItems }, categoryIndex) => {
    let startIndex = 0;
    while (startIndex < categoryItems.length) {
      const isFinalCategory = categoryIndex === populatedCategories.length - 1;
      const pageCapacity = pages.length === 1 ? 28 : 34;
      let availableUnits = pageCapacity - pageUnits;
      if (availableUnits < 3) {
        pages.push([]);
        pageUnits = 0;
        availableUnits = 34;
      }
      const remainingItems = categoryItems.length - startIndex;
      if (isFinalCategory && remainingItems <= 2 && pageUnits > 0 && 8 + remainingItems > availableUnits) {
        pages.push([]);
        pageUnits = 0;
        availableUnits = 34;
      }
      let itemCount = Math.min(remainingItems, availableUnits - 2);
      if (itemCount === categoryItems.length - startIndex) {
        const finishingUnits = 2 + itemCount + 1 + (isFinalCategory ? 5 : 0);
        if (finishingUnits > availableUnits) itemCount = Math.max(1, itemCount - (finishingUnits - availableUnits));
      }
      const completesCategory = startIndex + itemCount === categoryItems.length;
      const pageItems = categoryItems.slice(startIndex, startIndex + itemCount);
      pages[pages.length - 1]?.push({
        catKey,
        items: pageItems,
        startIndex,
        hasCategoryTotal: completesCategory
      });
      pageUnits += pageItems.length + 2 + (completesCategory ? 1 : 0);
      startIndex += pageItems.length;
    }
  });
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 shadow-2xs text-xs font-semibold"
      >
        <Eye className="h-4 w-4 shrink-0 text-club-primary" />
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
              <div id={elementId} className="printable-document inventory-list-document mx-auto flex w-[210mm] shrink-0 flex-col gap-6 text-start text-black" style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY, direction: isAr ? "rtl" : "ltr" }}>
                {pages.map((pageSections, pageIndex) => {
                  const isLastPage = pageIndex === pages.length - 1;
                  return (
                    <section key={pageIndex} className={`print-preview-sheet relative mx-auto flex min-h-[297mm] w-[210mm] shrink-0 flex-col border border-zinc-200 bg-white p-[10mm] shadow-xl ${isLastPage ? "" : "print-preview-sheet-break"}`} style={{ boxSizing: "border-box", backgroundColor: "white", backgroundImage: ESH_WATERMARK_CSS_URL, backgroundSize: "100px 50px", backgroundRepeat: "repeat" }}>
                      <div className="relative z-10 flex w-full flex-1 flex-col space-y-3">
                        {pageIndex === 0 && <OfficialDocumentHeader badgeText={isAr ? "جرد العتاد" : "INVENTAIRE"} documentTitle={isAr ? "جرد العتاد والمعدات الرياضية" : "INVENTAIRE DU MATÉRIEL SPORTIF"} referenceNumber={`INV-${new Date().getFullYear()}-001-ESH`} date={new Date()} locale={locale} className="mb-2" />}
                        {pageSections.map(({ catKey, items: catItems, startIndex, hasCategoryTotal }) => {
                          const allCategoryItems = items.filter((item) => item.category === catKey);
                          const catTotal = allCategoryItems.reduce((acc, item) => acc + item.quantity, 0);
                          return (
                            <div key={`${catKey}-${startIndex}`} className="category-section space-y-1.5" style={{ breakInside: "auto", pageBreakInside: "auto" }}>
                              <div className="category-header flex items-center justify-between bg-zinc-100 px-3 py-1.5 text-black" style={{ breakAfter: "avoid", pageBreakAfter: "avoid" }}>
                                <span className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide">{defaultCategoryLabels[catKey] || catKey}</span>
                                <span className="text-[12px] font-semibold text-zinc-700">{allCategoryItems.length} {isAr ? "أصناف" : "articles"}</span>
                              </div>
                              <table className="w-full border-collapse border border-zinc-300 text-start text-[11px] leading-snug text-black" style={{ width: "100%", tableLayout: "fixed" }}>
                                <thead>
                                  <tr className="bg-zinc-100 font-bold" style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
                                    <th className="border border-zinc-300 px-1.5 py-1 text-center" style={{ width: "7%" }}>#</th>
                                    <th className="border border-zinc-300 px-2 py-1 text-start" style={{ width: "33%" }}>{isAr ? "اسم العتاد / التجهيز" : "Désignation"}</th>
                                    <th className="border border-zinc-300 px-1.5 py-1 text-center" style={{ width: "11%" }}>{isAr ? "الكمية" : "Qté"}</th>
                                    <th className="border border-zinc-300 px-1.5 py-1 text-center" style={{ width: "17%" }}>{isAr ? "الحالة الفنية" : "État"}</th>
                                    <th className="border border-zinc-300 px-1.5 py-1 text-center" style={{ width: "15%" }}>{isAr ? "الموقع" : "Lieu"}</th>
                                    <th className="border border-zinc-300 px-1.5 py-1 text-center" style={{ width: "17%" }}>{isAr ? "الفئة / العهدة" : "Affectation"}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {catItems.map((item, idx) => (
                                    <tr key={item.id} className={(startIndex + idx) % 2 ? "bg-zinc-50/50" : "bg-white"} style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
                                      <td className="border border-zinc-300 px-1.5 py-1 text-center font-mono">{startIndex + idx + 1}</td>
                                      <td className="border border-zinc-300 px-2 py-1 font-bold">{item.name}</td>
                                      <td className="border border-zinc-300 px-1.5 py-1 text-center font-mono font-bold">{item.quantity}</td>
                                      <td className="border border-zinc-300 px-1.5 py-1 text-center">{defaultConditionLabels[item.condition] || item.condition}</td>
                                      <td className="border border-zinc-300 px-1.5 py-1 text-center">{item.location || "—"}</td>
                                      <td className="border border-zinc-300 px-1.5 py-1 text-center">{item.team?.name || (isAr ? "عام للنادي" : "Club")}</td>
                                    </tr>
                                  ))}
                                  {hasCategoryTotal && <tr className="bg-zinc-100 font-bold" style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
                                    <td colSpan={2} className="border border-zinc-300 px-2 py-1 text-start">{isAr ? `مجموع (${defaultCategoryLabels[catKey] || catKey})` : `Total (${defaultCategoryLabels[catKey] || catKey})`}</td>
                                    <td className="print-document-total-count border border-zinc-300 px-1.5 py-1 text-center font-mono">{catTotal}</td>
                                    <td colSpan={3} className="border border-zinc-300 px-1.5 py-1 text-end text-[10px] text-zinc-600">{allCategoryItems.length} {isAr ? "بند مسجل" : "lignes"}</td>
                                  </tr>}
                                </tbody>
                              </table>
                            </div>
                          );
                        })}
                        {isLastPage && <>
                          <table className="grand-total-section w-full border-collapse border border-zinc-300 text-[15px] leading-relaxed text-black" style={{ width: "100%", tableLayout: "fixed", breakInside: "avoid", pageBreakInside: "avoid" }}>
                            <tbody><tr className="bg-zinc-100 font-bold"><td className="border border-zinc-300 px-3 py-2 text-start">{isAr ? "المجموع الإجمالي للقطع والمعدات المفهرسة:" : "TOTAL GÉNÉRAL DU MATÉRIEL :"}</td><td className="w-36 border border-zinc-300 px-3 py-2 text-center font-mono"><span className="print-document-total-count">{items.reduce((acc, it) => acc + it.quantity, 0)}</span> {isAr ? "قطعة" : "unités"}</td></tr></tbody>
                          </table>
                          <div className="document-signatures signatures-section mt-auto flex justify-end pt-6 text-right text-black" style={{ breakInside: "avoid", pageBreakInside: "avoid" }}><div className="min-w-[220px]"><p className="font-bold">{isAr ? "مسؤول العتاد" : "Le Responsable du Matériel"}</p><div className="h-12" /></div></div>
                        </>}
                        <footer className="inventory-page-footer mt-auto flex w-full justify-between border-t border-zinc-300 pt-2 text-[11px] text-zinc-600">
                          <span>{isAr ? "الجرد الرسمي للعتاد" : "Inventaire officiel du matériel"}</span>
                          <span dir="ltr">{isAr ? `صفحة ${pageIndex + 1} من ${pages.length}` : `Page ${pageIndex + 1} sur ${pages.length}`}</span>
                        </footer>
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
