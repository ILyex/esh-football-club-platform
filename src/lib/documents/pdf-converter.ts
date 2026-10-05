import "server-only";

// ============================================================================
// PLUGGABLE PDF CONVERTER ABSTRACTION (Phase 6 — Document Rendering)
// ----------------------------------------------------------------------------
// Architectural rules:
//   1. Pluggable: Configured via PDF_CONVERTER_URL. If unconfigured, the system
//      operates normally with DOCX + in-browser preview + native print-to-PDF.
//   2. Security: Strictly validates converter URL protocol (http/https only)
//      to prevent SSRF. Implements bounded timeouts and payload limits.
//   3. Untrusted boundary: Validates returned bytes (must begin with %PDF-).
//      Never trust arbitrary output or renamed DOCX files.
// ============================================================================

export const MAX_DOCX_PAYLOAD_BYTES = 20 * 1024 * 1024; // 20 MB ceiling
export const CONVERTER_TIMEOUT_MS = 25000; // 25 seconds timeout

export interface PdfConversionResult {
  success: boolean;
  pdfBuffer?: Buffer;
  error?: string;
  statusCode?: number;
}

/** Returns true if a server-side PDF converter endpoint is configured in .env. */
export function isPdfConverterConfigured(): boolean {
  const url = process.env.PDF_CONVERTER_URL?.trim();
  return Boolean(url && url.length > 0);
}

/**
 * Validates and returns the sanitized converter endpoint URL.
 * Throws an error if the URL uses an unsafe protocol (only http: and https: allowed).
 */
export function getSanitizedConverterUrl(): string | null {
  const rawUrl = process.env.PDF_CONVERTER_URL?.trim();
  if (!rawUrl) return null;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid PDF_CONVERTER_URL: failed to parse as valid URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsafe PDF_CONVERTER_URL protocol: "${parsed.protocol}". Only http: and https: are permitted.`);
  }

  return parsed.toString();
}

/** Validates that a buffer starts with the standard PK zip header (0x50, 0x4B, 0x03, 0x04). */
export function isValidDocxHeader(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  return buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
}

/** Validates that a buffer starts with standard PDF magic bytes "%PDF-" (0x25, 0x50, 0x44, 0x46, 0x2D). */
export function isValidPdfHeader(buffer: Buffer): boolean {
  if (buffer.length < 5) return false;
  return (
    buffer[0] === 0x25 && // %
    buffer[1] === 0x50 && // P
    buffer[2] === 0x44 && // D
    buffer[3] === 0x46 && // F
    buffer[4] === 0x2d    // -
  );
}

/**
 * Converts a DOCX buffer to a PDF buffer using the configured external converter service.
 * Supports standard multipart Gotenberg LibreOffice conversion (/forms/libreoffice/convert)
 * or generic HTTP conversion endpoints.
 */
export async function convertDocxToPdf(
  docxBuffer: Buffer,
  options?: { filename?: string; timeoutMs?: number }
): Promise<PdfConversionResult> {
  if (!isPdfConverterConfigured()) {
    return {
      success: false,
      error: "PDF_CONVERTER_NOT_CONFIGURED",
      statusCode: 503
    };
  }

  if (docxBuffer.length > MAX_DOCX_PAYLOAD_BYTES) {
    return {
      success: false,
      error: "PAYLOAD_TOO_LARGE",
      statusCode: 413
    };
  }

  if (!isValidDocxHeader(docxBuffer)) {
    return {
      success: false,
      error: "INVALID_DOCX_INPUT",
      statusCode: 400
    };
  }

  let endpoint: string;
  try {
    const sanitized = getSanitizedConverterUrl();
    if (!sanitized) {
      return { success: false, error: "PDF_CONVERTER_NOT_CONFIGURED", statusCode: 503 };
    }
    endpoint = sanitized;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "INVALID_CONVERTER_CONFIG",
      statusCode: 500
    };
  }

  // Construct Gotenberg-compatible multipart form payload
  const filename = options?.filename ? (options.filename.endsWith(".docx") ? options.filename : `${options.filename}.docx`) : "document.docx";
  const formData = new FormData();
  formData.append("files", new Blob([new Uint8Array(docxBuffer)], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), filename);

  const timeoutMs = options?.timeoutMs ?? CONVERTER_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      const safeErrorSnippet = errText.slice(0, 200).replace(/[\r\n]+/g, " ").trim();
      return {
        success: false,
        error: `CONVERSION_SERVICE_ERROR: ${response.status}${safeErrorSnippet ? ` - ${safeErrorSnippet}` : ""}`,
        statusCode: 502
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    // Enforce genuine PDF output validation (Constraint 6: reject renamed DOCX or non-PDF payload)
    if (!isValidPdfHeader(pdfBuffer)) {
      return {
        success: false,
        error: "INVALID_PDF_OUTPUT_MAGIC_BYTES",
        statusCode: 502
      };
    }

    return {
      success: true,
      pdfBuffer,
      statusCode: 200
    };
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error?.name === "AbortError" || controller.signal.aborted) {
      return {
        success: false,
        error: "CONVERSION_TIMEOUT",
        statusCode: 504
      };
    }

    return {
      success: false,
      error: `CONVERSION_NETWORK_ERROR: ${error instanceof Error ? error.message : String(error)}`,
      statusCode: 502
    };
  }
}
