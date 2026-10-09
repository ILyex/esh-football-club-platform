"use client";

import { printDocumentElement } from "@/lib/documents/print-helper";
import { Button } from "@/components/ui/button";
import { Printer, X, FileText } from "lucide-react";
import { OfficialDocumentHeader } from "@/components/documents/official-document-header";
import { getPlayerDisplayName } from "@/lib/utils";
import type { SessionPlayerData } from "./testing-session-sheet";
import { ESH_DOCUMENT_FONT_FAMILY, ESH_WATERMARK_CSS_URL } from "@/lib/documents/watermark";
import { calculateYoYoIR2VO2max } from "@/lib/testing/protocols/yoyo-ir2";
import { calculateYoYoVO2max } from "@/lib/testing/protocols/yoyo-ir1";

interface OfficialTestingReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: {
    id: string;
    title: string;
    date: Date | string;
    location?: string | null;
    protocolName: string;
    protocolCode: string;
    teamName: string;
    teamCategory: string;
    conductorName: string;
  };
  players: SessionPlayerData[];
  locale?: string;
}

const POSITION_LABELS: Record<string, { ar: string; fr: string }> = {
  GOALKEEPER: { ar: "حارس مرمى", fr: "Gardien" },
  DEFENDER: { ar: "مدافع", fr: "Défenseur" },
  MIDFIELDER: { ar: "وسط ميدان", fr: "Milieu" },
  FORWARD: { ar: "مهاجم", fr: "Attaquant" },
};

function getPlayerPositionLabel(pos: string | null | undefined, locale: string): string {
  if (!pos) return "—";
  const normalized = pos.toUpperCase();
  const match = POSITION_LABELS[normalized];
  if (match) {
    return locale === "ar" ? match.ar : match.fr;
  }
  return pos;
}

export function OfficialTestingReportModal({
  isOpen,
  onClose,
  session,
  players,
  locale = "ar"
}: OfficialTestingReportModalProps) {
  const isAr = locale === "ar";
  const docId = `official-pv-testing-${session.id}`;

  if (!isOpen) return null;

  // Filter valid players and sort by rank
  const validPlayers = players.filter((p) => p.status === "VALID");
  const sortedPlayers = [...validPlayers].sort((a, b) => {
    const distA = Number(a.summaryScore || a.measurements.distance || 0);
    const distB = Number(b.summaryScore || b.measurements.distance || 0);
    return distB - distA;
  });

  const isYoYo =
    session.protocolCode === "YOYO_IR1" ||
    session.protocolCode === "YOYO_IR2" ||
    session.protocolName.toLowerCase().includes("yo-yo");

  const printDocument = () => {
    printDocumentElement(
      docId,
      isAr
        ? `محضر نتائج الاختبارات البدنية — ${session.title} — ${session.teamName}`
        : `PV des Tests Physiques — ${session.title} — ${session.teamName}`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Modal Controls (Screen Only) */}
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-6 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-600" />
            <div>
              <h2 className="text-sm font-bold text-foreground sm:text-base">
                {isAr ? "معاينة محضر نتائج الاختبارات البدنية" : "Aperçu du Procès-Verbal des Tests"}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={printDocument}
              size="sm"
              className="bg-club-primary hover:bg-club-primary-hover text-white font-semibold flex items-center gap-2 shadow-xs"
            >
              <Printer className="h-4 w-4" />
              <span>{isAr ? "طباعة" : "Imprimer"}</span>
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Scrollable Document Container */}
        <div className="flex flex-col items-center min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-200/80 dark:bg-zinc-950/80">
          {/* Official Document Sheet */}
          <div
            id={docId}
            className="printable-document official-testing-report esh-security-watermark relative w-full max-w-[210mm] bg-white text-black p-6 sm:p-10 shadow-xl border border-zinc-200 print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none"
            style={{
              fontFamily: ESH_DOCUMENT_FONT_FAMILY
            }}
          >
            {/* Dedicated Visible Anti-Counterfeit Watermark Pattern Layer */}
            <div
              className="pointer-events-none absolute inset-0 z-0 esh-document-watermark select-none print:hidden opacity-100"
              style={{
                backgroundImage: ESH_WATERMARK_CSS_URL,
                backgroundSize: "100px 50px",
                backgroundRepeat: "repeat"
              }}
              aria-hidden="true"
            />

            {/* Print Pagination & Flow Stylesheet */}
            <style
              dangerouslySetInnerHTML={{
                __html: `
                  @media print {
                    @page { size: A4 portrait; margin: 10mm 12mm 10mm 12mm; }
                    .official-testing-results-table thead { display: table-row-group !important; }
                    tbody { display: table-row-group !important; }
                    tr { break-inside: avoid !important; page-break-inside: avoid !important; }
                    th, td { break-inside: avoid !important; page-break-inside: avoid !important; }
                    .signature-block {
                      break-inside: avoid !important;
                      page-break-inside: avoid !important;
                      page-break-before: auto !important;
                      margin-top: 24px !important;
                      padding-top: 16px !important;
                    }
                  }
                `
              }}
            />

            {/* Document Content on top of watermark */}
            <div className="relative z-10">
              {/* 1. OFFICIAL STATE & CLUB BANNER */}
              <OfficialDocumentHeader
                badgeText={isAr ? "محضر تقييم" : "PV TECHNIQUE"}
                referenceNumber={`ESH/DEP/${session.id.slice(-6).toUpperCase()}/${new Date().getFullYear()}`}
                date={session.date}
                documentTitle={
                  isAr
                    ? "محضر نتائج الاختبار البدني للاعبين"
                    : "Résultats des Tests Physiques des Joueurs"
                }
                documentSubtitle={
                  isYoYo
                    ? "Yo-Yo Test"
                    : (isAr
                        ? `البروتوكول المعتمد: ${session.protocolName}`
                        : `Protocole Homologué : ${session.protocolName}`)
                }
                locale={locale}
              />

              {/* 3. FORMAL ATHLETES RESULTS TABLE */}
              <div className="mb-6 w-full">
                <div className="flex items-center justify-between mb-2">
                  <h4
                    className="text-[16px] sm:text-[17px] font-bold text-black uppercase"
                    style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY }}
                  >
                    {isAr ? "جدول النتائج الفردية وترتيب اللاعبين:" : "Tableau Nominatif des Résultats et Classement :"}
                  </h4>
                  <span
                    className="text-xs text-zinc-600 font-semibold"
                    style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY }}
                  >
                    {isAr ? "(الترتيب حسب المسافة المقطوعة)" : "(Classé par distance)"}
                  </span>
                </div>

                <div className="w-full overflow-x-auto print:overflow-visible">
                  <table className="official-testing-results-table w-full text-[13px] sm:text-[14px] border-collapse border border-zinc-300 text-black">
                    <thead style={{ display: "table-header-group" }}>
                      <tr
                        className="bg-zinc-100 text-black font-bold text-[13px] sm:text-[14px]"
                        style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY, breakInside: "avoid" }}
                      >
                        <th className="border border-zinc-300 px-2 py-2 text-center w-10">#</th>
                        <th className="border border-zinc-300 px-2 py-2 text-center w-14">{isAr ? "القميص" : "N°"}</th>
                        <th className="border border-zinc-300 px-3 py-2 text-start">{isAr ? "الاسم واللقب" : "Nom & Prénom"}</th>
                        <th className="border border-zinc-300 px-2 py-2 text-center w-24">{isAr ? "المركز" : "Poste"}</th>
                        {isYoYo && (
                          <th className="border border-zinc-300 px-2 py-2 text-center w-20">{isAr ? "المستوى" : "Niveau"}</th>
                        )}
                        <th className="border border-zinc-300 px-2 py-2 text-center w-24">
                          {isAr ? "المسافة (م)" : "Distance (m)"}
                        </th>
                        {isYoYo && (
                          <th className="border border-zinc-300 px-2 py-2 text-center w-24">
                            {isAr ? "VO₂ تقديري" : "VO₂ estimé"}
                          </th>
                        )}
                        <th className="border border-zinc-300 px-3 py-2 text-start">{isAr ? "الملاحظات" : "Observations"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPlayers.map((player, idx) => {
                        const dist = Number(player.summaryScore || player.measurements.distance || 0);
                        const rawVo2 = Number(player.secondaryScore || player.measurements.vo2max || 0);
                        const vo2 = rawVo2 > 0
                          ? rawVo2
                          : (dist > 0 && isYoYo
                            ? session.protocolCode === "YOYO_IR2" ? calculateYoYoIR2VO2max(dist) : calculateYoYoVO2max(dist)
                            : 0);
                        const lvl = player.measurements.level;
                        const sht = player.measurements.shuttle;

                        return (
                          <tr
                            key={player.id}
                            className={idx % 2 === 1 ? "bg-zinc-50/50" : "bg-white"}
                            style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
                          >
                            <td
                              className="border border-zinc-300 px-2 py-2 text-center font-bold text-black"
                              style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY }}
                            >
                              {idx + 1}
                            </td>
                            <td
                              className="border border-zinc-300 px-2 py-2 text-center text-black"
                              style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY }}
                            >
                              {player.shirtNumber ? `#${player.shirtNumber}` : "—"}
                            </td>
                            <td
                              className="border border-zinc-300 px-3 py-2 font-bold text-black text-[14px] sm:text-[15px]"
                              style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY }}
                            >
                              {getPlayerDisplayName(player, locale)}
                            </td>
                            <td
                              className="border border-zinc-300 px-2 py-2 text-center text-black font-medium whitespace-nowrap"
                              style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY, fontSize: "20px", lineHeight: 1.25 }}
                            >
                              {getPlayerPositionLabel(player.position, locale)}
                            </td>
                            {isYoYo && (
                              <td
                                className="border border-zinc-300 px-2 py-2 text-center font-bold text-black"
                                style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY }}
                              >
                                {lvl && sht ? `${lvl}.${sht}` : "—"}
                              </td>
                            )}
                            <td
                              className="border border-zinc-300 px-2 py-2 text-center font-bold text-black"
                              style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY }}
                            >
                              {dist > 0 ? `${dist.toLocaleString("fr-DZ")}` : "—"}
                            </td>
                            {isYoYo && (
                              <td
                                className="border border-zinc-300 px-2 py-2 text-center font-semibold text-black"
                                style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY }}
                              >
                                {vo2 > 0 ? vo2 : "—"}
                              </td>
                            )}
                            <td
                              className="border border-zinc-300 px-3 py-2 text-zinc-600 text-[12px]"
                              style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY }}
                            >
                              {player.notes || (player.isCorrected ? (isAr ? "مصحح بعد التدقيق" : "Corrigé") : "—")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. OFFICIAL SIGNATURES STRICTLY BY ROLE ONLY */}
              <div
                className="document-signatures document-signatures-multiple signature-block grid grid-cols-3 gap-6 pt-8 mt-6 text-black"
                style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
              >
                {/* Fitness Trainer */}
                <div>
                  <p
                    className="font-bold text-black"
                    style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY }}
                  >
                    {isAr ? "المعد البدني" : "Le Préparateur Physique"}
                  </p>
                  <div className="h-24" />
                </div>

                {/* Club Doctor */}
                <div>
                  <p
                    className="font-bold text-black"
                    style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY }}
                  >
                    {isAr ? "طبيب النادي" : "Le Médecin du Club"}
                  </p>
                  <div className="h-24" />
                </div>

                {/* Technical Director */}
                <div>
                  <p
                    className="font-bold text-black"
                    style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY }}
                  >
                    {isAr ? "المدير الفني" : "Le Directeur Technique"}
                  </p>
                  <div className="h-24" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
