"use client";
import { A4Pager } from "@/components/shared/a4-pager";

import { useState } from "react";
import { Printer, Eye, X, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { printDocumentElement } from "@/lib/documents/print-helper";
import { OfficialDocumentHeader } from "@/components/documents/official-document-header";
import { ESH_DOCUMENT_FONT_FAMILY, ESH_WATERMARK_CSS_URL } from "@/lib/documents/watermark";

export interface InsuranceListRow {
  id: string;
  name: string;
  position: string;
  statusLabel: string;
  startDate: string;
  endDate: string;
  policyNumber: string;
}

export interface InsuranceListGroup {
  teamId: string;
  label: string;
  rows: InsuranceListRow[];
}

export interface InsuranceListPreviewModalProps {
  groups: InsuranceListGroup[];
  locale?: string;
}

export function InsuranceListPreviewModal({ groups, locale = "ar" }: InsuranceListPreviewModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isAr = locale === "ar";
  const elementId = "official-insurance-list-document";
  const total = groups.reduce((acc, g) => acc + g.rows.length, 0);

  const handlePrint = () =>
    printDocumentElement(elementId, isAr ? "قائمة تأمين اللاعبين — الجمعية الرياضية أمل سيدي حسني لكرة القدم" : "Liste d'assurance des joueurs — Association Sportive Espoir Sidi Hosni de Football");

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="default"
        onClick={() => setIsOpen(true)}
        className="insurance-preview-trigger h-11 rounded-xl px-3.5 text-xs font-semibold shadow-2xs"
      >
        <Eye className="h-4 w-4 shrink-0 text-club-primary" />
        <span>{isAr ? "معاينة و طباعة" : "Aperçu & Impression"}</span>
      </Button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="absolute inset-0" onClick={() => setIsOpen(false)} />

          <div className="relative z-10 flex flex-col w-full max-w-4xl sm:max-w-5xl max-h-[92vh] bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3 shrink-0 print:hidden">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-club-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  {isAr ? "معاينة قائمة تأمين اللاعبين" : "Aperçu — Liste d'assurance des joueurs"}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" onClick={handlePrint} className="gap-1.5 text-xs font-bold">
                  <Printer className="h-3.5 w-3.5" />
                  <span>{isAr ? "طباعة" : "Imprimer"}</span>
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

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-200/50 dark:bg-zinc-950/50 flex justify-center">
              {/* A4: 210mm wide, min 297mm tall */}
              <A4Pager targetId={elementId} />
              <div
                id={elementId}
                className="printable-document insurance-list-document esh-security-watermark relative mx-auto w-[210mm] min-h-[297mm] shrink-0 bg-white text-black p-[10mm] shadow-xl border border-zinc-200 text-start flex flex-col"
                style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY, boxSizing: "border-box" }}
              >
                <div
                  className="pointer-events-none absolute inset-0 z-0 esh-document-watermark select-none print:hidden"
                  style={{ backgroundImage: ESH_WATERMARK_CSS_URL, backgroundSize: "100px 50px", backgroundRepeat: "repeat" }}
                  aria-hidden="true"
                />

                <div
                  className="relative z-10 w-[190mm] min-w-[190mm] max-w-[190mm] flex flex-1 flex-col space-y-4"
                  style={{ width: "190mm", minWidth: "190mm", maxWidth: "190mm" }}
                >
                  <OfficialDocumentHeader
                    badgeText={isAr ? "قائمة التأمين" : "ASSURANCE"}
                    documentTitle={isAr ? "قائمة تأمين اللاعبين" : "LISTE D'ASSURANCE DES JOUEURS"}
                    referenceNumber={`ASS-${new Date().getFullYear()}-001-ESH`}
                    date={new Date()}
                    locale={locale}
                    className="mb-2"
                  />

                  <div className="space-y-6 text-black">
                    {groups
                      .filter((g) => g.rows.length > 0)
                      .map((g) => (
                        <div key={g.teamId} className="category-section space-y-1.5" style={{ breakInside: "auto", pageBreakInside: "auto" }}>
                          <div
                            className="category-header bg-zinc-100/90 px-3 py-1.5 text-black"
                            style={{ breakAfter: "avoid", pageBreakAfter: "avoid" }}
                          >
                            <h3 className="font-bold text-[14px]">{g.label}</h3>
                          </div>
                          <table className="w-full text-start text-[12px] border-collapse border border-zinc-300 text-black">
                            <thead style={{ display: "table-header-group" }}>
                              <tr className="bg-zinc-100 font-bold" style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
                                <th className="border border-zinc-300 px-2 py-1.5 text-center w-8">#</th>
                                <th className="border border-zinc-300 px-3 py-1.5 text-start">{isAr ? "اللاعب" : "Joueur"}</th>
                                <th className="border border-zinc-300 px-3 py-1.5 text-start">{isAr ? "المركز" : "Poste"}</th>
                                <th className="border border-zinc-300 px-3 py-1.5 text-center">{isAr ? "حالة التأمين" : "Statut"}</th>
                                <th className="border border-zinc-300 px-3 py-1.5 text-center">{isAr ? "من" : "Du"}</th>
                                <th className="border border-zinc-300 px-3 py-1.5 text-center">{isAr ? "إلى" : "Au"}</th>
                                <th className="border border-zinc-300 px-3 py-1.5 text-start">{isAr ? "رقم الوثيقة" : "N° police"}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.rows.map((r, i) => (
                                <tr key={r.id} className="odd:bg-white even:bg-zinc-50/50" style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
                                  <td className="border border-zinc-300 px-2 py-1.5 text-center font-mono">{i + 1}</td>
                                  <td className="border border-zinc-300 px-3 py-1.5 font-bold">{r.name}</td>
                                  <td className="border border-zinc-300 px-3 py-1.5">{r.position}</td>
                                  <td className="border border-zinc-300 px-3 py-1.5 text-center font-semibold">{r.statusLabel}</td>
                                  <td className="border border-zinc-300 px-3 py-1.5 text-center font-mono">{r.startDate || "—"}</td>
                                  <td className="border border-zinc-300 px-3 py-1.5 text-center font-mono">{r.endDate || "—"}</td>
                                  <td className="border border-zinc-300 px-3 py-1.5 font-mono">{r.policyNumber || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot style={{ display: "table-footer-group" }}>
                              <tr className="bg-zinc-100 font-bold" style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
                                <td colSpan={3} className="border border-zinc-300 px-3 py-1.5 text-start font-bold">
                                  {isAr ? `المجموع (${g.label})` : `Total (${g.label})`}
                                </td>
                                <td colSpan={4} className="border border-zinc-300 px-3 py-1.5 text-end font-bold font-mono">
                                  <span className="print-document-total-count">{g.rows.length}</span> {isAr ? "لاعب" : "joueurs"}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      ))}

                    {/* Overall grand total when multiple categories exist */}
                    {groups.filter((g) => g.rows.length > 0).length > 1 && (
                      <div
                        className="grand-total-section flex justify-between items-center bg-zinc-100 border border-zinc-300 px-4 py-2 text-black font-bold text-[13px]"
                        style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
                      >
                        <span>{isAr ? "المجموع الكلي للاعبين المسجلين في القائمة:" : "TOTAL GÉNÉRAL DES JOUEURS :"}</span>
                        <span className="font-mono">
                          <span className="print-document-total-count">{total}</span> {isAr ? "لاعب" : "joueurs"}
                        </span>
                      </div>
                    )}
                    {total === 0 && (
                      <p className="py-8 text-center text-[13px]">{isAr ? "لا توجد بيانات للطباعة" : "Aucune donnée"}</p>
                    )}
                  </div>

                  {/* Player insurance is approved by the association president. */}
                  <div
                    className="document-signatures signatures-section flex justify-end text-right pt-8 mt-auto text-black"
                    style={{ breakInside: "avoid", pageBreakInside: "avoid", pageBreakBefore: "avoid", breakBefore: "avoid" }}
                  >
                    <div className="min-w-[220px]">
                      <p className="font-bold">{isAr ? "رئيس الجمعية" : "Le Président de l'association"}</p>
                      <div className="h-14" />
                    </div>
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