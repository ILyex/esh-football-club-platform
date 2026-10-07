"use client";

import { ESH_DOCUMENT_FONT_FAMILY } from "./watermark";

const PRINT_STYLE_ID = "esh-document-print-style";
const PRINT_TARGET_ATTRIBUTE = "data-esh-print-target";
const PRINT_ANCESTOR_ATTRIBUTE = "data-esh-print-ancestor";
const PRINT_HIDDEN_ATTRIBUTE = "data-esh-print-hidden";

/**
 * Print the actual preview element instead of cloning and reconstructing it.
 * Cloning made Chrome resolve a second set of widths, responsive rules and
 * font metrics, which caused the printed sheet to diverge from the preview.
 */
export function printDocumentElement(elementIdOrElement: string | HTMLElement, title?: string): void {
  if (typeof window === "undefined") return;

  const target = typeof elementIdOrElement === "string"
    ? document.getElementById(elementIdOrElement)
    : elementIdOrElement;

  if (!target) {
    console.warn("[printDocumentElement] Printable document not found:", elementIdOrElement);
    window.print();
    return;
  }

  document.getElementById(PRINT_STYLE_ID)?.remove();

  const ancestors: HTMLElement[] = [];
  let ancestor = target.parentElement;
  while (ancestor && ancestor !== document.body) {
    ancestors.push(ancestor);
    ancestor = ancestor.parentElement;
  }

  const oldTargetAttribute = target.getAttribute(PRINT_TARGET_ATTRIBUTE);
  const oldBodyClass = document.body.classList.contains("esh-document-printing");
  const previewStyle = window.getComputedStyle(target);
  const fillsPage = target.classList.contains("flex")
    && target.classList.contains("flex-col")
    && target.classList.contains("justify-between");
  const ancestorAttributes = new Map<HTMLElement, string | null>();
  const hiddenAttributes = new Map<HTMLElement, string | null>();
  for (const element of ancestors) {
    ancestorAttributes.set(element, element.getAttribute(PRINT_ANCESTOR_ATTRIBUTE));
    element.setAttribute(PRINT_ANCESTOR_ATTRIBUTE, "");
  }

  // Keep only the DOM path that contains the actual preview sheet. Using
  // visibility:hidden for modal footers/backdrops leaves them in layout and
  // makes Chrome create an extra blank page. Removing siblings from print
  // layout guarantees that Chrome receives exactly one A4 sheet.
  let pathChild: HTMLElement = target;
  let pathParent = target.parentElement;
  while (pathParent) {
    for (const child of Array.from(pathParent.children)) {
      if (child !== pathChild && child instanceof HTMLElement) {
        hiddenAttributes.set(child, child.getAttribute(PRINT_HIDDEN_ATTRIBUTE));
        child.setAttribute(PRINT_HIDDEN_ATTRIBUTE, "");
      }
    }
    if (pathParent === document.body) break;
    pathChild = pathParent;
    pathParent = pathParent.parentElement;
  }

  target.setAttribute(PRINT_TARGET_ATTRIBUTE, "");
  document.body.classList.add("esh-document-printing");

  const printStyle = document.createElement("style");
  printStyle.id = PRINT_STYLE_ID;
  printStyle.textContent = `
    @media print {
      /* Explicit physical dimensions are understood consistently by
         Chromium, Edge and Firefox; the print dialog may still apply a
         user's manual scale setting, which CSS cannot override. */
      @page { size: 210mm 297mm; margin: 0 !important; }
      html, body {
        width: 210mm !important;
        min-width: 210mm !important;
        height: 297mm !important;
        min-height: 297mm !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
        background: #fff !important;
        color: #000 !important;
        direction: ltr !important;
        font-family: ${ESH_DOCUMENT_FONT_FAMILY} !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body.esh-document-printing * {
        visibility: hidden !important;
      }
      body.esh-document-printing [${PRINT_HIDDEN_ATTRIBUTE}] {
        display: none !important;
      }
      body.esh-document-printing [${PRINT_ANCESTOR_ATTRIBUTE}] {
        display: contents !important;
        position: static !important;
        width: auto !important;
        height: auto !important;
        min-width: 0 !important;
        min-height: 0 !important;
        max-width: none !important;
        max-height: none !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
        transform: none !important;
        filter: none !important;
        perspective: none !important;
        contain: none !important;
        visibility: visible !important;
      }
      /* Do not let the modal's max-w-4xl/flex sizing become the print width.
         Chrome resolves percentage widths against that wrapper before it
         applies the A4 page box, which makes the document look centred and
         shrunken even though the paper itself is A4. */
      body.esh-document-printing [${PRINT_ANCESTOR_ATTRIBUTE}] > [${PRINT_ANCESTOR_ATTRIBUTE}],
      body.esh-document-printing [${PRINT_ANCESTOR_ATTRIBUTE}] > [${PRINT_TARGET_ATTRIBUTE}] {
        width: 210mm !important;
        min-width: 210mm !important;
        max-width: 210mm !important;
        height: 297mm !important;
        min-height: 297mm !important;
        max-height: 297mm !important;
        box-sizing: border-box !important;
        background: #fff !important;
        overflow: hidden !important;
      }
      body.esh-document-printing [${PRINT_TARGET_ATTRIBUTE}] {
        display: ${fillsPage ? "flex" : "block"} !important;
        /* Keep the exact preview element in normal print flow. A fixed
           left-anchored sheet was responsible for the off-centre paper and
           the visible horizontal/bottom gray edges in Chrome's preview. */
        position: absolute !important;
        inset: 0 !important;
        flex-direction: ${fillsPage ? "column" : previewStyle.flexDirection} !important;
        justify-content: ${fillsPage ? "space-between" : previewStyle.justifyContent} !important;
        width: 210mm !important;
        min-width: 210mm !important;
        max-width: 210mm !important;
        height: 297mm !important;
        min-height: 297mm !important;
        max-height: 297mm !important;
        box-sizing: border-box !important;
        margin: 0 !important;
        padding: ${previewStyle.padding} !important;
        border: 0 !important;
        border-radius: 0 !important;
        outline: 0 !important;
        box-shadow: none !important;
        overflow: hidden !important;
        transform: none !important;
        background-color: #fff !important;
        background-image: none !important;
        color: #000 !important;
        visibility: visible !important;
        opacity: 1 !important;
        page-break-before: avoid !important;
        page-break-after: avoid !important;
        break-before: avoid !important;
        break-after: avoid !important;
        direction: ${target.dir || document.documentElement.dir || "ltr"} !important;
        font-family: ${ESH_DOCUMENT_FONT_FAMILY} !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        page-break-before: avoid !important;
        page-break-after: avoid !important;
        break-before: avoid !important;
        break-after: avoid !important;
      }
      body.esh-document-printing,
      body.esh-document-printing [${PRINT_ANCESTOR_ATTRIBUTE}],
      body.esh-document-printing [${PRINT_TARGET_ATTRIBUTE}] {
        border: 0 !important;
        outline: 0 !important;
        box-shadow: none !important;
      }
      body.esh-document-printing [${PRINT_TARGET_ATTRIBUTE}] *,
      body.esh-document-printing [${PRINT_TARGET_ATTRIBUTE}] *::before,
      body.esh-document-printing [${PRINT_TARGET_ATTRIBUTE}] *::after {
        box-sizing: border-box !important;
        visibility: visible !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      /* The preview sheet is a column flex container. Stretch its real
         content column explicitly so Chrome cannot resolve it to the modal's
         old narrow width during print layout. */
      body.esh-document-printing [${PRINT_TARGET_ATTRIBUTE}] > :not(.esh-security-watermark) {
        width: 190mm !important;
        min-width: 190mm !important;
        max-width: 190mm !important;
        align-self: center !important;
        margin-inline: auto !important;
        /* This is a column flexbox. A 190mm flex-basis becomes a vertical
           height and pushes the signatures onto a second sheet. */
        flex: 0 0 auto !important;
        min-height: 0 !important;
      }
      body.esh-document-printing [${PRINT_TARGET_ATTRIBUTE}] .esh-official-document-header,
      body.esh-document-printing [${PRINT_TARGET_ATTRIBUTE}] .esh-official-document-header > div,
      body.esh-document-printing [${PRINT_TARGET_ATTRIBUTE}] table {
        width: 190mm !important;
        min-width: 190mm !important;
        max-width: 190mm !important;
      }
      }
      body.esh-document-printing [${PRINT_TARGET_ATTRIBUTE}] button,
      body.esh-document-printing [${PRINT_TARGET_ATTRIBUTE}] [role="button"],
      body.esh-document-printing [${PRINT_TARGET_ATTRIBUTE}] [role="toolbar"],
      body.esh-document-printing [${PRINT_TARGET_ATTRIBUTE}] .print\\:hidden {
        display: none !important;
      }
      body.esh-document-printing [${PRINT_TARGET_ATTRIBUTE}] .esh-security-watermark [class~="print:hidden"] {
        display: block !important;
        visibility: visible !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body.esh-document-printing [${PRINT_TARGET_ATTRIBUTE}] table {
        width: 100% !important;
        max-width: 100% !important;
        border-collapse: collapse !important;
        table-layout: fixed !important;
      }
      body.esh-document-printing [${PRINT_TARGET_ATTRIBUTE}] th,
      body.esh-document-printing [${PRINT_TARGET_ATTRIBUTE}] td {
        box-sizing: border-box !important;
        overflow-wrap: anywhere !important;
        word-break: break-word !important;
      }
      body.esh-document-printing [${PRINT_TARGET_ATTRIBUTE}] .font-mono,
      body.esh-document-printing [${PRINT_TARGET_ATTRIBUTE}] .tabular-nums,
      body.esh-document-printing [${PRINT_TARGET_ATTRIBUTE}] [class*="font-mono"],
      body.esh-document-printing [${PRINT_TARGET_ATTRIBUTE}] [class*="tabular-nums"] {
        font-family: Arial, sans-serif !important;
        font-weight: 700 !important;
      }
      body.esh-document-printing [${PRINT_TARGET_ATTRIBUTE}] u,
      body.esh-document-printing [${PRINT_TARGET_ATTRIBUTE}] ins,
      body.esh-document-printing [${PRINT_TARGET_ATTRIBUTE}] a,
      body.esh-document-printing [${PRINT_TARGET_ATTRIBUTE}] .underline {
        text-decoration: none !important;
      }
    }
  `;
  document.head.appendChild(printStyle);

  const originalTitle = document.title;
  if (title) document.title = title;

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    window.removeEventListener("afterprint", cleanup);
    printStyle.remove();
    if (oldTargetAttribute === null) target.removeAttribute(PRINT_TARGET_ATTRIBUTE);
    else target.setAttribute(PRINT_TARGET_ATTRIBUTE, oldTargetAttribute);
    for (const [element, oldValue] of ancestorAttributes) {
      if (oldValue === null) element.removeAttribute(PRINT_ANCESTOR_ATTRIBUTE);
      else element.setAttribute(PRINT_ANCESTOR_ATTRIBUTE, oldValue);
    }
    for (const [element, oldValue] of hiddenAttributes) {
      if (oldValue === null) element.removeAttribute(PRINT_HIDDEN_ATTRIBUTE);
      else element.setAttribute(PRINT_HIDDEN_ATTRIBUTE, oldValue);
    }
    if (!oldBodyClass) document.body.classList.remove("esh-document-printing");
    document.title = originalTitle;
  };

  window.addEventListener("afterprint", cleanup, { once: true });
  void document.fonts.ready.finally(() => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.print()));
  });
  window.setTimeout(cleanup, 120_000);
}
