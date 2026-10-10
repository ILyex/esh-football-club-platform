"use client";

import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { SafeImage } from "@/components/shared/safe-image";

type ClubLogoProps = ImgHTMLAttributes<HTMLImageElement> & {
  fallbackSrc: string;
  animated?: boolean;
};

const STATIC_LOGO_PATH = /^\/branding\/esh-logo(?:-(?:32|64|128|256))?\.png$/;

/**
 * Uses the transparent animated crest on dark surfaces, then relies on the
 * animated WebP's final frame. Custom uploaded club logos remain untouched.
 */
export function ClubLogo({ fallbackSrc, src, animated = true, onError, ...props }: ClubLogoProps) {
  const [isDark, setIsDark] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [animationFailed, setAnimationFailed] = useState(false);
  const source = typeof src === "string" ? src.split(/[?#]/, 1)[0] ?? "" : "";
  const canAnimate = animated && STATIC_LOGO_PATH.test(source);

  useEffect(() => {
    const root = document.documentElement;
    const updateTheme = () => setIsDark(root.classList.contains("dark"));
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setReducedMotion(motionPreference.matches);
    const observer = new MutationObserver(updateTheme);

    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    motionPreference.addEventListener("change", updateMotionPreference);
    updateTheme();
    updateMotionPreference();

    return () => {
      observer.disconnect();
      motionPreference.removeEventListener("change", updateMotionPreference);
    };
  }, []);

  if (canAnimate && isDark && !reducedMotion && !animationFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- animated WebP with alpha needs native animation support.
      <img
        {...props}
        src="/branding/esh-logo-animation.webp"
        alt={props.alt ?? "ESH"}
        draggable={false}
        onError={(event) => {
          setAnimationFailed(true);
          onError?.(event);
        }}
      />
    );
  }

  return <SafeImage {...props} src={src} fallbackSrc={fallbackSrc} onError={onError} />;
}
