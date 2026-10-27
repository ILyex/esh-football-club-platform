import "server-only";

// ============================================================================
// DOCUMENT VERIFIER — orchestrates deterministic rules + optional AI arbiter
// ----------------------------------------------------------------------------
// Architecture (per user decision):
//   1. Deterministic rules run first  → hard REJECT or ACCEPT (no AI call)
//   2. If needsArbiter=true           → AI may provide a recommendation
//      (never an approval; ambiguous evidence remains UNVERIFIED)
//   3. If AI unavailable              → return UNVERIFIED (fail-closed, never auto-accept)
//
// Text extraction:
//   - PDF  → unpdf (pure JS, no native deps)
//   - Image or scanned PDF pages → Ollama vision model via runAICompletion
//   - Other → UNVERIFIED (cannot read, do not block upload silently)
// ============================================================================

import { runAICompletion, isAIConfigured, getAIVisionModel } from "./provider";
import { AIError } from "./types";
import {
  checkPlayerDocument,
  checkExpenseReceipt,
  checkDrugTestDocument,
  VerificationVerdict,
  VerificationFinding,
  isReadable,
} from "@/lib/documents/verification-rules";

// ---- Public types -----------------------------------------------------------

export type DocumentKind =
  | "INSURANCE"
  | "IDENTITY"
  | "BIRTH_CERTIFICATE"
  | "DIPLOMA"
  | "EXPENSE_RECEIPT"
  | "CONTRACT"
  | "DRUG_TEST"
  | "OTHER";

export interface PlayerVerificationContext {
  kind: Extract<DocumentKind, "INSURANCE" | "IDENTITY" | "CONTRACT" | "BIRTH_CERTIFICATE" | "DIPLOMA" | "DRUG_TEST">;
  player: {
    firstName: string;
    lastName: string;
    firstNameFr?: string | null;
    lastNameFr?: string | null;
  };
  /** Other active players on the same team for cross-player detection */
  otherPlayers: Array<{
    firstName: string;
    lastName: string;
    firstNameFr?: string | null;
    lastNameFr?: string | null;
  }>;
}

export interface ExpenseVerificationContext {
  kind: "EXPENSE_RECEIPT";
  amount: number;
  date?: Date | null;
  payeeName?: string | null;
}

export type VerificationContext =
  | PlayerVerificationContext
  | ExpenseVerificationContext;

export interface DocumentVerificationResult {
  verdict: VerificationVerdict;
  findings: VerificationFinding[];
  extractedText: string | null;
  aiUsed: boolean;
  aiFallback?: "quota" | "unavailable";
  /** Advisory only; an AI suggestion never overrides deterministic verification. */
  aiRecommendation?: "ACCEPT" | "REJECT" | "UNVERIFIED";
}

/**
 * A positive drug-test result is retained for confidential human review only
 * when the text also confirms the requested document type and the intended
 * person's identity. A positive word by itself is never enough to attach a
 * medical document to a player or staff record.
 */
export function isConfirmedPositiveDrugTest(result: DocumentVerificationResult): boolean {
  if (result.verdict !== "REJECT") return false;
  const codes = new Set(result.findings.map((finding) => finding.code));
  return codes.has("DRUG_TEST_POSITIVE") &&
    codes.has("OK_TYPE") &&
    codes.has("OK_NAME") &&
    !result.findings.some((finding) =>
      finding.code === "OTHER_PLAYER" ||
      finding.code === "NAME_MISSING" ||
      finding.code === "NAME_UNCERTAIN" ||
      finding.code === "WRONG_DOCUMENT_TYPE" ||
      finding.code === "UNREADABLE"
    );
}

// ---- Constants --------------------------------------------------------------

const UNVERIFIED_RESULT: DocumentVerificationResult = {
  verdict: "UNVERIFIED",
  findings: [{ code: "UNREADABLE", severity: "warning" }],
  extractedText: null,
  aiUsed: false,
};

const MAX_TEXT_FOR_ARBITER = 6000; // characters — keeps prompt lean

// ---- Text extraction --------------------------------------------------------

function reportAIFailure(callback: ((reason: "quota" | "unavailable") => void) | undefined, error: unknown) {
  callback?.(error instanceof AIError && error.code === "AI_QUOTA_EXHAUSTED" ? "quota" : "unavailable");
}

async function extractTextFromPDF(buffer: Buffer, onAIFailure?: (reason: "quota" | "unavailable") => void): Promise<string | null> {
  let dispose: (() => Promise<void>) | undefined;
  try {
    // Dynamic import keeps unpdf out of the client bundle
    const { extractText, getDocumentProxy, renderPageAsImage } = await import("unpdf");
    const uint8 = new Uint8Array(buffer);
    const pdf = await getDocumentProxy(uint8);
    dispose = () => pdf.cleanup();
    const pageCount = pdf.numPages;
    if (pageCount > 20) return null;
    const result = await extractText(pdf, { mergePages: true });
    const text = result.text as string | string[];
    const extracted = Array.isArray(text) ? text.join("\n") : text || "";
    if (isReadable(extracted) || !isAIConfigured()) return extracted || null;

    // Image-only scans have no PDF text layer. Render a bounded number of
    // pages locally and send only those page images to the configured Ollama
    // vision model. Never let a large PDF fan out unbounded inference work.
    const images: Buffer[] = [];
    for (let page = 1; page <= Math.min(pageCount, 3); page++) {
      const rendered = await renderPageAsImage(pdf, page, {
        width: 1400,
        height: 1800,
        toDataURL: false
      });
      images.push(Buffer.from(rendered));
    }
    const ocrText = await extractTextFromImages(images, "image/png", onAIFailure);
    return ocrText || extracted || null;
  } catch (err) {
    console.error("[DocumentVerifier] PDF extraction failed:", err);
    return null;
  } finally {
    await dispose?.().catch(() => {});
  }
}

async function extractTextFromImage(buffer: Buffer, mimeType: string, onAIFailure?: (reason: "quota" | "unavailable") => void): Promise<string | null> {
  if (!isAIConfigured()) return null;
  return extractTextFromImages([buffer], mimeType, onAIFailure);
}

async function extractTextFromImages(images: Buffer[], mimeType = "image/png", onAIFailure?: (reason: "quota" | "unavailable") => void): Promise<string | null> {
  if (!isAIConfigured() || images.length === 0) return null;
  try {
    const visionModel = getAIVisionModel();
    const base64Images = images.map((image) => `data:${mimeType};base64,${image.toString("base64")}`);
    const text = await runAICompletion({
      system:
        "أنت مساعد OCR. استخرج كل النص العربي والفرنسي المرئي في صورة الوثيقة. " +
        "أعد النص الخام فقط دون شرح أو تعليق.",
      input: "استخرج كل النص من صورة الوثيقة.",
      images: base64Images,
      model: visionModel,
      timeoutMs: 60_000,
    });
    return text || null;
  } catch (err) {
    console.error("[DocumentVerifier] Vision OCR failed:", err);
    reportAIFailure(onAIFailure, err);
    return null;
  }
}

async function extractText(
  buffer: Buffer,
  mimeType: string,
  onAIFailure?: (reason: "quota" | "unavailable") => void
): Promise<string | null> {
  const mime = mimeType.toLowerCase();
  if (mime === "application/pdf") return extractTextFromPDF(buffer, onAIFailure);
  if (mime.startsWith("image/")) return extractTextFromImage(buffer, mime, onAIFailure);
  return null; // unsupported MIME — cannot read
}

/** Extracts readable text for server-side document workflows that need to
 * interpret a non-sensitive uploaded form (for example a match sheet). */
export async function extractDocumentText(buffer: Buffer, mimeType: string, onAIFailure?: (reason: "quota" | "unavailable") => void): Promise<string | null> {
  try {
    const text = await extractText(buffer, mimeType, onAIFailure);
    return isReadable(text) ? text : null;
  } catch (err) {
    console.error("[DocumentVerifier] Document text extraction failed:", err);
    return null;
  }
}

/**
 * Re-read a legible but badly ordered match document through vision OCR.
 * Text-layer extraction can be readable while still flattening table columns
 * (starting XI, substitutes, or the event timeline) into the wrong order.
 * Call this only after the deterministic parser reports low confidence.
 */
export async function extractDocumentTextWithVision(buffer: Buffer, mimeType: string, onAIFailure?: (reason: "quota" | "unavailable") => void): Promise<string | null> {
  const mime = mimeType.toLowerCase();
  if (mime.startsWith("image/")) return extractTextFromImages([buffer], mime, onAIFailure);
  if (mime !== "application/pdf" || !isAIConfigured()) return null;

  let dispose: (() => Promise<void>) | undefined;
  try {
    const { getDocumentProxy, renderPageAsImage } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    dispose = () => pdf.cleanup();
    const images: Buffer[] = [];
    for (let page = 1; page <= Math.min(pdf.numPages, 4); page++) {
      const rendered = await renderPageAsImage(pdf, page, { width: 1600, height: 2100, toDataURL: false });
      images.push(Buffer.from(rendered));
    }
    const text = await extractTextFromImages(images, "image/png", onAIFailure);
    return isReadable(text) ? text : null;
  } catch (error) {
    console.warn("[DocumentVerifier] Vision OCR retry failed:", error);
    reportAIFailure(onAIFailure, error);
    return null;
  } finally {
    await dispose?.().catch(() => {});
  }
}

// ---- AI arbiter (only called when needsArbiter=true) -----------------------

async function callAIArbiter(
  text: string,
  finding: VerificationFinding,
  context: VerificationContext,
  onAIFailure?: (reason: "quota" | "unavailable") => void
): Promise<"ACCEPT" | "REJECT" | "UNVERIFIED"> {
  if (!isAIConfigured()) return "UNVERIFIED";

  const truncated = text.slice(0, MAX_TEXT_FOR_ARBITER);
  let contextHint = "";
  if (context.kind === "INSURANCE" || context.kind === "IDENTITY" || context.kind === "CONTRACT") {
    contextHint =
      `اللاعب المستهدف: ${context.player.firstName} ${context.player.lastName}. ` +
      `نوع الوثيقة المطلوب: ${context.kind === "INSURANCE" ? "وثيقة تأمين رياضي" : context.kind === "IDENTITY" ? "وثيقة هوية" : "عقد"}.`;
  } else if (context.kind === "EXPENSE_RECEIPT") {
    contextHint = `المبلغ المسجّل: ${context.amount} د.ج.`;
  }

  const findingDesc =
    finding.code === "NAME_UNCERTAIN"
      ? `اسم اللاعب "${(finding.params?.name as string) || ""}" ظهر بشكل جزئي في الوثيقة (تطابق جزئي، اختلاف محتمل في الخط أو التهجئة).`
      : finding.code === "AMOUNT_NOT_FOUND"
      ? `لم يُعثر على المبلغ ${(finding.params?.amount as number) || ""} في الوثيقة، لكن الوثيقة قابلة للقراءة.`
      : `ملاحظة غير حاسمة: ${finding.code}`;

  const prompt =
    `--- سياق التحقق ---\n${contextHint}\n\n` +
    `--- الملاحظة التي تحتاج تحكيماً ---\n${findingDesc}\n\n` +
    `--- نص الوثيقة ---\n${truncated}\n\n` +
    `--- المطلوب منك ---\n` +
    `بناءً على نص الوثيقة والسياق، هل يُقبل رفع هذه الوثيقة؟\n` +
    `أجب بكلمة واحدة فقط: ACCEPT أو REJECT`;

  try {
    const response = await runAICompletion({
      system:
        "أنت محكّم وثائق دقيق. تحلّل نص الوثيقة وتصدر حكماً واضحاً. " +
        "لا تخترع معلومات، لا تضيف شرحاً. الحكم الخاطئ يتسبب في أضرار قانونية وإدارية للنادي.",
      input: prompt,
      maxTokens: 8,
      timeoutMs: 30_000,
    });

    // Do not treat explanatory or adversarial text containing a verdict word
    // as a decision (for example, "DO NOT ACCEPT").
    const verdict = response.trim().toUpperCase().replace(/[.!\s]+$/g, "");
    if (verdict === "ACCEPT") return "ACCEPT";
    if (verdict === "REJECT") return "REJECT";
    return "UNVERIFIED";
  } catch (err) {
    console.error("[DocumentVerifier] AI arbiter failed:", err);
    reportAIFailure(onAIFailure, err);
    return "UNVERIFIED";
  }
}

// ---- Main entry point -------------------------------------------------------

/**
 * Verifies an uploaded document buffer against expected facts.
 *
 * @param buffer    - Raw file bytes (already validated by validateUploadedFile)
 * @param mimeType  - MIME type from validateUploadedFile
 * @param context   - What we know about who/what this document is for
 *
 * @returns DocumentVerificationResult — always safe to act on (fail-closed)
 */
export async function verifyDocument(
  buffer: Buffer,
  mimeType: string,
  context: VerificationContext
): Promise<DocumentVerificationResult> {
  // Step 1: Extract text from the document
  let extractedText: string | null = null;
  let aiFallback: "quota" | "unavailable" | undefined;
  const markAIFailure = (reason: "quota" | "unavailable") => { aiFallback = reason; };
  try {
    extractedText = await extractText(buffer, mimeType, markAIFailure);
  } catch (err) {
    console.error("[DocumentVerifier] Text extraction error:", err);
  }

  if (!isReadable(extractedText)) {
    // Cannot read the document — don't block upload, just mark as unverified
    return { ...UNVERIFIED_RESULT, aiFallback };
  }

  // Step 2: Run deterministic rules
  let ruleResult;
  if (context.kind === "DRUG_TEST") {
    ruleResult = checkDrugTestDocument({
      text: extractedText,
      person: context.player,
      otherPersons: context.otherPlayers,
    });
  } else if (
    context.kind === "INSURANCE" ||
    context.kind === "IDENTITY" ||
    context.kind === "CONTRACT" ||
    context.kind === "BIRTH_CERTIFICATE" ||
    context.kind === "DIPLOMA"
  ) {
    ruleResult = checkPlayerDocument({
      text: extractedText,
      player: context.player,
      otherPlayers: context.otherPlayers,
      kind: context.kind,
    });
  } else if (context.kind === "EXPENSE_RECEIPT") {
    ruleResult = checkExpenseReceipt({
      text: extractedText,
      amount: context.amount,
      date: context.date,
      payeeName: context.payeeName,
    });
  } else {
    // OTHER or unknown — accept without inspection
    return {
      verdict: "ACCEPT",
      findings: [],
      extractedText,
      aiUsed: false,
    };
  }

  // Step 3: Hard REJECT — no AI call needed
  if (ruleResult.verdict === "REJECT") {
    return {
      verdict: "REJECT",
      findings: ruleResult.findings,
      extractedText,
      aiUsed: false,
    };
  }

  // Step 4: ACCEPT — rules are satisfied
  if (ruleResult.verdict === "ACCEPT") {
    return {
      verdict: "ACCEPT",
      findings: ruleResult.findings,
      extractedText,
      aiUsed: false,
    };
  }

  // Step 5: UNVERIFIED + needsArbiter — call AI for disambiguation
  if (ruleResult.needsArbiter && isAIConfigured()) {
    const ambiguousFinding =
      ruleResult.findings.find(
        (f) => f.code === "NAME_UNCERTAIN" || f.code === "AMOUNT_NOT_FOUND"
      ) || ruleResult.findings[0];

    if (ambiguousFinding) {
      const aiRecommendation = await callAIArbiter(
        extractedText!,
        ambiguousFinding,
        context,
        markAIFailure
      );

      return {
        verdict: "UNVERIFIED",
        findings: ruleResult.findings,
        extractedText,
        aiUsed: true,
        aiRecommendation,
        aiFallback,
      };
    }
  }

  // Step 6: AI not configured or no arbiter finding — fail-closed → UNVERIFIED
  return {
    verdict: "UNVERIFIED",
    findings: ruleResult.findings,
    extractedText,
    aiUsed: false,
    aiFallback,
  };
}
