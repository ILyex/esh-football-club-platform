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

  let printWindow: Window | null = null;
  try {
    printWindow = window.open("about:blank", "_blank");
  } catch {
    printWindow = null;
  }

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
  clonedTarget.classList.remove("esh-paginated-source");
  clonedTarget.classList.add("esh-print-page");
  clonedTarget.setAttribute("data-esh-print-page", "true");
  clonedTarget.setAttribute("dir", sourceDirection);

  const printStyles = `
    /* Standard A4 page box with Chrome's default-like 10 mm margins. */
    @page { size: A4 portrait; margin: 10mm; }
    @page official-testing-report { size: A4 portrait; margin: 10mm; }

    .esh-paginated-source {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
    }

    html, body {
      width: 190mm !important;
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
      width: 190mm !important;
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
      width: 190mm !important;
      min-width: 0 !important;
      max-width: 190mm !important;
      min-height: 277mm !important;
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

    /* Document typography: Paragraphs and narrative text use comfortable 18-19px, while tables keep compact readable 11-12px sizing so rows fit nicely on printed A4 pages. */
    .esh-print-page {
      font-size: 16px;
      line-height: 1.45;
    }
    .esh-print-page p,
    .esh-print-page .esh-attestation-body {
      font-size: 18px !important;
      line-height: 1.45 !important;
    }
    .esh-print-page table:not(.grand-total-section) th,
    .esh-print-page table:not(.grand-total-section) td {
      font-size: 11px !important;
      line-height: 1.3 !important;
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
      width: 190mm !important;
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
    .esh-print-page .esh-document-header-row,
    .esh-print-page table {
      width: 100% !important;
      min-width: 0 !important;
      max-width: none !important;
      box-sizing: border-box !important;
    }

    /* Only the three-column masthead row spans the page. Applying width:100%
       to every direct child makes each flex column as wide as the whole page,
       pushing the authority and reference text beyond the right paper edge. */
    .esh-print-page .esh-document-header-row {
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) 18mm minmax(0, 1fr) !important;
      direction: ltr !important;
      align-items: start !important;
      column-gap: 2mm !important;
    }
    .esh-print-page .esh-document-header-row > .esh-document-authority,
    .esh-print-page .esh-document-header-row > .esh-document-reference {
      grid-row: 1 !important;
      width: auto !important;
      min-width: 0 !important;
      overflow-wrap: anywhere !important;
    }
    .esh-print-page .esh-document-header-row > .esh-document-authority {
      grid-column: 1 !important;
    }
    .esh-print-page .esh-document-header-row > .esh-document-reference {
      grid-column: 3 !important;
    }
    .esh-print-page .esh-document-header-row > .esh-document-brand {
      grid-column: 2 !important;
      grid-row: 1 !important;
      flex: none !important;
      width: 18mm !important;
      padding-inline: 1mm !important;
      justify-self: center !important;
    }
    .esh-print-page .esh-official-document-header:dir(rtl) .esh-document-authority {
      grid-column: 3 !important;
      text-align: right !important;
    }
    .esh-print-page .esh-official-document-header:dir(rtl) .esh-document-reference {
      grid-column: 1 !important;
      text-align: left !important;
    }
    .esh-print-page .esh-official-document-header:dir(ltr) .esh-document-authority {
      text-align: left !important;
    }
    .esh-print-page .esh-official-document-header:dir(ltr) .esh-document-reference {
      text-align: right !important;
    }
    .esh-print-page .esh-document-brand .esh-club-logo {
      width: 16mm !important;
      height: 16mm !important;
    }
    .esh-print-page .esh-document-authority p {
      font-size: 18px !important;
      line-height: 1.35 !important;
      white-space: normal !important;
      overflow-wrap: anywhere !important;
    }
    .esh-print-page .esh-document-reference p {
      font-size: 18px !important;
      line-height: 1.35 !important;
      white-space: normal !important;
      overflow-wrap: anywhere !important;
    }
    .esh-print-page .esh-official-document-header:dir(ltr) .esh-document-authority p {
      font-size: 18px !important;
    }
    .esh-print-page .esh-official-document-header:dir(ltr) .esh-document-reference p {
      font-size: 18px !important;
    }
    .esh-print-page .esh-official-document-header h1 {
      font-size: 18px !important;
      line-height: 1.35 !important;
    }

    /* Keep the player attestation masthead aligned with the shared 18px rule. */
    .esh-print-page.esh-attestation-document .esh-document-authority p {
      font-size: 18px !important;
      line-height: 1.4 !important;
    }
    .esh-print-page.esh-attestation-document .esh-document-reference p {
      font-size: 18px !important;
      line-height: 1.4 !important;
    }
    .esh-print-page.esh-attestation-document .esh-official-document-header h1 {
      font-size: 18px !important;
      line-height: 1.4 !important;
    }
    .esh-print-page.esh-attestation-document .esh-attestation-body {
      font-size: 19px !important;
      line-height: 1.65 !important;
    }
    .esh-print-page.esh-attestation-document .esh-attestation-body .text-xl {
      font-size: 19px !important;
    }
    .esh-print-page.esh-attestation-document .esh-attestation-footer {
      font-size: 19px !important;
    }
    .esh-print-page.esh-attestation-document .esh-attestation-signature {
      font-size: 19px !important;
    }

    /* Keep inventory labels and cells on the shared 19px document scale. */
    .esh-print-page.inventory-list-document .category-header span:first-child {
      font-size: 19px !important;
      line-height: 1.35 !important;
    }
    .esh-print-page.inventory-list-document .category-header span:last-child {
      font-size: 19px !important;
      line-height: 1.35 !important;
    }
    .esh-print-page.inventory-list-document table:not(.grand-total-section) th,
    .esh-print-page.inventory-list-document table:not(.grand-total-section) td {
      font-size: 11px !important;
      line-height: 1.3 !important;
      padding-block: 2px !important;
    }
    .esh-print-page.inventory-list-document .grand-total-section th,
    .esh-print-page.inventory-list-document .grand-total-section td {
      font-size: 19px !important;
      line-height: 1.4 !important;
    }
    .esh-print-page.inventory-list-document .document-signatures p {
      font-size: 19px !important;
    }

    .esh-print-page table {
      table-layout: fixed !important;
      border-collapse: collapse !important;
    }

    /* Repeat table headings when a long document flows onto another A4 page.
       Totals are ordinary rows and must appear only where they occur. */
    .esh-print-page thead { display: table-header-group !important; }
    .esh-print-page tfoot { display: table-row-group !important; }
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
    .esh-print-page .document-signatures {
      direction: ltr !important;
      justify-content: flex-start !important;
      text-align: left !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .esh-print-page .document-signatures.signature-block,
    .esh-print-page .document-signatures.signatures-section,
    .esh-print-page .signature-block.document-signatures-multiple {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .esh-print-page .document-signatures > *,
    .esh-print-page .document-signatures p,
    .esh-print-page .document-signatures span {
      text-align: left !important;
    }
    .esh-print-page .document-signatures-multiple {
      direction: ltr !important;
      justify-content: start !important;
    }
    .esh-print-page .document-signatures-multiple > :nth-child(2),
    .esh-print-page .document-signatures-multiple > :nth-child(2) p,
    .esh-print-page .document-signatures-multiple > :nth-child(2) span,
    .esh-print-page .document-signatures-multiple > :nth-child(3),
    .esh-print-page .document-signatures-multiple > :nth-child(3) p,
    .esh-print-page .document-signatures-multiple > :nth-child(3) span {
      text-align: left !important;
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

  if (!printWindow) {
    printViaHiddenIframe(clonedTarget, styleMarkup, printStyles, title);
    return;
  }

  const printDocument = printWindow.document;
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

/**
 * Fallback printing method via an in-page hidden iframe when popup windows are blocked.
 */
function printViaHiddenIframe(clonedTarget: HTMLElement, styleMarkup: string, printStyles: string, title?: string): void {
  const existing = document.getElementById("esh-fallback-print-frame");
  if (existing) existing.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "esh-fallback-print-frame";
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  const sourceDirection = clonedTarget.getAttribute("dir") || document.documentElement.getAttribute("dir") || "ltr";
  doc.open();
  doc.write(`<!doctype html><html dir="${sourceDirection}"><head><meta charset="utf-8"><title>${title || document.title}</title>${styleMarkup}<style>${printStyles}</style></head><body><div class="esh-print-root"></div></body></html>`);
  doc.close();

  const root = doc.querySelector<HTMLElement>(".esh-print-root");
  if (root) root.appendChild(clonedTarget.cloneNode(true));

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.print();
    }
  }, 400);
}

/**
 * Robust printing for remote or local PDF and document URLs.
 * Uses a same-origin Blob URL in a hidden iframe to bypass browser cross-origin plugin restrictions.
 */
export async function printPdfOrDocumentUrl(url: string, title?: string): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const isImage = blob.type.startsWith("image/");
    const mime = isImage ? blob.type : "application/pdf";
    const objectBlob = new Blob([blob], { type: mime });
    const blobUrl = URL.createObjectURL(objectBlob);

    if (isImage) {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${title || "Document"}</title>
              <style>
                @page { size: A4; margin: 10mm; }
                body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
                img { max-width: 95%; max-height: 90vh; object-fit: contain; }
              </style>
            </head>
            <body>
              <img src="${blobUrl}" onload="window.print();" />
            </body>
          </html>
        `);
        printWindow.document.close();
        return;
      }
    }

    const existing = document.getElementById("esh-pdf-print-frame");
    if (existing) existing.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "esh-pdf-print-frame";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.setAttribute("aria-hidden", "true");
    iframe.src = blobUrl;
    document.body.appendChild(iframe);

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          const w = window.open(blobUrl, "_blank");
          if (w) {
            w.onload = () => {
              w.focus();
              w.print();
            };
          }
        }
      }, 300);
    };
  } catch (err) {
    console.warn("[printPdfOrDocumentUrl] Blob print failed, opening url directly", err);
    const w = window.open(url, "_blank");
    if (w) {
      w.onload = () => {
        w.focus();
        w.print();
      };
    }
  }
}
