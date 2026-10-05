"use client";

import { useState } from "react";
import { FileBadge, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OfficialDocumentHeader } from "@/components/documents/official-document-header";
import { printDocumentElement } from "@/lib/documents/print-helper";
import { getPlayerDisplayName } from "@/lib/utils";
import { ESH_DOCUMENT_FONT_FAMILY, ESH_WATERMARK_CSS_URL } from "@/lib/documents/watermark";

export interface OfficialPlayerAttestationModalProps {
  player: {
    id: string;
    firstName: string;
    lastName: string;
    firstNameFr?: string | null;
    lastNameFr?: string | null;
    dateOfBirth: Date | string;
    nationality: string;
    licenceNumber?: string | null;
    joiningDate?: Date | string | null;
    position?: string;
    shirtNumber?: number | null;
    teamName?: string | null;
    teamCategory?: string | null;
    photoUrl?: string | null;
  };
  locale?: string;
  triggerVariant?: "button" | "icon" | "outline";
  triggerLabel?: string;
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

export function OfficialPlayerAttestationModal({
  player,
  locale = "ar",
  triggerVariant = "button",
  triggerLabel
}: OfficialPlayerAttestationModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isAr = locale === "ar";
  const elementId = `official-player-attestation-${player.id}`;

  const displayName = getPlayerDisplayName(player, locale);
  const birthDateFormatted = formatDateDMY(player.dateOfBirth);
  const joiningDateFormatted = formatDateDMY(player.joiningDate || new Date("2026-08-15"));
  const licenceNo = player.licenceNumber?.trim() || (isAr ? "قيد الإصدار (FAF-26)" : "En cours (FAF-26)");
  const todayFormatted = formatDateDMY(new Date());

  const handlePrint = () => {
    printDocumentElement(
      elementId,
      isAr
        ? `شهادة إنتساب — ${displayName} — ESH SIDI HOSNI`
        : `Attestation Joueur — ${displayName} — ESH SIDI HOSNI`
    );
  };

  return (
    <>
      {triggerVariant === "button" && (
        <Button
          type="button"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="gap-1.5 text-xs font-bold bg-club-primary hover:bg-club-primary/90 text-white shadow-xs"
        >
          <FileBadge className="h-4 w-4" />
          <span>{triggerLabel || (isAr ? "شهادة إنتساب اللاعب" : "Attestation du Joueur")}</span>
        </Button>
      )}

      {triggerVariant === "outline" && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setIsOpen(true)}
          className="gap-1.5 text-xs font-semibold hover:border-club-primary/50 text-foreground"
        >
          <FileBadge className="h-3.5 w-3.5 text-club-primary" />
          <span>{triggerLabel || (isAr ? "شهادة إنتساب" : "Attestation")}</span>
        </Button>
      )}

      {triggerVariant === "icon" && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          title={isAr ? "عرض وطباعة شهادة إنتساب اللاعب" : "Attestation officielle du joueur"}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-club-primary transition-colors cursor-pointer"
        >
          <FileBadge className="h-4 w-4 text-club-primary" />
        </button>
      )}

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="absolute inset-0" onClick={() => setIsOpen(false)} />

          <div className="relative z-10 flex flex-col w-full max-w-4xl max-h-[92vh] bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
            {/* Header controls (hidden in print) */}
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3 shrink-0 print:hidden">
              <div className="flex items-center gap-2">
                <FileBadge className="h-4 w-4 text-club-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  {isAr ? "معاينة شهادة إنتساب اللاعب" : "Aperçu de l'attestation du joueur"}
                </h3>
                <span className="text-xs font-mono text-muted-foreground">({displayName})</span>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" onClick={handlePrint} className="gap-1.5 text-xs font-bold">
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

            {/* Document preview container */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-200/50 dark:bg-zinc-950/50 flex justify-center">
              <div
                id={elementId}
                className="printable-document esh-security-watermark relative bg-white text-black shadow-xl border border-zinc-200 w-full max-w-[210mm] min-h-[297mm] p-[16mm] flex flex-col justify-between"
                style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY, boxSizing: "border-box" }}
              >
                {/* Security watermark */}
                <div
                  className="pointer-events-none absolute inset-0 z-0 select-none print:hidden"
                  style={{ backgroundImage: ESH_WATERMARK_CSS_URL, backgroundSize: "100px 50px", backgroundRepeat: "repeat" }}
                  aria-hidden="true"
                />

                {/* Inner Content */}
                <div className="relative z-10 space-y-6">
                  {/* Official Institutional Header */}
                  <OfficialDocumentHeader
                    referenceNumber={`ESH-LIC-${player.id.slice(-6).toUpperCase()}`}
                    date={new Date()}
                    badgeText={isAr ? "شهادة إنتساب" : "ATTESTATION"}
                    documentTitle={isAr ? "شهادة إنتساب" : "ATTESTATION DU JOUEUR"}
                    locale={locale}
                  />

                  {/* Main Attestation Body - Clean, direct, no underlines or decorative boxes */}
                  <div
                    className="mt-6 space-y-5 text-black text-justify leading-relaxed"
                    style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY, fontSize: "19px", lineHeight: "2.1" }}
                  >
                    <p className="font-bold text-center text-[22px] mb-5">
                      {isAr
                        ? "رئيس نادي أمل سيدي حسني"
                        : "Le Président du Club Sportif Espoir Sidi Hosni"}
                    </p>

                    <p>
                      {isAr ? (
                        <>
                          يشهد رئيس نادي <strong>أمل سيدي حسني</strong> أن اللاعب:{" "}
                          <strong className="font-black text-[21px]">
                            {getPlayerDisplayName(player, "ar")}
                          </strong>
                          {player.firstNameFr && player.lastNameFr && (player.firstName || player.lastName) && (
                            <span className="font-mono text-[16px] text-zinc-800">
                              {" "}({player.firstNameFr} {player.lastNameFr})
                            </span>
                          )}
                          ، المولود بتاريخ:{" "}
                          <strong className="font-mono font-bold">{birthDateFormatted}</strong>{" "}
                          بـ: <strong className="font-bold">تيارت</strong>، من جنسية:{" "}
                          <strong className="font-bold">{player.nationality || "جزائرية"}</strong>.
                        </>
                      ) : (
                        <>
                          Le Président du club <strong>Espoir Sidi Hosni</strong> atteste que le joueur :{" "}
                          <strong className="font-black text-[20px]">
                            {getPlayerDisplayName(player, "fr")}
                          </strong>
                          , né le : <strong className="font-mono">{birthDateFormatted}</strong> à{" "}
                          <strong>Tiaret</strong>, de nationalité : <strong>{player.nationality || "Algérienne"}</strong>.
                        </>
                      )}
                    </p>

                    <p>
                      {isAr ? (
                        <>
                          والحامل للرخصة الرياضية رقم:{" "}
                          <strong className="font-mono text-[20px] font-black tracking-wider">
                            {licenceNo}
                          </strong>
                          ، هو لاعب مسجل رسمياً وبصفة قانونية ضمن صفوف النادي الرياضي الهاوي{" "}
                          <strong>«أمل سيدي حسني»</strong> في فئة:{" "}
                          <strong className="font-black">
                            {player.teamCategory || player.teamName || "الأكابر"}
                          </strong>{" "}
                          منذ تاريخ:{" "}
                          <strong className="font-mono font-bold">{joiningDateFormatted}</strong>
                          {player.shirtNumber ? (
                            <>
                              {" "}ويحمل القميص رقم:{" "}
                              <strong className="font-mono font-black">({player.shirtNumber})</strong>.
                            </>
                          ) : (
                            "."
                          )}
                        </>
                      ) : (
                        <>
                          Titulaire de la licence sportive n° :{" "}
                          <strong className="font-mono text-[19px] font-black">
                            {licenceNo}
                          </strong>
                          , est qualifié et enregistré au sein du club <strong>Espoir Sidi Hosni</strong> dans la catégorie :{" "}
                          <strong className="font-bold">{player.teamCategory || player.teamName || "Séniors"}</strong> depuis le :{" "}
                          <strong className="font-mono">{joiningDateFormatted}</strong>.
                        </>
                      )}
                    </p>

                    <p>
                      {isAr ? (
                        <>
                          وقد سُلّمت له هذه الشهادة بناءً على طلبه لاستعمالها في كافة الإجراءات الإدارية والرياضية المسموح بها قانوناً.
                        </>
                      ) : (
                        <>
                          La présente attestation lui est délivrée sur sa demande pour servir et valoir ce que de droit auprès des instances administratives et sportives compétentes.
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Footer Signatures Block - Strictly by role only, zero decorative lines */}
                <div
                  className="relative z-10 pt-8 mt-10"
                  style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY, breakInside: "avoid", pageBreakInside: "avoid" }}
                >
                  <div className="flex items-start justify-between text-black text-[16px]">
                    {/* Date and Location */}
                    <div className="space-y-1">
                      <p className="font-bold">
                        {isAr ? "حرر بسيدي حسني في:" : "Fait à Sidi Hosni, le :"} {todayFormatted}
                      </p>
                      <p className="text-[13px] text-zinc-600">
                        {isAr ? "الأمانة العامة للنادي" : "Secrétariat Général du Club"}
                      </p>
                    </div>

                    {/* Official Signature and Stamp by Role Only */}
                    <div className="text-center min-w-[220px] space-y-2">
                      <p className="font-black text-[18px]">
                        {isAr ? "رئيس نادي أمل سيدي حسني" : "Le Président du Club"}
                      </p>
                      <div className="h-24 w-44 mx-auto flex items-center justify-center text-[12px] text-zinc-400 select-none">
                        {isAr ? "ختم وتوقيع رئيس النادي" : "Cachet et Signature"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-3 text-center text-[11px] text-zinc-500 font-mono">
                    ESH SIDI HOSNI • STADE MUNICIPAL SIDI HOSNI • WILAYA DE TIARET • FAF CODE: ESH-26
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
