/**
 * Utilities for parsing and computing Player Sports Insurance validity and expiry.
 * Insurance metadata (startDate, endDate) is encoded in Document.description
 * as a JSON object: {"insurance": true, "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD"}
 * fallback: if not specified or legacy, a document with "تأمين" is treated as active for the current season.
 */

export interface InsuranceMetadata {
  insurance: boolean;
  startDate?: string;
  endDate?: string;
  policyNumber?: string;
}

export type InsuranceStatus = "INSURED" | "EXPIRING_SOON" | "EXPIRED" | "NOT_INSURED";

export interface ParsedPlayerInsurance {
  isInsured: boolean;
  status: InsuranceStatus;
  document: any | null;
  startDate: Date | null;
  endDate: Date | null;
  daysRemaining: number | null;
  isExpiringSoon: boolean;
  isExpired: boolean;
}

export const INSURANCE_EXPIRING_WINDOW_DAYS = 30;

export function parseInsuranceMetadata(description?: string | null): InsuranceMetadata | null {
  if (!description) return null;
  try {
    const data = JSON.parse(description);
    if (data && typeof data === "object" && data.insurance) {
      return data as InsuranceMetadata;
    }
  } catch {
    // Description is plain text
  }
  return null;
}

export function serializeInsuranceMetadata(meta: {
  startDate?: string | null;
  endDate?: string | null;
  policyNumber?: string | null;
}): string {
  return JSON.stringify({
    insurance: true,
    startDate: meta.startDate || null,
    endDate: meta.endDate || null,
    policyNumber: meta.policyNumber || null
  });
}

export function isInsuranceDocument(doc: { name: string; description?: string | null }): boolean {
  if (doc.description) {
    const meta = parseInsuranceMetadata(doc.description);
    if (meta?.insurance) return true;
  }
  const name = doc.name.toLowerCase();
  return doc.name.includes("تأمين") || name.includes("assurance") || name.includes("insurance");
}

/** A policy is valid THROUGH its end date: treat "YYYY-MM-DD" as the end of that day (UTC). */
export function endOfInsuranceDay(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) d.setUTCHours(23, 59, 59, 999);
  return d;
}

export function formatInsuranceDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${day}/${month}/${year}`;
}

/** Parses a DD/MM/YYYY or YYYY-MM-DD date string into an ISO YYYY-MM-DD string without reversing day and month. */
export function parseDMYToISO(dateStr?: string | null): string | null {
  if (!dateStr || !dateStr.trim()) return null;
  const trimmed = dateStr.trim();
  const dmy = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy && dmy[1] && dmy[2] && dmy[3]) {
    const day = dmy[1];
    const month = dmy[2];
    const year = dmy[3];
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const ymd = trimmed.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (ymd && ymd[1] && ymd[2] && ymd[3]) {
    const year = ymd[1];
    const month = ymd[2];
    const day = ymd[3];
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return trimmed;
}

/** Converts an ISO YYYY-MM-DD or Date string to DD/MM/YYYY */
export function parseISOToDMY(dateStr?: string | null): string {
  if (!dateStr || !dateStr.trim()) return "";
  const trimmed = dateStr.trim();
  const ymd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd && ymd[1] && ymd[2] && ymd[3]) {
    const year = ymd[1];
    const month = ymd[2];
    const day = ymd[3];
    return `${day}/${month}/${year}`;
  }
  return formatInsuranceDate(trimmed);
}

export function evaluatePlayerInsurance(
  documents: Array<{
    id: string;
    name: string;
    description?: string | null;
    documentDate?: Date | null;
    mimeType?: string;
    originalName?: string;
    sizeBytes?: number;
    createdAt?: Date;
  }>,
  now: Date = new Date()
): ParsedPlayerInsurance {
  // A player may hold several insurance documents (renewals). The effective
  // one is the currently valid policy with the latest end date; if none is
  // valid, the most recently ended one. Never "whichever came first".
  const insuranceDocs = documents.filter(isInsuranceDocument);
  const rank = (d: (typeof insuranceDocs)[number]): number => {
    const m = parseInsuranceMetadata(d.description);
    const end = endOfInsuranceDay(m?.endDate);
    if (!end) return Number.MAX_SAFE_INTEGER; // legacy document without end date = open-ended
    return end.getTime() >= now.getTime() - 24 * 3600 * 1000 ? end.getTime() + 1e13 : end.getTime();
  };
  const doc = [...insuranceDocs].sort((a, b) => rank(b) - rank(a))[0];
  if (!doc) {
    return {
      isInsured: false,
      status: "NOT_INSURED",
      document: null,
      startDate: null,
      endDate: null,
      daysRemaining: null,
      isExpiringSoon: false,
      isExpired: false
    };
  }

  // Find the primary document (newest or with valid dates)
  const meta = parseInsuranceMetadata(doc.description);

  let startDate: Date | null = null;
  let endDate: Date | null = null;

  if (meta?.startDate) {
    startDate = new Date(meta.startDate);
  } else if (doc.documentDate) {
    startDate = new Date(doc.documentDate);
  }

  if (meta?.endDate) {
    endDate = endOfInsuranceDay(meta.endDate);
  }

  // If no endDate is defined, check if we have startDate or documentDate
  // If entirely undefined, we consider it active (legacy document exists)
  if (!endDate) {
    return {
      isInsured: true,
      status: "INSURED",
      document: doc,
      startDate,
      endDate: null,
      daysRemaining: null,
      isExpiringSoon: false,
      isExpired: false
    };
  }

  const msDiff = endDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(msDiff / (24 * 3600 * 1000));

  if (daysRemaining < 0) {
    return {
      isInsured: false,
      status: "EXPIRED",
      document: doc,
      startDate,
      endDate,
      daysRemaining,
      isExpiringSoon: false,
      isExpired: true
    };
  }

  if (daysRemaining <= INSURANCE_EXPIRING_WINDOW_DAYS) {
    return {
      isInsured: true,
      status: "EXPIRING_SOON",
      document: doc,
      startDate,
      endDate,
      daysRemaining,
      isExpiringSoon: true,
      isExpired: false
    };
  }

  return {
    isInsured: true,
    status: "INSURED",
    document: doc,
    startDate,
    endDate,
    daysRemaining,
    isExpiringSoon: false,
    isExpired: false
  };
}
