"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A4 paginator for long printed documents.
 *
 * Problem it solves: a roster or statement taller than one sheet was rendered
 * as ONE continuous sheet. Chrome does not fragment flex/overflow containers
 * across pages, so everything past the first A4 height was cut off in print and
 * in the saved PDF, and the preview showed a single endless sheet instead of
 * pages 1/2/3.
 *
 * How it works:
 *  - the authored document stays in the DOM (printDocumentElement clones it);
 *  - its content is flattened into printable atoms: standalone blocks and table
 *    rows, with table headers repeated on every page;
 *  - atoms are poured into real A4 page boxes by measured height;
 *  - on screen the paginated copy is shown and the original is hidden; in print
 *    the copy is hidden again so the print pipeline is untouched.
 */

const MM_TO_PX = 96 / 25.4;
const PAGE_HEIGHT_MM = 297;
const PAGE_WIDTH_MM = 210;

type Atom =
  | { kind: "node"; element: HTMLElement }
  | { kind: "rows"; shell: HTMLTableElement; head: HTMLTableSectionElement | null; colgroup: HTMLTableColElement | null; rows: HTMLTableRowElement[] };

/**
 * Flattens the document into atoms. Wrappers that only exist for spacing are
 * skipped, but every leaf block (headings, paragraphs, signature blocks, list
 * items) is preserved with its own classes so it keeps its look.
 */
function collectAtoms(root: HTMLElement, maxAtomHeight: number, atoms: Atom[] = []): Atom[] {
  for (const child of Array.from(root.children)) {
    const element = child as HTMLElement;
    if (element.tagName === "STYLE" || element.tagName === "SCRIPT") continue;
    if (element.classList.contains("esh-document-watermark")) continue;

    if (element.tagName === "TABLE") {
      const table = element as HTMLTableElement;
      const rows = Array.from(table.tBodies).flatMap((body) =>
        Array.from(body.rows).map((row) => row.cloneNode(true) as HTMLTableRowElement)
      );
      if (rows.length === 0) continue;
      const head = table.tHead ? (table.tHead.cloneNode(true) as HTMLTableSectionElement) : null;
      const shell = table.cloneNode(false) as HTMLTableElement;
      shell.removeAttribute("id");
      const colgroup = table.querySelector("colgroup");
      atoms.push({ kind: "rows", shell, head, colgroup: colgroup ? (colgroup.cloneNode(true) as HTMLTableColElement) : null, rows });
      continue;
    }

    // Containers are descended into; only leaf-ish content becomes an atom.
    const tall = element.getBoundingClientRect().height > maxAtomHeight;
    if (element.querySelector("table") || tall) {
      collectAtoms(element, maxAtomHeight, atoms);
      continue;
    }

    const clone = element.cloneNode(true) as HTMLElement;
    clone.removeAttribute("id");
    atoms.push({ kind: "node", element: clone });
  }
  return atoms;
}

export function A4Pager({ targetId, className }: { targetId: string; className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const source = document.getElementById(targetId);
    const host = hostRef.current;
    if (!source || !host) return;

    source.classList.add("esh-paginated-source");
    let cancelled = false;

    const render = () => {
      const stage = document.createElement("div");
      try {
        const style = window.getComputedStyle(source);
        const padTop = Number.parseFloat(style.paddingTop) || 0;
        const padBottom = Number.parseFloat(style.paddingBottom) || 0;
        const padLeft = Number.parseFloat(style.paddingLeft) || 0;
        const padRight = Number.parseFloat(style.paddingRight) || 0;
        const contentHeight = PAGE_HEIGHT_MM * MM_TO_PX - padTop - padBottom;

        // Measure at a real sheet width: a narrower stage changes text wrapping
        // and therefore where pages break.
        stage.setAttribute("aria-hidden", "true");
        stage.style.cssText = `position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none;width:${PAGE_WIDTH_MM}mm;`;
        document.body.appendChild(stage);

        const pages: HTMLElement[] = [];
        const watermarks = Array.from(source.children).filter(
          (child): child is HTMLElement => child instanceof HTMLElement && child.classList.contains("esh-document-watermark")
        );

        const newPage = () => {
          const page = document.createElement("div");
          page.className = "esh-a4-page";
          page.style.direction = style.direction;
          page.style.fontFamily = style.fontFamily;
          page.style.fontSize = style.fontSize;
          page.style.lineHeight = style.lineHeight;
          page.style.color = style.color;
          page.style.padding = `${padTop}px ${padRight}px ${padBottom}px ${padLeft}px`;
          for (const watermark of watermarks) page.appendChild(watermark.cloneNode(true));
          const body = document.createElement("div");
          body.className = "esh-a4-page-body";
          body.style.height = `${contentHeight}px`;
          page.appendChild(body);
          stage.appendChild(page);
          pages.push(page);
          return body;
        };

        let body = newPage();
        const full = () => body.scrollHeight > contentHeight + 1;

        for (const atom of collectAtoms(source, contentHeight * 0.6)) {
          if (atom.kind === "node") {
            body.appendChild(atom.element);
            if (full() && body.childElementCount > 1) {
              body.removeChild(atom.element);
              body = newPage();
              body.appendChild(atom.element);
            }
            continue;
          }

          // Table: repeat the header on every page and split between rows.
          let table = atom.shell.cloneNode(false) as HTMLTableElement;
          if (atom.colgroup) table.appendChild(atom.colgroup.cloneNode(true));
          if (atom.head) table.appendChild(atom.head.cloneNode(true));
          let tbody = document.createElement("tbody");
          table.appendChild(tbody);
          body.appendChild(table);

          for (const row of atom.rows) {
            tbody.appendChild(row);
            if (full() && tbody.rows.length > 1) {
              tbody.removeChild(row);
              body = newPage();
              table = atom.shell.cloneNode(false) as HTMLTableElement;
              if (atom.colgroup) table.appendChild(atom.colgroup.cloneNode(true));
              if (atom.head) table.appendChild(atom.head.cloneNode(true));
              tbody = document.createElement("tbody");
              table.appendChild(tbody);
              body.appendChild(table);
              tbody.appendChild(row);
            }
          }
        }

        // Remove trailing pages that hold nothing but a repeated watermark.
        for (const page of [...pages]) {
          const pageBody = page.querySelector(".esh-a4-page-body");
          if (pageBody && !pageBody.textContent?.trim() && !pageBody.querySelector("img,table")) page.remove();
        }

        stage.remove();
        if (cancelled) return;
        host.replaceChildren();
        for (const page of pages) host.appendChild(page);
        setReady(pages.length > 0);
      } catch (error) {
        stage.remove();
        // Never hide the original because pagination failed: a continuous sheet
        // is still printable, an empty preview is not.
        console.warn("[A4Pager] pagination failed; keeping the continuous sheet", error);
        source.classList.remove("esh-paginated-source");
      }
    };

    const start = () => {
      if (document.fonts?.ready) {
        document.fonts.ready.then(() => { if (!cancelled) render(); }).catch(render);
      } else {
        render();
      }
    };
    const timer = window.setTimeout(start, 60);

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => { if (!cancelled) render(); }, 250);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      source.classList.remove("esh-paginated-source");
    };
  }, [targetId]);

  return <div ref={hostRef} className={`esh-a4-pages ${className ?? ""}`.trim()} data-paginated={ready ? "true" : "false"} />;
}
