"use client";
import { A4Pager } from "@/components/shared/a4-pager";

import { useState } from "react";
import { Printer, X, Users, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OfficialDocumentHeader } from "@/components/documents/official-document-header";
import { printDocumentElement } from "@/lib/documents/print-helper";
import { getPlayerDisplayName } from "@/lib/utils";
import { ESH_DOCUMENT_FONT_FAMILY, ESH_WATERMARK_CSS_URL } from "@/lib/documents/watermark";

export interface PrintablePlayer {
  id: string;
  firstName: string;
  lastName: string;
  firstNameFr?: string | null;
  lastNameFr?: string | null;
  dateOfBirth: Date | string;
  licenceNumber?: string | null;
  shirtNumber?: number | null;
  position?: string;
  teamCategory?: string | null;
}

interface PlayerPrintListModalProps {
  players: PrintablePlayer[];
  teamCategoryName?: string;
  locale?: string;
}

function formatDateDMY(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dateObj = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return "—";
  const day = String(dateObj.getDate()).padStart(2, "0");
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const year = dateObj.getFullYear();
  return `${day}/${month}/${year}`;
}

export function PlayerPrintListModal({
  players,
  teamCategoryName,
  locale = "ar"
}: PlayerPrintListModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isAr = locale === "ar";
  const elementId = "official-players-list-printable";
  // Keep the screen preview paginated like the printed A4 document. The
  // roster table uses compact, fixed-height rows, so 15 entries leave room
  // for its repeated heading and the final signature on the last sheet.
  const pageSize = 15;
  const playerPages = players.length > 0
    ? Array.from({ length: Math.ceil(players.length / pageSize) }, (_, pageIndex) => ({
      pageIndex,
      players: players.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)
    }))
    : [{ pageIndex: 0, players: [] as PrintablePlayer[] }];

  const handlePrint = () => {
    printDocumentElement(
      elementId,
      isAr ? "قائمة اللاعبين — الجمعية الرياضية أمل سيدي حسني لكرة القدم" : "Liste des Joueurs — Association Sportive Espoir Sidi Hosni de Football"
    );
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5"
      >
        <Eye className="h-4 w-4" />
        <span>{isAr ? "معاينة وطباعة" : "Aperçu & Impression"}</span>
      </Button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="relative flex flex-col w-full max-w-4xl max-h-[92vh] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/80 px-6 py-3.5 bg-muted/40">
              <div className="flex items-center gap-2.5">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  {isAr ? "معاينة قائمة اللاعبين" : "Aperçu — Liste des joueurs"}
                </h3>
              </div>
              <div className="flex items-center gap-2">
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

            {/* Modal Body / Scrollable Document Preview */}
            <div className="flex-1 overflow-auto p-4 sm:p-6 bg-zinc-950/20 flex items-start justify-center">
              <A4Pager targetId={elementId} />
              <div
              id={elementId}
                className="printable-document player-list-document mx-auto flex w-[210mm] shrink-0 flex-col gap-6 text-start text-zinc-900"
                style={{
                  fontFamily: ESH_DOCUMENT_FONT_FAMILY,
                  direction: isAr ? "rtl" : "ltr"
                }}
              >
                {playerPages.map(({ pageIndex, players: pagePlayers }) => {
                  const isLastPage = pageIndex === playerPages.length - 1;
                  const firstPlayerNumber = pageIndex * pageSize;
                  return (
                <section
                  key={pageIndex}
                  className={`print-preview-sheet relative mx-auto flex min-h-[297mm] w-[210mm] shrink-0 flex-col border border-zinc-200 bg-white p-[10mm] shadow-xl ${isLastPage ? "" : "print-preview-sheet-break"}`}
                  style={{ backgroundColor: "white", boxSizing: "border-box" }}
                >
                  <div
                    className="pointer-events-none absolute inset-0 z-0 esh-document-watermark select-none print:hidden"
                    style={{
                      backgroundImage: ESH_WATERMARK_CSS_URL,
                      backgroundSize: "100px 50px",
                      backgroundRepeat: "repeat"
                    }}
                    aria-hidden="true"
                  />
                  <div className="relative z-10 w-full">
                  {/* The official masthead belongs to the first sheet only. */}
                  {pageIndex === 0 && (
                    <OfficialDocumentHeader
                      badgeText={isAr ? "قائمة اللاعبين" : "LISTE JOUEURS"}
                      documentTitle={isAr ? "قائمة اللاعبين" : "LISTE DES JOUEURS"}
                      locale={locale}
                    />
                  )}

                  {/* Optional category context; the redundant season/date line
                      was removed so the table follows the document title. */}
                  {pageIndex === 0 && teamCategoryName && (
                    <div className="my-3 text-center">
                      <p className="mt-1 text-base font-bold text-zinc-800">
                        {isAr ? `الفئة الرياضية: ${teamCategoryName}` : `Catégorie: ${teamCategoryName}`}
                      </p>
                    </div>
                  )}

                  {/* Clean Institutional Table */}
                  <div className="mt-5 w-full" style={{ width: "100%", maxWidth: "none" }}>
                      <table className="w-full border-collapse border border-zinc-300 text-[18px] leading-relaxed" style={{ width: "100%", maxWidth: "none", tableLayout: "fixed" }}>
                      <colgroup>
                        <col style={{ width: "12%" }} />
                        <col style={{ width: "40%" }} />
                        <col style={{ width: "24%" }} />
                        <col style={{ width: "24%" }} />
                      </colgroup>
                      {(
                        <thead>
                          <tr className="bg-zinc-100 text-zinc-900 font-bold">
                            <th className="py-2.5 px-3 border border-zinc-300 text-center">#</th>
                            <th className="py-2.5 px-4 border border-zinc-300 text-start">
                              {isAr ? "اسم ولقب اللاعب" : "Nom et prénom du joueur"}
                            </th>
                            <th className="py-2.5 px-4 border border-zinc-300 text-center">
                              {isAr ? "تاريخ الميلاد" : "Date de naissance"}
                            </th>
                            <th className="py-2.5 px-4 border border-zinc-300 text-center">
                              {isAr ? "رقم الرخصة" : "N° de licence"}
                            </th>
                          </tr>
                        </thead>
                      )}
                      <tbody>
                        {pagePlayers.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-zinc-500">
                              {isAr ? "لا توجد أسماء مسجلة في القائمة" : "Aucun joueur dans la liste"}
                            </td>
                          </tr>
                        ) : (
                          pagePlayers.map((p, idx) => {
                            const displayName = getPlayerDisplayName(p, locale);
                            const dob = formatDateDMY(p.dateOfBirth);
                            const licence = p.licenceNumber?.trim() || "—";
                            return (
                              <tr
                                key={p.id}
                                className={`border-b border-zinc-300 ${idx % 2 === 1 ? "bg-zinc-50/60" : "bg-white"}`}
                              >
                                <td className="py-2 px-3 border border-zinc-300 text-center font-medium">
                                  {firstPlayerNumber + idx + 1}
                                </td>
                                <td className="py-2 px-4 border border-zinc-300 font-bold text-zinc-900">
                                  {displayName}
                                </td>
                                <td className="py-2 px-4 border border-zinc-300 text-center font-medium font-mono">
                                  {dob}
                                </td>
                                <td className="py-2 px-4 border border-zinc-300 text-center font-bold tracking-wider font-mono text-zinc-800">
                                  {licence}
                                </td>
                              </tr>
                            );
                          })
                        )}
                        {isLastPage && (
                          <tr className="bg-zinc-100 font-bold text-zinc-900">
                            <td className="border border-zinc-300 px-1 py-2 text-center text-xl leading-tight">
                              {isAr ? "الإجمالي" : "Total"}
                            </td>
                            <td colSpan={3} className="print-document-total-count border border-zinc-300 px-4 py-2 text-start font-bold font-mono tabular-nums">
                              {players.length}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  </div>

                {/* The players department is approved by the association president. */}
                {isLastPage && <div className="document-signatures relative z-10 mt-6 flex shrink-0 justify-end px-4 pt-4 text-right text-zinc-700">
                  <div className="text-right">
                    <p className="mb-1 font-bold text-zinc-900">{isAr ? "رئيس الجمعية" : "Le Président de l'association"}</p>
                    <div className="h-16"></div>
                  </div>
                </div>}
                </section>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-border/80 px-6 py-3 bg-card">
              <span className="text-xs text-muted-foreground">
                {isAr ? `عدد اللاعبين: ${players.length}` : `Nombre de joueurs: ${players.length}`}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>
                  {isAr ? "إغلاق" : "Fermer"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}