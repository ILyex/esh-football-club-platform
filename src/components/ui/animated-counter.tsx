"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedCounterProps {
  value: number;
  locale?: string;
  duration?: number;
  className?: string;
}

/** Counts KPI values into view without changing the server-rendered layout. */
export function AnimatedCounter({ value, locale = "fr-FR", duration = 950, className }: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const previousValue = useRef(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const target = Number.isFinite(value) ? value : 0;
    const from = previousValue.current;
    const delta = target - from;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);

    if (delta === 0) {
      setDisplayValue(target);
      return;
    }

    const startedAt = performance.now();
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animationDuration = prefersReducedMotion ? 0 : Math.max(300, duration);

    const tick = (now: number) => {
      const progress = animationDuration === 0 ? 1 : Math.min(1, (now - startedAt) / animationDuration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = from + delta * eased;
      setDisplayValue(next);
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
      else {
        previousValue.current = target;
        frameRef.current = null;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [value, duration]);

  const formatted = new Intl.NumberFormat(locale === "ar" ? "ar-DZ" : "fr-FR", {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2
  }).format(displayValue);

  return <span className={className} aria-live="polite">{formatted}</span>;
}
