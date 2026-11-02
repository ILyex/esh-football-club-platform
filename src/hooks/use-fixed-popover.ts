"use client";

import { useEffect, useState, type CSSProperties, type RefObject } from "react";

export type FixedPopoverState = {
  ready: boolean;
  side: "top" | "bottom";
  style: CSSProperties;
};

/**
 * Anchors a dropdown panel to its trigger using viewport (fixed) coordinates.
 *
 * Why not absolute positioning: the panels used to live inside their trigger's
 * wrapper with `position: absolute`. Any ancestor with `overflow: hidden` — a
 * card, a table cell, a scroll area — then clipped the list, and the menu was
 * painted on top of the field it belonged to (the reported "dropdown cut off
 * and overlapping the input" bug).
 *
 * With fixed coordinates the list is positioned against the viewport, flipped
 * above the field when there is no room below, clamped inside the viewport on
 * both axes, and remains readable regardless of ancestor overflow.
 */
export function useFixedPopover<TAnchor extends HTMLElement, TPanel extends HTMLElement>(
  open: boolean,
  anchorRef: RefObject<TAnchor | null>,
  panelRef: RefObject<TPanel | null>,
  maxHeight = 320,
  gap = 6
): FixedPopoverState {
  const [state, setState] = useState<FixedPopoverState>({ ready: false, side: "bottom", style: {} });

  useEffect(() => {
    if (!open) {
      setState((current) => (current.ready ? { ...current, ready: false } : current));
      return;
    }

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const anchor = anchorRef.current;
        if (!anchor) return;
        const rect = anchor.getBoundingClientRect();
        const pad = 8;
        const panelContentHeight = panelRef.current?.scrollHeight ?? maxHeight;
        const wanted = Math.min(panelContentHeight, maxHeight);
        const spaceBelow = window.innerHeight - rect.bottom - gap - pad;
        const spaceAbove = rect.top - gap - pad;
        const side: "top" | "bottom" = spaceBelow >= wanted || spaceBelow >= spaceAbove ? "bottom" : "top";
        const available = Math.max(0, side === "bottom" ? spaceBelow : spaceAbove);
        const height = Math.max(96, Math.min(wanted, available));
        const width = Math.min(rect.width, window.innerWidth - pad * 2);
        const left = Math.min(Math.max(pad, rect.left), Math.max(pad, window.innerWidth - width - pad));
        const top = side === "bottom"
          ? rect.bottom + gap
          : Math.max(pad, rect.top - gap - Math.min(height, panelContentHeight));

        setState({
          ready: true,
          side,
          style: {
            position: "fixed",
            top: Math.round(top),
            left: Math.round(left),
            width: Math.round(width),
            maxHeight: Math.round(height),
            zIndex: 80
          }
        });
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(update);
      if (panelRef.current) observer.observe(panelRef.current);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      observer?.disconnect();
    };
  }, [open, anchorRef, panelRef, maxHeight, gap]);

  return state;
}
