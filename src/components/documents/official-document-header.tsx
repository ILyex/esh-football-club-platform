"use client";

import React from "react";
import { ESH_DOCUMENT_FONT_FAMILY } from "@/lib/documents/watermark";

export interface OfficialDocumentHeaderProps {
  badgeText?: string;
  referenceNumber?: string;
  date?: Date | string;
  documentTitle?: string;
  documentSubtitle?: string;
  locale?: string;
  className?: string;
}

/**
 * Standard Official Institutional Header for all official documents across the ESH Sidi Hosni platform.
 * Conforms strictly to Algerian Ministry of Youth & Sports standards and official club identity:
 * أمل سيدي حسني — ESPOIRE SIDI HOSNI
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
      className={`pb-3 text-center text-black ${className}`}
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
          className="text-start space-y-1"
          style={{
            fontFamily: ESH_DOCUMENT_FONT_FAMILY,
            textAlign: isAr ? "right" : "left",
            flex: "1 1 0%"
          }}
        >
          <p className="text-[14px] sm:text-[15px] font-bold text-black leading-snug">
            {isAr ? "الجمهورية الجزائرية الديمقراطية الشعبية" : "RÉPUBLIQUE ALGÉRIENNE DÉMOCRATIQUE ET POPULAIRE"}
          </p>
          <p className="text-[14px] sm:text-[15px] font-bold text-black leading-snug">
            {isAr ? "مديرية الشباب والرياضة — ولاية تيارت" : "Direction de la Jeunesse et des Sports — W. Tiaret"}
          </p>
          <p className="text-[14px] sm:text-[15px] font-bold text-black leading-snug">
            {isAr ? "الرابطة الولائية لكرة القدم — تيارت" : "Ligue de Football de la Wilaya de Tiaret"}
          </p>
          <p className="text-[14px] sm:text-[15px] font-bold text-black leading-snug">
            {isAr ? "نادي أمل سيدي حسني" : "Espoir Sidi Hosni"}
          </p>
        </div>

        {/* Center Crest / Logo */}
        <div
          className="flex flex-col items-center shrink-0"
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
            alt="أمل سيدي حسني"
            className="h-16 w-16 object-contain"
            style={{ height: "64px", width: "64px", objectFit: "contain" }}
          />
          <span
            className="text-[11px] font-bold tracking-wider text-black uppercase leading-none mt-1.5"
            style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY, whiteSpace: "nowrap" }}
          >
            {isAr ? "أمل سيدي حسني" : "ESPOIRE SIDI HOSNI"}
          </span>
        </div>

        {/* Left / Reference Number & Date */}
        <div
          className="text-end space-y-1"
          style={{
            fontFamily: ESH_DOCUMENT_FONT_FAMILY,
            textAlign: isAr ? "left" : "right",
            flex: "1 1 0%"
          }}
        >
          {badgeText && (
            <p
              className="text-[12px] sm:text-[13px] font-bold text-zinc-800"
              style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY }}
            >
              {badgeText}
            </p>
          )}
          <p
            className="text-[13px] sm:text-[14px] font-bold text-black"
            style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY }}
          >
            {isAr ? "المرجع: " : "Réf : "}{referenceNumber}
          </p>
          <p
            className="text-[14px] sm:text-[15px] text-black font-bold"
            style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY }}
          >
            {isAr ? `بتاريخ: ${formattedDate}` : `Le : ${formattedDate}`}
          </p>
        </div>
      </div>

      {/* Official Document Title & Subtitle Banner (Strictly no underlines or decorative lines) */}
      {(documentTitle || documentSubtitle) && (
        <div className="mt-4 pt-1 text-center">
          {documentTitle && (
            <h1
              className="text-[19px] sm:text-[22px] font-bold tracking-normal text-black leading-snug uppercase"
              style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY }}
            >
              {documentTitle}
            </h1>
          )}
          {documentSubtitle && (
            <p
              className="text-[14px] sm:text-[15px] font-medium text-zinc-700 mt-1"
              style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY }}
            >
              {documentSubtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
