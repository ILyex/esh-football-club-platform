"use client";

import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { SafeImage } from "@/components/shared/safe-image";

type ClubLogoProps = ImgHTMLAttributes<HTMLImageElement> & {
  fallbackSrc: string;
  animated?: boolean;
};

const DEFAULT_CREST = /^\/branding\/esh-logo(?:-(?:32|64|128|256))?\.png$/;

/** Keep the crest static by default; only explicitly selected dark brand surfaces animate it. */
export function ClubLogo({ fallbackSrc, src, animated = false, onError, ...props }: ClubLogoProps) {
  const [canAnimate, setCanAnimate] = useState(false);
  const logoPath = typeof src === "string" ? src.split(/[?#]/, 1)[0] ?? "" : "";

  useEffect(() => {
    if (!animated || !DEFAULT_CREST.test(logoPath)) return;

    const root = document.documentElement;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setCanAnimate(root.classList.contains("dark") && !motionPreference.matches);
    const themeObserver = new MutationObserver(update);

    themeObserver.observe(root, { attributes: true, attributeFilter: ["class"] });
    motionPreference.addEventListener("change", update);
    update();

    return () => {
      themeObserver.disconnect();
      motionPreference.removeEventListener("change", update);
    };
  }, [animated, logoPath]);

  if (animated && DEFAULT_CREST.test(logoPath) && canAnimate) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Preserve animated WebP and alpha.
      <img
        {...props}
        src="/branding/esh-logo-animation-128.webp"
        alt={props.alt ?? "ESH"}
        draggable={false}
        onError={(event) => {
          setCanAnimate(false);
          onError?.(event);
        }}
      />
    );
  }

  return <SafeImage {...props} src={src} fallbackSrc={fallbackSrc} onError={onError} />;
}
