"use client";

import { ESH_DOCUMENT_FONT_FAMILY, ESH_PRINT_WATERMARK_DATA_URL } from "./watermark";

/**
 * Universal Official Institutional Print Engine for ESH SIDI HOSNI.
 *
 * Provides 100% visual parity between screen preview and printed document.
 * Eliminates layout scrambling, font metric shifts, decorative lines, and broken headers.
 * Strictly enforces Traditional Arabic / Arabic Typesetting typography and diagonal ESH watermark.
 */
export function printDocumentElement(elementIdOrElement: string | HTMLElement, title?: string): void {
  if (typeof window === "undefined") return;

  const targetElement =
    typeof elementIdOrElement === "string"
      ? document.getElementById(elementIdOrElement)
      : elementIdOrElement;

  if (!targetElement) {
    console.warn(`[printDocumentElement] Target element not found:`, elementIdOrElement);
    window.print();
    return;
  }

  // Remove existing print frame if present
  const existingFrame = document.getElementById("esh-official-print-frame");
  if (existingFrame) {
    try {
      existingFrame.remove();
    } catch {
      // ignore
    }
  }

  // Create isolated print frame positioned invisibly
  const iframe = document.createElement("iframe");
  iframe.id = "esh-official-print-frame";
  iframe.setAttribute(
    "style",
    "position: fixed; right: 0; bottom: 0; width: 0; height: 0; border: 0; opacity: 0; pointer-events: none; z-index: -9999;"
  );
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  // Extract all compiled styles from document.styleSheets
  let compiledCss = "";
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        if (sheet.cssRules) {
          for (const rule of Array.from(sheet.cssRules)) {
            compiledCss += rule.cssText + "\n";
          }
        }
      } catch {
        if (sheet.href) {
          compiledCss += `@import url("${sheet.href}");\n`;
        }
      }
    }
  } catch {
    // fallback if styleSheets array iteration fails
  }

  // Also include inline <style> elements
  document.querySelectorAll("style").forEach((styleEl) => {
    if (styleEl.textContent) {
      compiledCss += styleEl.textContent + "\n";
    }
  });

  const isRtl = document.documentElement.dir === "rtl" || document.dir === "rtl";
  const docTitle = title || "وثيقة — ESH SIDI HOSNI";

  // Clone element and strip modal screen constraints
  const clone = targetElement.cloneNode(true) as HTMLElement;
  clone.classList.remove("hidden");
  clone.style.display = "block";
  clone.style.visibility = "visible";
  clone.style.opacity = "1";
  clone.style.padding = "0";
  clone.style.margin = "0";
  clone.style.width = "100%";
  clone.style.maxWidth = "100%";
  clone.style.boxShadow = "none";
  clone.style.border = "none";
  clone.style.minHeight = "auto";

  const targetHtml = clone.outerHTML;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="${isRtl ? "ar" : "fr"}" dir="${isRtl ? "rtl" : "ltr"}">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <base href="${window.location.origin}/" />
        <title>${docTitle}</title>
        <style>
          /* Compiled Application Styles */
          ${compiledCss}

          /* Official Institutional Document Print Engine */
          @page {
            size: A4 portrait;
            margin: 10mm 12mm 10mm 12mm !important;
          }

          @media print {
            @page {
              size: A4 portrait;
              margin: 10mm 12mm 10mm 12mm !important;
            }
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            box-sizing: border-box !important;
          }

          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            font-family: ${ESH_DOCUMENT_FONT_FAMILY} !important;
            -webkit-font-smoothing: antialiased;
            overflow: visible !important;
          }

          /* Ensure all text nodes inside printable documents use the official fonts */
          body, p, span, h1, h2, h3, h4, td, th, div, label {
            font-family: ${ESH_DOCUMENT_FONT_FAMILY} !important;
          }

          /* Remove all underlines, decorative horizontal rules and decorative lines */
          u, ins, a, .underline, [style*="text-decoration: underline"] {
            text-decoration: none !important;
          }

          /* Official Institutional Mandate: ALL numbers in all club documents strictly use ARIAL EN GRAS (Arial Bold). Strictly NO other font allowed. */
          .font-mono, [class*="font-mono"],
          .tabular-nums, [class*="tabular-nums"],
          .num, .doc-number, .digit,
          span[dir="ltr"], td[dir="ltr"] {
            font-family: Arial, sans-serif !important;
            font-weight: 700 !important;
          }

          .printable-document :is(.font-mono, .tabular-nums),
          .print-sheet :is(.font-mono, .tabular-nums) {
            font-family: Arial, sans-serif !important;
            font-weight: 700 !important;
          }

          /* Use an image layer, not a CSS background: browsers can omit
             background graphics from print despite print-color-adjust. */
          .esh-print-watermark {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            z-index: 0 !important;
            object-fit: fill !important;
            pointer-events: none !important;
          }

          .print-sheet {
            position: relative !important;
            z-index: 1 !important;
            background: transparent !important;
          }

          .esh-security-watermark,
          #official-inventory-preview-document,
          #official-inventory-document,
          #official-insurance-list-document,
          .esh-official-document {
            background-color: transparent !important;
            background-image: none !important;
          }

          /* Hide inner preview watermark div in print because body::before handles all pages uniformly */
          .esh-security-watermark > div:first-child[style*="backgroundImage"],
          .pointer-events-none[style*="backgroundImage"],
          [style*="background-image"][class*="pointer-events-none"] {
            display: none !important;
          }

          /* Ensure all buttons, modal close icons, and interactive elements are hidden */
          .print\\:hidden, button, [role="button"], [role="toolbar"] {
            display: none !important;
          }

          /* Printable document wrapper rules */
          .printable-document,
          .print-sheet,
          #official-inventory-preview-document,
          #official-insurance-list-document,
          [id^="official-"] {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            position: relative !important;
            z-index: 1 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            box-shadow: none !important;
            border: none !important;
            min-height: auto !important;
            overflow: visible !important;
          }

          /* Clean Administrative Table Formatting */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
            margin-top: 4px !important;
            margin-bottom: 8px !important;
            page-break-inside: auto !important;
            break-inside: auto !important;
          }

          thead {
            display: table-header-group !important;
          }

          tbody {
            display: table-row-group !important;
          }

          tfoot {
            display: table-footer-group !important;
          }

          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          th, td {
            border: 1px solid #d1d5db !important;
            padding: 5px 6px !important;
            box-sizing: border-box !important;
            word-break: break-word !important;
            overflow-wrap: break-word !important;
            vertical-align: middle !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            font-family: ${ESH_DOCUMENT_FONT_FAMILY} !important;
          }

          th {
            background-color: #f3f4f6 !important;
            color: #000000 !important;
            font-weight: 700 !important;
          }

          /* Flexbox & Grid Resets */
          .flex { display: flex !important; }
          .flex-col { flex-direction: column !important; }
          .flex-row { flex-direction: row !important; }
          .items-center { align-items: center !important; }
          .items-start { align-items: flex-start !important; }
          .items-end { align-items: flex-end !important; }
          .justify-between { justify-content: space-between !important; }
          .justify-center { justify-content: center !important; }
          .justify-start { justify-content: flex-start !important; }
          .justify-end { justify-content: flex-end !important; }
          .shrink-0 { flex-shrink: 0 !important; }
          .flex-1 { flex: 1 1 0% !important; }

          .grid { display: grid !important; }
          .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
          .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }

          /* Typography & Alignments */
          .text-center { text-align: center !important; }
          .text-start { text-align: start !important; }
          .text-end { text-align: end !important; }
          .font-bold { font-weight: 700 !important; }
          .font-semibold { font-weight: 600 !important; }
          .font-medium { font-weight: 500 !important; }
          .font-black { font-weight: 900 !important; }

          /* Page break protection for headers, totals, and signatures */
          .category-header {
            page-break-after: avoid !important;
            break-after: avoid !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .category-section {
            page-break-inside: auto !important;
            break-inside: auto !important;
          }

          .grand-total-section,
          .signatures-section,
          .signature-block,
          .print-footer {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        </style>
      </head>
      <body>
        <img class="esh-print-watermark" src="${ESH_PRINT_WATERMARK_DATA_URL}" alt="" aria-hidden="true" />
        <div class="print-sheet">
          ${targetHtml}
        </div>
      </body>
    </html>
  `);
  doc.close();

  // Wait for all images and fonts to complete loading before invoking print
  const docImages = Array.from(doc.images);
  const imageWaiters = docImages.map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });
  });

  Promise.all(imageWaiters).then(() => {
    const fontsReady = doc.fonts ? doc.fonts.ready : Promise.resolve();
    fontsReady
      .then(() => {
        setTimeout(executePrint, 150);
      })
      .catch(() => {
        setTimeout(executePrint, 250);
      });
  });

  function executePrint() {
    try {
      if (iframe.contentWindow) {
        iframe.contentWindow.onbeforeprint = null;
        iframe.contentWindow.onafterprint = () => {
          try {
            iframe.remove();
          } catch {
            // ignore
          }
        };
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } else {
        window.print();
      }
    } catch (e) {
      console.error("[printDocumentElement] Error printing iframe:", e);
      window.print();
    }
  }
}
