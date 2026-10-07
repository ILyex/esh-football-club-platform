"use client";

import { useState } from "react";
import { FileBadge, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OfficialDocumentHeader } from "@/components/documents/official-document-header";
import { printDocumentElement } from "@/lib/documents/print-helper";
import { getPlayerDisplayName } from "@/lib/utils";
import { frenchNationality } from "@/lib/public/locale-text";
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
  triggerClassName?: string;
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
  triggerLabel,
  triggerClassName
}: OfficialPlayerAttestationModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isAr = locale === "ar";
  const elementId = `official-player-attestation-${player.id}`;

  const displayName = getPlayerDisplayName(player, locale);
  const birthDateFormatted = formatDateDMY(player.dateOfBirth);
  const joiningDateFormatted = formatDateDMY(player.joiningDate || new Date("2026-08-15"));
  const licenceNo = player.licenceNumber?.trim() || (isAr ? "قيد الإصدار (FAF-26)" : "En cours (FAF-26)");

  const handlePrint = () => {
    printDocumentElement(
      elementId,
      isAr
        ? `شهادة إنتساب — ${displayName} — الجمعية الرياضية أمل سيدي حسني لكرة القدم`
        : `Attestation Joueur — ${displayName} — Association Sportive Espoir Sidi Hosni de Football`
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
          className={`gap-1.5 text-xs font-semibold hover:border-club-primary/50 text-foreground ${triggerClassName || ""}`}
        >
          <FileBadge className={`h-3.5 w-3.5 ${triggerClassName ? "text-white/90" : "text-club-primary"}`} />
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

          <div className="relative z-10 flex h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
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
            <div className="relative flex-1 overflow-auto bg-[#525659] p-4 sm:p-8">
              <div
                id={elementId}
                className="printable-document esh-security-watermark relative mx-auto flex min-h-[297mm] w-[210mm] shrink-0 flex-col justify-between border border-zinc-200 bg-white p-[14mm] text-black shadow-2xl"
                style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY, boxSizing: "border-box" }}
              >
                {/* Security watermark */}
                <div
                  className="pointer-events-none absolute inset-0 z-0 esh-document-watermark select-none print:hidden"
                  style={{ backgroundImage: ESH_WATERMARK_CSS_URL, backgroundSize: "100px 50px", backgroundRepeat: "repeat" }}
                  aria-hidden="true"
                />

                {/* Inner Content */}
                <div className="relative z-10 space-y-5">
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
                    className="mt-5 space-y-5 text-justify text-black"
                    style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY, fontSize: "20px", lineHeight: "1.75" }}
                  >
                    <p className="mb-4 text-center text-[20px] font-bold leading-relaxed">
                      {isAr
                        ? "رئيس الجمعية الرياضية أمل سيدي حسني لكرة القدم"
                        : "Le Président de l'Association Sportive Espoir Sidi Hosni de Football"}
                    </p>

                    <p>
                      {isAr ? (
                        <>
                          يشهد رئيس <strong>الجمعية الرياضية أمل سيدي حسني لكرة القدم</strong> أن اللاعب:{" "}
                          <strong className="font-black text-[20px]">
                            {getPlayerDisplayName(player, "ar")}
                          </strong>
                          {player.firstNameFr && player.lastNameFr && (player.firstName || player.lastName) && (
                            <span className="font-mono text-[20px] text-zinc-800">
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
                          Le Président de l&apos;association <strong>Association Sportive Espoir Sidi Hosni de Football</strong> atteste que le joueur :{" "}
                          <strong className="font-black text-[20px]">
                            {getPlayerDisplayName(player, "fr")}
                          </strong>
                          , né le : <strong className="font-mono">{birthDateFormatted}</strong> à{" "}
                          <strong>Tiaret</strong>, de nationalité : <strong>{frenchNationality(player.nationality)}</strong>.
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
                          ، هو لاعب مسجل رسمياً وبصفة قانونية ضمن صفوف{" "}
                          <strong>«الجمعية الرياضية أمل سيدي حسني لكرة القدم»</strong> في فئة:{" "}
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
                          <strong className="font-mono text-[20px] font-black">
                            {licenceNo}
                          </strong>
                          , est qualifié et enregistré au sein de l&apos;association <strong>Association Sportive Espoir Sidi Hosni de Football</strong> dans la catégorie :{" "}
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
                  className="esh-attestation-footer relative z-10 mt-8 border-t border-zinc-200 pt-6"
                  style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY, breakInside: "avoid", pageBreakInside: "avoid" }}
                >
                  <div className="flex items-start justify-between gap-8 text-black text-[13px]">
                    {/* Secretariat label; the document date is shown only in the shared header. */}
                    <div className="space-y-1">
                      <p className="esh-attestation-secretariat text-[13px] text-zinc-600">
                        {isAr ? "الأمانة العامة للنادي" : "Secrétariat Général du Club"}
                      </p>
                    </div>

                    {/* Official Signature and Stamp by Role Only */}
                    <div className="min-w-[190px] space-y-2 text-center">
                      <p className="esh-attestation-signature text-[15px] font-black">
                        {isAr ? "رئيس الجمعية الرياضية أمل سيدي حسني لكرة القدم" : "Le Président du Club"}
                      </p>
                      <div className="esh-attestation-stamp mx-auto flex h-20 w-40 items-center justify-center text-[13px] text-zinc-400 select-none">
                        {isAr ? "ختم وتوقيع رئيس النادي" : "Cachet et Signature"}
                      </div>
                    </div>
                  </div>

                  <div className="esh-attestation-club-code mt-6 border-t border-zinc-200 pt-3 text-center text-[10px] text-zinc-500 font-mono">
                    Association Sportive Espoir Sidi Hosni de Football • STADE MUNICIPAL SIDI HOSNI • WILAYA DE TIARET • FAF CODE: ESH-26
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
