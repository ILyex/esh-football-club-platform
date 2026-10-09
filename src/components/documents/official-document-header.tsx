"use client";

import React from "react";
import { ESH_DOCUMENT_FONT_FAMILY } from "@/lib/documents/watermark";
import { OfficialDocumentFooter } from "./official-document-footer";

export interface OfficialDocumentHeaderProps {
  badgeText?: string;
  referenceNumber?: string;
  date?: Date | string;
  documentTitle?: string;
  documentSubtitle?: string;
  authorityFontSize?: number;
  compact?: boolean;
  locale?: string;
  className?: string;
}

/**
 * Standard Official Institutional Header for all official documents across the ESH Sidi Hosni platform.
 * Conforms strictly to Algerian Ministry of Youth & Sports standards and official club identity:
 * الجمعية الرياضية أمل سيدي حسني لكرة القدم — Association Sportive Espoir Sidi Hosni de Football
 *
 * Strict Typography: Traditional Arabic / Arabic Typesetting ONLY.
 * Zero underlines or decorative lines.
 */
export function OfficialDocumentHeader({
  badgeText,
  referenceNumber = "REF-2026-001-ESH",
  date,
  documentTitle,
  documentSubtitle,
  authorityFontSize = 12,
  compact = true,
  locale = "ar",
  className = ""
}: OfficialDocumentHeaderProps) {
  const isAr = locale === "ar";

  const resolvedDate = date ? new Date(date) : new Date();
  const formattedDate = resolvedDate.toLocaleDateString(isAr ? "ar-DZ" : "fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  return (
    <div
      className={`esh-official-document-header pb-3 text-center text-black ${className}`}
      style={{
        fontFamily: ESH_DOCUMENT_FONT_FAMILY,
        breakInside: "avoid",
        pageBreakInside: "avoid"
      }}
    >
      <div
        className="flex items-start justify-between gap-4"
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          width: "100%"
        }}
      >
        {/* Right / Official Authority Side */}
        <div
          className="esh-document-authority text-start space-y-1"
          style={{
            fontFamily: ESH_DOCUMENT_FONT_FAMILY,
            textAlign: isAr ? "right" : "left",
            flex: "1 1 0%",
            minWidth: 0
          }}
        >
          <p className="font-bold leading-snug text-black whitespace-nowrap" style={{ fontSize: `${authorityFontSize}px` }}>
            {isAr ? "الجمهورية الجزائرية الديمقراطية الشعبية" : "RÉPUBLIQUE ALGÉRIENNE DÉMOCRATIQUE ET POPULAIRE"}
          </p>
          <p className="font-bold leading-snug text-black whitespace-nowrap" style={{ fontSize: `${authorityFontSize}px` }}>
            {isAr ? "مديرية الشباب والرياضة — ولاية تيارت" : "Direction de la Jeunesse et des Sports — W. Tiaret"}
          </p>
          <p className="font-bold leading-snug text-black whitespace-nowrap" style={{ fontSize: `${authorityFontSize}px` }}>
            {isAr ? "الرابطة الولائية لكرة القدم — تيارت" : "Ligue de Football de la Wilaya de Tiaret"}
          </p>
          <p className="font-bold leading-snug text-black whitespace-nowrap" style={{ fontSize: `${authorityFontSize}px` }}>
            {isAr ? "الجمعية الرياضية أمل سيدي حسني لكرة القدم" : "Association Sportive Espoir Sidi Hosni de Football"}
          </p>
        </div>

        {/* Center Crest / Logo */}
        <div
          className="esh-document-brand flex flex-col items-center shrink-0"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            flexShrink: 0,
            padding: "0 8px"
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/esh-logo-transparent.png"
            alt="الجمعية الرياضية أمل سيدي حسني لكرة القدم"
            className={`esh-club-logo ${compact ? "h-[72px] w-[72px]" : "h-24 w-24"} object-contain`}
            style={{ height: compact ? "72px" : "96px", width: compact ? "72px" : "96px", objectFit: "contain" }}
          />
        </div>

        {/* Left / Reference Number & Date */}
        <div
          className="esh-document-reference text-end space-y-1"
          style={{
            fontFamily: ESH_DOCUMENT_FONT_FAMILY,
            textAlign: isAr ? "left" : "right",
            flex: "1 1 0%",
            minWidth: 0
          }}
        >
          {badgeText && (
            <p
              className="text-[14px] font-bold text-zinc-800"
              style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY }}
            >
              {badgeText}
            </p>
          )}
          {referenceNumber && <p
            className="text-[14px] font-bold text-black"
            style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY, whiteSpace: isAr ? "nowrap" : "normal", overflowWrap: "anywhere" }}
          >
            {isAr ? "المرجع: " : "Réf : "}{referenceNumber}
          </p>}
          <p
            className="text-[14px] font-bold text-black"
            style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY, whiteSpace: isAr ? "nowrap" : "normal", overflowWrap: "anywhere" }}
          >
            {isAr ? `بتاريخ: ${formattedDate}` : `Le : ${formattedDate}`}
          </p>
        </div>
      </div>

      {/* Official Document Title & Subtitle Banner (Strictly no underlines or decorative lines) */}
      {(documentTitle || documentSubtitle) && (
        <div className={`${compact ? "mt-2 pt-0.5" : "mt-4 pt-1"} text-center`}>
          {documentTitle && (
            <h1
              className={`${compact ? "text-[17px]" : "text-[21px] sm:text-[23px]"} font-bold tracking-normal text-black leading-snug uppercase`}
              style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY }}
            >
              {documentTitle}
            </h1>
          )}
          {documentSubtitle && (
            <p
              className={`${compact ? "text-[13px]" : "text-[18px] sm:text-[19px]"} font-medium text-zinc-700 ${compact ? "mt-0.5" : "mt-1"}`}
              style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY }}
            >
              {documentSubtitle}
            </p>
          )}
        </div>
      )}

      <OfficialDocumentFooter locale={locale} />
    </div>
  );
}
