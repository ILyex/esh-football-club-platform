"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Printer, Download, FileText, ZoomIn, ZoomOut, RotateCcw, AlertCircle, CheckCircle2 } from "lucide-react";
import { ESH_DOCUMENT_FONT_FAMILY, ESH_PRINT_WATERMARK_DATA_URL } from "@/lib/documents/watermark";

interface DocumentViewerLabels {
  print: string;
  downloadDocx: string;
  downloadPdf: string;
  serverPdfUnavailable: string;
  previewLoading: string;
  previewError: string;
  printInstruction: string;
  zoomIn: string;
  zoomOut: string;
  resetZoom: string;
  a4Sheet: string;
}

interface DocumentViewerProps {
  initialDocxBase64: string;
  documentId: string;
  filename: string;
  locale: string;
  isPdfConfigured: boolean;
  labels: DocumentViewerLabels;
}

export function DocumentViewer({
  initialDocxBase64,
  documentId,
  filename,
  locale,
  isPdfConfigured,
  labels
}: DocumentViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(100);
  const [showPdfHelp, setShowPdfHelp] = useState(false);

  const isRtl = locale === "ar";

  const handlePrint = useCallback(() => {
    if (!containerRef.current) {
      window.print();
      return;
    }

    try {
      const existingIframe = document.getElementById("esh-print-frame");
      if (existingIframe) {
        existingIframe.remove();
      }

      const iframe = document.createElement("iframe");
      iframe.id = "esh-print-frame";
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      iframe.style.visibility = "hidden";
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        window.print();
        return;
      }

      // Collect all stylesheets and style blocks from current page
      const styleElements: string[] = [];
      document.querySelectorAll("link[rel='stylesheet'], style").forEach((node) => {
        styleElements.push(node.outerHTML);
      });

      const dir = isRtl ? "rtl" : "ltr";
      const contentHtml = containerRef.current.innerHTML;

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html dir="${dir}">
          <head>
            <meta charset="utf-8">
            <title>${filename}</title>
            ${styleElements.join("\n")}
            <style>
              @page {
                size: A4 portrait;
                margin: 0 !important;
              }
              *, *::before, *::after {
                box-sizing: border-box;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
                font-family: ${ESH_DOCUMENT_FONT_FAMILY} !important;
              }
              .esh-print-watermark {
                position: fixed !important;
                inset: 0 auto auto 0 !important;
                width: 210mm !important;
                height: 297mm !important;
                object-fit: fill !important;
                z-index: 0 !important;
                pointer-events: none !important;
              }
              .docx-preview-root { position: relative !important; z-index: 1 !important; background: transparent !important; }
              u, ins, a, .underline {
                text-decoration: none !important;
              }
              .docx-wrapper {
                background: transparent !important;
                padding: 0 !important;
                margin: 0 !important;
              }
              .docx-wrapper > section.docx {
                box-shadow: none !important;
                border: none !important;
                border-top: 3px solid #c8102e !important;
                margin: 0 auto !important;
                padding: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                min-height: auto !important;
                page-break-after: always !important;
                break-after: page !important;
                position: relative !important;
                background: transparent !important;
                background-image: none !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color: #000000 !important;
              }
              .docx-wrapper > section.docx:last-child {
                page-break-after: avoid !important;
                break-after: avoid !important;
              }
              ${
                isRtl
                  ? `
                .docx-wrapper > section.docx {
                  direction: rtl !important;
                  text-align: right !important;
                }
                .docx-wrapper > section.docx table {
                  direction: rtl !important;
                }
              `
                  : ""
              }
            </style>
          </head>
          <body class="${isRtl ? "docx-rtl" : "docx-ltr"}">
            <img class="esh-print-watermark" src="${ESH_PRINT_WATERMARK_DATA_URL}" alt="" aria-hidden="true" />
            <div class="docx-preview-root" dir="${dir}">
              ${contentHtml}
            </div>
          </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          iframe.remove();
        }, 3000);
      }, 500);
    } catch (e) {
      console.warn("Isolated iframe print failed, falling back to window.print", e);
      window.print();
    }
  }, [filename, isRtl]);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 10, 150));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 10, 60));
  const handleResetZoom = () => setZoom(100);

  useEffect(() => {
    let cancelled = false;

    async function renderDocx() {
      if (!containerRef.current || !initialDocxBase64) return;

      try {
        setLoading(true);
        setError(null);

        // Convert base64 string to ArrayBuffer
        const binaryString = window.atob(initialDocxBase64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Dynamically load docx-preview in client
        const docxPreview = await import("docx-preview");

        if (cancelled || !containerRef.current) return;

        // Clear previous render
        containerRef.current.innerHTML = "";

        await docxPreview.renderAsync(bytes.buffer, containerRef.current, undefined, {
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          experimental: true,
          useBase64URL: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
          debug: false
        });

        if (!cancelled) {
          setLoading(false);
        }
      } catch (err) {
        console.error("docx-preview render error:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render document preview");
          setLoading(false);
        }
      }
    }

    renderDocx();

    return () => {
      cancelled = true;
    };
  }, [initialDocxBase64]);

  return (
    <div className="flex flex-col space-y-4">
      {/* Action Toolbar — Isolated and completely hidden during printing */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-sm print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          {/* Print Button — Primary trigger for instant printing & browser Save-as-PDF */}
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-md bg-club-primary px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-club-primary/90 focus:outline-none focus:ring-2 focus:ring-club-primary focus:ring-offset-2"
          >
            <Printer className="h-4 w-4" />
            <span>{labels.print}</span>
          </button>

          {/* Download DOCX — The authoritative generated binary */}
          <a
            href={`/api/generated-documents/${documentId}/download?format=docx`}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3.5 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-club-primary focus:ring-offset-2"
            download={`${filename}.docx`}
          >
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span>{labels.downloadDocx}</span>
          </a>

          {/* Download PDF — Real server converter if configured, or explicit guidance if unconfigured */}
          {isPdfConfigured ? (
            <a
              href={`/api/generated-documents/${documentId}/download?format=pdf`}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3.5 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-club-primary focus:ring-offset-2"
              download={`${filename}.pdf`}
            >
              <Download className="h-4 w-4 text-muted-foreground" />
              <span>{labels.downloadPdf}</span>
            </a>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPdfHelp((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                title={labels.serverPdfUnavailable}
              >
                <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                <span>{labels.downloadPdf}</span>
                <span className="ms-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                  Print to PDF
                </span>
              </button>

              {showPdfHelp && (
                <div
                  className={`absolute z-20 mt-2 w-72 rounded-lg border border-border bg-popover p-3 text-xs shadow-lg ${
                    isRtl ? "left-0" : "right-0"
                  }`}
                >
                  <p className="font-semibold text-foreground">{labels.serverPdfUnavailable}</p>
                  <p className="mt-1.5 text-muted-foreground">{labels.printInstruction}</p>
                  <div className="mt-2.5 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPdfHelp(false);
                        handlePrint();
                      }}
                      className="rounded bg-club-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-club-primary/90"
                    >
                      {labels.print}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Zoom Controls for Preview */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleZoomOut}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title={labels.zoomOut}
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="w-12 text-center text-xs font-mono font-medium text-muted-foreground">{zoom}%</span>
          <button
            type="button"
            onClick={handleZoomIn}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title={labels.zoomIn}
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title={labels.resetZoom}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Preview Sheet Area */}
      <div className="relative overflow-x-auto rounded-lg border border-border bg-muted/30 p-4 md:p-8 print:border-none print:bg-white print:p-0">
        {loading && (
          <div className="flex min-h-[400px] flex-col items-center justify-center space-y-3 py-12 text-muted-foreground print:hidden">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-club-primary border-t-transparent" />
            <p className="text-sm">{labels.previewLoading}</p>
          </div>
        )}

        {error && (
          <div className="flex min-h-[300px] flex-col items-center justify-center space-y-3 rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center text-destructive print:hidden">
            <AlertCircle className="h-8 w-8" />
            <p className="text-sm font-semibold">{labels.previewError}</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <a
              href={`/api/generated-documents/${documentId}/download?format=docx`}
              className="mt-2 inline-flex items-center gap-2 rounded-md bg-club-primary px-4 py-2 text-xs font-medium text-white hover:bg-club-primary/90"
            >
              <Download className="h-4 w-4" />
              <span>{labels.downloadDocx}</span>
            </a>
          </div>
        )}

        {/* The Authentic Document DOM Container Rendered by docx-preview */}
        <div
          className={`printable-document-container mx-auto transition-transform origin-top ${
            isRtl ? "docx-rtl" : "docx-ltr"
          }`}
          style={{
            transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
            transformOrigin: "top center",
            maxWidth: "850px"
          }}
        >
          <div
            ref={containerRef}
            className={`docx-preview-root ${isRtl ? "text-right" : "text-left"}`}
            dir={isRtl ? "rtl" : "ltr"}
          />
        </div>
      </div>
    </div>
  );
}
