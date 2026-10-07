"use client";

import { printDocumentElement } from "@/lib/documents/print-helper";
import { Button } from "@/components/ui/button";
import { Printer, X, CheckSquare } from "lucide-react";
import { OfficialDocumentHeader } from "@/components/documents/official-document-header";
import { getPlayerDisplayName } from "@/lib/utils";
import { ESH_DOCUMENT_FONT_FAMILY, ESH_WATERMARK_CSS_URL } from "@/lib/documents/watermark";

export interface AttendanceSheetPlayerData {
  id: string;
  firstName: string;
  lastName: string;
  firstNameFr?: string | null;
  lastNameFr?: string | null;
  shirtNumber: number | null;
  position: string;
  currentStatus?: string;
}

export interface OfficialAttendanceSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: {
    id: string;
    date: Date | string;
    startTime: Date | string;
    endTime: Date | string;
    teamName: string;
    teamCategory?: string;
    coachName?: string | null;
    location?: string | null;
    status?: string;
    notes?: string | null;
  };
  players: AttendanceSheetPlayerData[];
  locale?: string;
}

const POSITION_LABELS: Record<string, { ar: string; fr: string }> = {
  GOALKEEPER: { ar: "حارس مرمى", fr: "Gardien" },
  DEFENDER: { ar: "مدافع", fr: "Défenseur" },
  MIDFIELDER: { ar: "وسط ميدان", fr: "Milieu" },
  FORWARD: { ar: "مهاجم", fr: "Attaquant" }
};

const formatHHMM = (d: Date | string) => {
  const date = new Date(d);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

export function OfficialAttendanceSheetModal({
  isOpen,
  onClose,
  session,
  players,
  locale = "ar"
}: OfficialAttendanceSheetModalProps) {
  const isAr = locale === "ar";
  const docId = `official-training-attendance-${session.id}`;

  if (!isOpen) return null;

  const sortedPlayers = [...players].sort((a, b) => {
    if (a.shirtNumber !== null && b.shirtNumber !== null) {
      return a.shirtNumber - b.shirtNumber;
    }
    if (a.shirtNumber !== null) return -1;
    if (b.shirtNumber !== null) return 1;
    return a.lastName.localeCompare(b.lastName);
  });

  const printDocument = () => {
    printDocumentElement(
      docId,
      isAr
        ? `ورقة حضور تدريب — ${session.teamName}`
        : `Feuille de Présence — ${session.teamName}`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Modal Controls (Screen Only) */}
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-6 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-emerald-600" />
            <div>
              <h2 className="text-sm font-bold text-foreground sm:text-base">
                {isAr ? "معاينة ورقة حضور الحصة التدريبية" : "Aperçu de la Feuille de Présence"}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={printDocument}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2 shadow-xs"
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
            className="printable-document esh-security-watermark relative w-full max-w-[210mm] bg-white text-black p-6 sm:p-10 shadow-xl border border-zinc-200 print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none"
            style={{
              fontFamily: ESH_DOCUMENT_FONT_FAMILY,
              pageBreakInside: "auto",
              breakInside: "auto"
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

            {/* Print Pagination & Formatting Styles */}
            <style
              dangerouslySetInnerHTML={{
                __html: `
                @media print {
                  @page {
                    size: A4 portrait;
                    margin: 10mm 10mm 12mm 10mm;
                  }
                  thead {
                    display: table-header-group !important;
                  }
                  tbody {
                    display: table-row-group !important;
                  }
                  tr {
                    break-inside: avoid !important;
                    page-break-inside: avoid !important;
                  }
                  .signature-block {
                    break-inside: avoid !important;
                    page-break-inside: avoid !important;
                  }
                }
              ` }} />

            {/* Document Content on top of watermark */}
            <div className="relative z-10">
              {/* 1. OFFICIAL STATE & CLUB BANNER */}
              <OfficialDocumentHeader
                badgeText={isAr ? "ورقة الحضور" : "PRÉSENCE"}
                referenceNumber={`ESH/TRN/${session.id.slice(-6).toUpperCase()}/${new Date(session.date).getFullYear()}`}
                date={session.date}
                documentTitle={
                  isAr
                    ? "ورقة حضور الحصة التدريبية"
                    : "Feuille de Présence à la Séance d'Entraînement"
                }
                documentSubtitle={
                  isAr
                    ? `الفريق: ${session.teamName} — التوقيت: من ${formatHHMM(session.startTime)} إلى ${formatHHMM(session.endTime)}`
                    : `Équipe : ${session.teamName} — Horaire : ${formatHHMM(session.startTime)} à ${formatHHMM(session.endTime)}`
                }
                locale={locale}
              />

              {/* 2. ADMINISTRATIVE & SESSION CONTEXT */}
              <div
                className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[14px] sm:text-[15px] p-3 my-4 bg-zinc-50 border border-zinc-200 text-black"
                style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY }}
              >
                <div>
                  <span className="text-zinc-600 block text-[13px] font-semibold">
                    {isAr ? "الفريق / الفئة:" : "Équipe / Catégorie :"}
                  </span>
                  <span className="font-bold text-black text-[15px] sm:text-[16px]">{session.teamName}</span>
                </div>
                <div>
                  <span className="text-zinc-600 block text-[13px] font-semibold">
                    {isAr ? "المدرب المشرف:" : "Entraîneur Responsable :"}
                  </span>
                  <span className="font-bold text-black text-[15px] sm:text-[16px]">
                    {session.coachName || (isAr ? "المدرب الرئيسي" : "Staff Technique")}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-600 block text-[13px] font-semibold">
                    {isAr ? "مكان الحصة:" : "Lieu d'entraînement :"}
                  </span>
                  <span className="font-bold text-black text-[15px] sm:text-[16px]">
                    {session.location || (isAr ? "الملعب البلدي - سيدي حسني" : "Stade Municipal Sidi Hosni")}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-600 block text-[13px] font-semibold">
                    {isAr ? "التاريخ والتوقيت:" : "Date & Créneau :"}
                  </span>
                  <span className="font-bold text-black text-[14px] sm:text-[15px]">
                    {formatHHMM(session.startTime)} - {formatHHMM(session.endTime)}
                  </span>
                </div>
              </div>

              {/* 3. ROSTER ATTENDANCE TABLE */}
              <div className="mb-6 w-full">
                <div className="w-full overflow-x-auto print:overflow-visible">
                  <table className="w-full text-[13px] sm:text-[14px] border-collapse border border-zinc-300 text-black">
                    <thead style={{ display: "table-header-group" }}>
                      <tr
                        className="bg-zinc-100 text-black font-bold text-[13px] sm:text-[14px]"
                        style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY, breakInside: "avoid" }}
                      >
                        <th className="border border-zinc-300 px-2 py-2 text-center w-10">#</th>
                        <th className="border border-zinc-300 px-2 py-2 text-center w-12">{isAr ? "الرقم" : "N°"}</th>
                        <th className="border border-zinc-300 px-3 py-2 text-start">{isAr ? "اسم ولقب اللاعب" : "Nom & Prénom"}</th>
                        <th className="border border-zinc-300 px-2 py-2 text-center w-24">{isAr ? "المركز" : "Poste"}</th>
                        <th className="border border-zinc-300 px-2 py-2 text-center w-16 bg-zinc-50">{isAr ? "حاضر" : "Présent"}</th>
                        <th className="border border-zinc-300 px-2 py-2 text-center w-16 bg-zinc-50">{isAr ? "غائب" : "Absent"}</th>
                        <th className="border border-zinc-300 px-2 py-2 text-center w-20 bg-zinc-50">{isAr ? "مبرر" : "Justifié"}</th>
                        <th className="border border-zinc-300 px-3 py-2 text-start w-48">{isAr ? "الملاحظات" : "Observations"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPlayers.map((player, idx) => (
                        <tr
                          key={player.id}
                          className={idx % 2 === 1 ? "bg-zinc-50/50" : "bg-white"}
                          style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
                        >
                          <td
                            className="border border-zinc-300 px-2 py-2.5 text-center font-bold text-black"
                            style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY }}
                          >
                            {idx + 1}
                          </td>
                          <td
                            className="border border-zinc-300 px-2 py-2.5 text-center text-black font-bold"
                            style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY }}
                          >
                            {player.shirtNumber ? player.shirtNumber : "—"}
                          </td>
                          <td
                            className="border border-zinc-300 px-3 py-2.5 font-bold text-black text-[14px] sm:text-[15px]"
                            style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY }}
                          >
                            {getPlayerDisplayName(player, locale)}
                          </td>
                          <td
                            className="border border-zinc-300 px-2 py-2.5 text-center text-black font-medium text-[13px]"
                            style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY }}
                          >
                            {POSITION_LABELS[player.position]?.[isAr ? "ar" : "fr"] || player.position || "—"}
                          </td>
                          {/* Checkbox box: Present */}
                          <td className="border border-zinc-300 px-2 py-2.5 text-center align-middle">
                            <div className="w-5 h-5 mx-auto border-2 border-black rounded-xs bg-white" />
                          </td>
                          {/* Checkbox box: Absent */}
                          <td className="border border-zinc-300 px-2 py-2.5 text-center align-middle">
                            <div className="w-5 h-5 mx-auto border-2 border-black rounded-xs bg-white" />
                          </td>
                          {/* Checkbox box: Excused / Injured */}
                          <td className="border border-zinc-300 px-2 py-2.5 text-center align-middle">
                            <div className="w-5 h-5 mx-auto border-2 border-black rounded-xs bg-white" />
                          </td>
                          {/* Observations */}
                          <td className="border border-zinc-300 px-3 py-2.5 text-start text-zinc-400 text-xs">
                            <span className="print:text-transparent">....................................................</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. OFFICIAL SIGNATURE (ROLE ONLY: COACH) */}
              <div
                className="signature-block flex justify-end pt-8 mt-6 text-black text-center"
                style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
              >
                <div className="w-64 sm:w-72">
                  <p
                    className="font-bold text-[16px] sm:text-[17px] text-black"
                    style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY }}
                  >
                    {isAr ? "المدرب" : "L'Entraîneur"}
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
