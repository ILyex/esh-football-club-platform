"use client";

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
            <div className="flex-1 overflow-auto p-4 sm:p-6 bg-zinc-950/20 flex justify-center">
              <div
                id={elementId}
                className="printable-document player-list-document esh-security-watermark relative mx-auto w-[210mm] min-h-[297mm] shrink-0 bg-white text-zinc-900 p-[10mm] shadow-xl border border-zinc-200 text-start flex flex-col"
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

                <div
                  className="relative z-10 w-[190mm] min-w-[190mm] max-w-[190mm]"
                  style={{ width: "190mm", minWidth: "190mm", maxWidth: "190mm" }}
                >
                  {/* Official Institutional Header */}
                  <OfficialDocumentHeader
                    badgeText={isAr ? "قائمة اللاعبين" : "LISTE JOUEURS"}
                    documentTitle={isAr ? "قائمة اللاعبين" : "LISTE DES JOUEURS"}
                    locale={locale}
                  />

                  {/* Optional category context; the redundant season/date line
                      was removed so the table follows the document title. */}
                  {teamCategoryName && (
                    <div className="my-3 text-center">
                      <p className="mt-1 text-base font-bold text-zinc-800">
                        {isAr ? `الفئة الرياضية: ${teamCategoryName}` : `Catégorie: ${teamCategoryName}`}
                      </p>
                    </div>
                  )}

                  {/* Clean Institutional Table */}
                  <div className="mt-5 w-full" style={{ width: "100%", maxWidth: "none" }}>
                      <table className="w-full border-collapse border border-zinc-300 text-[18px] leading-relaxed" style={{ width: "100%", maxWidth: "none", tableLayout: "fixed" }}>
                      <thead>
                        <tr className="bg-zinc-100 text-zinc-900 font-bold">
                          <th className="py-2.5 px-3 border border-zinc-300 text-center w-12">#</th>
                          <th className="py-2.5 px-4 border border-zinc-300 text-start">
                            {isAr ? "اسم ولقب اللاعب" : "Nom et prénom du joueur"}
                          </th>
                          <th className="py-2.5 px-4 border border-zinc-300 text-center w-40">
                            {isAr ? "تاريخ الميلاد" : "Date de naissance"}
                          </th>
                          <th className="py-2.5 px-4 border border-zinc-300 text-center w-44">
                            {isAr ? "رقم الرخصة" : "N° de licence"}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {players.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-zinc-500">
                              {isAr ? "لا توجد أسماء مسجلة في القائمة" : "Aucun joueur dans la liste"}
                            </td>
                          </tr>
                        ) : (
                          players.map((p, idx) => {
                            const displayName = getPlayerDisplayName(p, locale);
                            const dob = formatDateDMY(p.dateOfBirth);
                            const licence = p.licenceNumber?.trim() || "—";
                            return (
                              <tr
                                key={p.id}
                                className={`border-b border-zinc-300 ${idx % 2 === 1 ? "bg-zinc-50/60" : "bg-white"}`}
                              >
                                <td className="py-2 px-3 border border-zinc-300 text-center font-medium">
                                  {idx + 1}
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
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 flex justify-between px-2 text-sm text-zinc-600">
                    <span>{isAr ? `إجمالي اللاعبين المسجلين: ${players.length} لاعب` : `Total des joueurs: ${players.length}`}</span>
                  </div>
                </div>

                {/* Institutional Signatures & Stamp Block by Role Only */}
                <div className="relative z-10 mt-6 flex shrink-0 items-end justify-between px-4 pt-4 text-center text-sm text-zinc-700">
                  <div>
                    <p className="font-bold text-sm text-zinc-900 mb-1">{isAr ? "الأمين العام للنادي" : "Le Secrétaire Général"}</p>
                    <p className="text-[11px] text-zinc-500">{isAr ? "التوقيع والتأشيرة" : "Signature & Visa"}</p>
                    <div className="h-16"></div>
                  </div>

                  <div className="text-center">
                    <p className="font-bold text-sm text-zinc-900 mb-1">{isAr ? "ختم النادي الرسمي" : "Cachet Officiel"}</p>
                    <div className="h-16 flex items-center justify-center">
                    </div>
                  </div>

                  <div>
                    <p className="font-bold text-sm text-zinc-900 mb-1">{isAr ? "رئيس النادي" : "Le Président"}</p>
                    <p className="text-[11px] text-zinc-500">{isAr ? "التوقيع والاعتماد" : "Signature & Approbation"}</p>
                    <div className="h-16"></div>
                  </div>
                </div>
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
