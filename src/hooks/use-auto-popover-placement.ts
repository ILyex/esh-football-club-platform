"use client";

import { useEffect, useState, type RefObject } from "react";

type Placement = { side: "top" | "bottom"; maxHeight: number };

export function useAutoPopoverPlacement<TAnchor extends HTMLElement, TPanel extends HTMLElement>(
  open: boolean,
  anchorRef: RefObject<TAnchor | null>,
  panelRef: RefObject<TPanel | null>,
  maxPanelHeight = 320
) {
  const [placement, setPlacement] = useState<Placement>({ side: "bottom", maxHeight: maxPanelHeight });

  useEffect(() => {
    if (!open) return;

    let frame = 0;
    const updatePlacement = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const anchor = anchorRef.current;
        if (!anchor) return;
        const rect = anchor.getBoundingClientRect();
        const gap = 8;
        const viewportPadding = 8;
        const availableAbove = Math.max(0, rect.top - gap - viewportPadding);
        const availableBelow = Math.max(0, window.innerHeight - rect.bottom - gap - viewportPadding);
        const measuredHeight = panelRef.current?.scrollHeight ?? maxPanelHeight;
        const requiredHeight = Math.min(measuredHeight, maxPanelHeight);
        const side = availableBelow < requiredHeight && availableAbove > availableBelow ? "top" : "bottom";
        const available = side === "top" ? availableAbove : availableBelow;
        // Never force a minimum taller than the space available: that was
        // making several mobile menus spill over nearby fields and each other.
        setPlacement({ side, maxHeight: Math.max(0, Math.min(maxPanelHeight, available)) });
      });
    };

    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [open, anchorRef, panelRef, maxPanelHeight]);

  return placement;
}

export function popoverPlacementStyle(placement: Placement, gap = "0.5rem") {
  return {
    top: placement.side === "bottom" ? `calc(100% + ${gap})` : "auto",
    bottom: placement.side === "top" ? `calc(100% + ${gap})` : "auto",
    maxHeight: placement.maxHeight
  };
}
