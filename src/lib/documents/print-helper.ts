"use client";

import { ESH_DOCUMENT_FONT_FAMILY } from "./watermark";

/**
 * Print a document through an isolated A4 document.
 *
 * The old implementation temporarily changed the dashboard body and printed
 * an element inside the modal. That left the modal's flex/max-width/overflow
 * chain in Chrome's print layout. Edge happened to resolve that chain
 * differently, so the on-screen preview and the printed sheet could have
 * different widths. An iframe gives the printer one small, deterministic
 * document: the same preview node, the same styles, and no dashboard parents.
 */
export function printDocumentElement(elementIdOrElement: string | HTMLElement, title?: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const target = typeof elementIdOrElement === "string"
    ? document.getElementById(elementIdOrElement)
    : elementIdOrElement;

  if (!target) {
    console.warn("[printDocumentElement] Printable document not found:", elementIdOrElement);
    window.print();
    return;
  }

  // A user can click the print button twice while the first dialog is open.
  // Reuse/close the previous isolated frame instead of accumulating hidden
  // browsing contexts and leaking memory in the renderer.
  document.querySelector<HTMLElement>("iframe[data-esh-print-frame]")?.remove();

  const frame = document.createElement("iframe");
  frame.setAttribute("data-esh-print-frame", "true");
  frame.setAttribute("title", title || "ESH document print");
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  // Give the isolated document a real A4 viewport even while it is parked
  // off-screen. A zero-sized iframe makes responsive rules resolve against a
  // 0px viewport in Chromium before print media is applied.
  frame.style.width = "210mm";
  frame.style.height = "297mm";
  frame.style.border = "0";
  frame.style.opacity = "0";
  frame.style.pointerEvents = "none";
  frame.style.left = "-10000px";
  frame.style.top = "-10000px";
  document.body.appendChild(frame);

  const printWindow = frame.contentWindow;
  const printDocument = frame.contentDocument;
  if (!printWindow || !printDocument) {
    frame.remove();
    window.print();
    return;
  }

  const escapeHtml = (value: string) => value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  const sourceDirection = target.getAttribute("dir") || document.documentElement.getAttribute("dir") || "ltr";

  // Copy only stylesheets and style blocks. Scripts and the dashboard DOM are
  // deliberately excluded, which makes the print path both lighter and less
  // sensitive to application layout changes.
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
    @page { size: A4 portrait; margin: 0; }

    html, body {
      width: 210mm !important;
      min-width: 210mm !important;
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
      width: 210mm !important;
      min-width: 210mm !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    /* This is the only page box the browser is allowed to paginate. */
    .esh-print-page {
      position: relative !important;
      display: flex !important;
      flex-direction: column !important;
      box-sizing: border-box !important;
      width: 210mm !important;
      min-width: 210mm !important;
      max-width: 210mm !important;
      height: 297mm !important;
      min-height: 297mm !important;
      max-height: 297mm !important;
      margin: 0 !important;
      border: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      outline: 0 !important;
      overflow: hidden !important;
      transform: none !important;
      background-color: #fff !important;
      color: #000 !important;
      break-before: avoid !important;
      break-after: avoid !important;
      page-break-before: avoid !important;
      page-break-after: avoid !important;
      direction: ${sourceDirection} !important;
      font-family: ${ESH_DOCUMENT_FONT_FAMILY} !important;
    }

    /* The preview page has 10mm padding, so 100% here is the physical
       190mm content area. It cannot resolve against the old modal width. */
    .esh-print-page > :not(.esh-security-watermark) {
      width: 100% !important;
      min-width: 0 !important;
      max-width: none !important;
      box-sizing: border-box !important;
      align-self: stretch !important;
      margin-inline: 0 !important;
      flex: 0 0 auto !important;
    }

    .esh-print-page > .esh-security-watermark {
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
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

    .esh-print-page th,
    .esh-print-page td {
      box-sizing: border-box !important;
      overflow-wrap: anywhere !important;
      word-break: break-word !important;
    }

    .esh-print-page [class~="print:hidden"],
    .esh-print-page [class~="no-print"] {
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
  printDocument.write(`<!doctype html><html dir="${escapeHtml(sourceDirection)}"><head><meta charset="utf-8"><base href="${escapeHtml(document.baseURI)}"><title>${escapeHtml(title || document.title)}</title>${styleMarkup}<style data-esh-print-style>${printStyles}</style></head><body><div class="esh-print-root"></div></body></html>`);
  printDocument.close();

  const root = printDocument.querySelector<HTMLElement>(".esh-print-root");
  if (!root) {
    frame.remove();
    window.print();
    return;
  }
  root.appendChild(clonedTarget);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    printWindow.removeEventListener("afterprint", cleanup);
    frame.remove();
  };

  printWindow.addEventListener("afterprint", cleanup, { once: true });

  const waitForAssets = async () => {
    try {
      // Stylesheets are loaded asynchronously in a newly-created browsing
      // context. Waiting only for fonts/images can still open Chrome's dialog
      // before Tailwind's width rules have arrived, which recreates the old
      // narrow-sheet symptom on a cold cache.
      const stylesheets = Array.from(printDocument.querySelectorAll<HTMLLinkElement>("link[rel='stylesheet']"));
      await Promise.all(stylesheets.map((link) => link.sheet
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
          const timeout = window.setTimeout(resolve, 5000);
          const done = () => {
            window.clearTimeout(timeout);
            resolve();
          };
          link.addEventListener("load", done, { once: true });
          link.addEventListener("error", done, { once: true });
        })));
      await printDocument.fonts?.ready;
      const images = Array.from(printDocument.images);
      await Promise.all(images.map((image) => image.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        })));
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
