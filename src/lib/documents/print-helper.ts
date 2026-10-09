"use client";

import { ESH_DOCUMENT_FONT_FAMILY } from "./watermark";

/**
 * Print a document through a dedicated top-level print window.
 *
 * The old implementation temporarily changed the dashboard body and printed
 * an element inside the modal. That left the modal's flex/max-width/overflow
 * chain in Chrome's print layout. A normal top-level window keeps the print
 * content separate from modal and dashboard layout constraints.
 */
export function printDocumentElement(elementIdOrElement: string | HTMLElement, title?: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const target = typeof elementIdOrElement === "string"
    ? document.getElementById(elementIdOrElement)
    : elementIdOrElement;

  if (!target) {
    console.warn("[printDocumentElement] Printable document not found:", elementIdOrElement);
    window.alert(document.documentElement.lang.startsWith("ar")
      ? "تعذر العثور على الوثيقة المراد طباعتها. أغلق المعاينة وافتحها من جديد."
      : "Impossible de trouver le document à imprimer. Fermez l’aperçu puis rouvrez-le.");
    return;
  }

  const printWindow = window.open("about:blank", "_blank");
  if (!printWindow) {
    window.alert(document.documentElement.lang.startsWith("ar")
      ? "تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة."
      : "Impossible d’ouvrir la fenêtre d’impression. Autorisez les fenêtres contextuelles puis réessayez.");
    return;
  }
  const printDocument = printWindow.document;
  const escapeHtml = (value: string) => value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  const sourceDirection = target.getAttribute("dir") || document.documentElement.getAttribute("dir") || "ltr";

  const styleMarkup = Array.from(document.head.querySelectorAll("link[rel='stylesheet'], style"))
    .map((node) => node.cloneNode(true) as HTMLElement)
    .map((node) => node.outerHTML)
    .join("\n");

  const clonedTarget = target.cloneNode(true) as HTMLElement;
  clonedTarget.removeAttribute("data-esh-print-target");
  clonedTarget.classList.add("esh-print-page");
  clonedTarget.setAttribute("data-esh-print-page", "true");
  clonedTarget.setAttribute("dir", sourceDirection);

  const printStyles = `
    /* Standard A4 page box with Chrome's default-like 10 mm margins. */
    @page { size: A4 portrait; margin: 10mm; }
    @page official-testing-report { size: A4 portrait; margin: 10mm; }

    html, body {
      width: 100% !important;
      min-width: 0 !important;
      max-width: 190mm !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      color: #000 !important;
      overflow: visible !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      direction: ${sourceDirection};
      font-family: ${ESH_DOCUMENT_FONT_FAMILY} !important;
    }

    .esh-print-root {
      display: block !important;
      position: static !important;
      width: 100% !important;
      min-width: 0 !important;
      max-width: 190mm !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    /* Keep the document as one continuous flow. The browser's paged-media
       engine can then split it into as many A4 sheets as its content needs. */
    .esh-print-page {
      position: relative !important;
      display: block !important;
      box-sizing: border-box !important;
      width: 100% !important;
      min-width: 0 !important;
      max-width: 190mm !important;
      min-height: 0 !important;
      height: auto !important;
      max-height: none !important;
      margin: 0 !important;
      border: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      outline: 0 !important;
      overflow: visible !important;
      transform: none !important;
      background-color: #fff !important;
      background-position: 12px 10px !important;
      color: #000 !important;
      break-before: auto !important;
      break-after: auto !important;
      page-break-before: auto !important;
      page-break-after: auto !important;
      direction: ${sourceDirection} !important;
      font-family: ${ESH_DOCUMENT_FONT_FAMILY} !important;
    }

    /* Named pages use the same A4 printable area as every other document. */
    .esh-print-page.official-testing-report {
      page: official-testing-report !important;
      padding-block: 0 !important;
    }

    /* Documents may have screen-preview padding and physical A4 dimensions.
       Remove those preview-only measurements and use the printable box. */
    .esh-print-page > :not(.esh-security-watermark) {
      width: 100% !important;
      min-width: 0 !important;
      max-width: none !important;
      box-sizing: border-box !important;
      align-self: stretch !important;
      margin-inline: 0 !important;
      flex: 0 0 auto !important;
    }

    .esh-print-page.printable-document,
    .esh-print-page .print-preview-sheet {
      width: 100% !important;
      min-width: 0 !important;
      max-width: none !important;
      min-height: 277mm !important;
      height: auto !important;
      padding: 0 !important;
      overflow: visible !important;
      box-sizing: border-box !important;
    }

    .esh-print-page .print-preview-sheet-break {
      break-after: page !important;
      page-break-after: always !important;
    }
    .esh-print-page .print-preview-sheet:last-child {
      break-after: auto !important;
      page-break-after: auto !important;
    }

    .esh-print-page > .esh-security-watermark {
      position: fixed !important;
      inset: 0 !important;
      width: 190mm !important;
      height: 277mm !important;
      pointer-events: none !important;
      z-index: 0 !important;
      display: block !important;
      visibility: visible !important;
    }

    .esh-print-page .esh-official-document-header,
    .esh-print-page .esh-official-document-header > div,
    .esh-print-page table {
      width: 100% !important;
      min-width: 0 !important;
      max-width: none !important;
      box-sizing: border-box !important;
    }

    .esh-print-page table {
      table-layout: fixed !important;
      border-collapse: collapse !important;
    }

    .esh-print-page thead { display: table-row-group !important; }
    .esh-print-page tfoot { display: table-footer-group !important; }
    .esh-print-page tr,
    .esh-print-page th,
    .esh-print-page td {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .esh-print-page .category-section {
      break-inside: auto !important;
      page-break-inside: auto !important;
    }
    .esh-print-page .signatures-section {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .esh-print-page .signature-block,
    .esh-print-page .signatures-section {
      margin-block-start: 1.5rem !important;
      break-before: auto !important;
      page-break-before: auto !important;
    }
    .esh-print-page p,
    .esh-print-page li {
      orphans: 3;
      widows: 3;
    }

    .esh-print-page th,
    .esh-print-page td {
      box-sizing: border-box !important;
      overflow-wrap: anywhere !important;
      word-break: break-word !important;
    }

    .esh-print-page [class~="print:hidden"],
    .esh-print-page [class~="no-print"] {
      display: none !important;
      visibility: hidden !important;
    }

    /* Watermarks are deliberately hidden in the preview but belong on paper. */
    .esh-print-page .esh-document-watermark {
      display: block !important;
      visibility: visible !important;
    }

    .esh-print-page button,
    .esh-print-page [role="button"],
    .esh-print-page [role="toolbar"] {
      display: none !important;
    }

    .esh-print-page *,
    .esh-print-page *::before,
    .esh-print-page *::after {
      visibility: visible !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .esh-print-page .font-mono,
    .esh-print-page .tabular-nums,
    .esh-print-page [class*="font-mono"],
    .esh-print-page [class*="tabular-nums"] {
      font-family: Arial, sans-serif !important;
      font-weight: 700 !important;
    }

    .esh-print-page u,
    .esh-print-page ins,
    .esh-print-page a,
    .esh-print-page .underline {
      text-decoration: none !important;
    }
  `;

  printDocument.open();
  printDocument.write(`<!doctype html><html dir="${escapeHtml(sourceDirection)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><base href="${escapeHtml(document.baseURI)}"><title>${escapeHtml(title || document.title)}</title>${styleMarkup}<style data-esh-print-style>${printStyles}</style></head><body><div class="esh-print-root"></div></body></html>`);
  printDocument.close();

  const root = printDocument.querySelector<HTMLElement>(".esh-print-root");
  if (!root) {
    printWindow.close();
    window.alert(document.documentElement.lang.startsWith("ar")
      ? "تعذر تجهيز الوثيقة للطباعة. أعد المحاولة."
      : "Impossible de préparer le document à imprimer. Veuillez réessayer.");
    return;
  }
  root.appendChild(clonedTarget);
  printWindow.opener = null;

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    printWindow.removeEventListener("afterprint", cleanup);
    if (!printWindow.closed) printWindow.close();
  };

  printWindow.addEventListener("afterprint", cleanup, { once: true });

  const waitForAssets = async () => {
    try {
      // Wait for copied stylesheets, fonts, and images before showing Chrome's
      // print preview, with a timeout for unavailable optional assets.
      const assetsLoaded = async () => {
        const stylesheets = Array.from(printDocument.querySelectorAll<HTMLLinkElement>("link[rel='stylesheet']"));
        await Promise.all(stylesheets.map((link) => link.sheet
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
            const timeout = printWindow.setTimeout(resolve, 5000);
            const done = () => {
              printWindow.clearTimeout(timeout);
              resolve();
            };
            link.addEventListener("load", done, { once: true });
            link.addEventListener("error", done, { once: true });
          })));
        await printDocument.fonts?.ready;
        await Promise.all(Array.from(printDocument.images).map((image) => image.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          })));
      };
      await Promise.race([
        assetsLoaded(),
        new Promise<void>((resolve) => printWindow.setTimeout(resolve, 10000))
      ]);
    } catch {
      // A missing optional font/image must not prevent printing the document.
    }
    await new Promise<void>((resolve) => printWindow.requestAnimationFrame(() => printWindow.requestAnimationFrame(() => resolve())));
    printWindow.focus();
    printWindow.print();
  };

  void waitForAssets();
  window.setTimeout(cleanup, 120_000);
}
