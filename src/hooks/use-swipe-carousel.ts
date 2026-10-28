"use client";

import { useRef } from "react";

/** Adds horizontal touch navigation without blocking vertical page scrolling. */
export function useSwipeCarousel(onNext: () => void, onPrevious: () => void, threshold = 45) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const suppressSwipeClick = useRef(false);
  const suppressClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearClickSuppression = () => {
    suppressSwipeClick.current = false;
    if (suppressClickTimer.current) clearTimeout(suppressClickTimer.current);
    suppressClickTimer.current = null;
  };

  return {
    onTouchStart: (event: React.TouchEvent<HTMLElement>) => {
      clearClickSuppression();
      startX.current = event.touches[0]?.clientX ?? null;
      startY.current = event.touches[0]?.clientY ?? null;
    },
    onTouchEnd: (event: React.TouchEvent<HTMLElement>) => {
      if (startX.current == null || startY.current == null) return;
      const endX = event.changedTouches[0]?.clientX;
      const endY = event.changedTouches[0]?.clientY;
      const distance = endX == null ? 0 : endX - startX.current;
      const verticalDistance = endY == null ? 0 : endY - startY.current;
      startX.current = null;
      startY.current = null;
      // Let normal vertical scrolling win when the gesture is mostly vertical.
      if (Math.abs(verticalDistance) > Math.abs(distance)) return;
      if (Math.abs(distance) < threshold) return;
      suppressSwipeClick.current = true;
      suppressClickTimer.current = setTimeout(clearClickSuppression, 500);
      if (distance < 0) onNext();
      else onPrevious();
    },
    onClickCapture: (event: React.MouseEvent<HTMLElement>) => {
      if (!suppressSwipeClick.current) return;
      clearClickSuppression();
      event.preventDefault();
      event.stopPropagation();
    },
    onTouchCancel: () => {
      startX.current = null;
      startY.current = null;
      clearClickSuppression();
    },
    style: { touchAction: "pan-y" as const }
  };
}
