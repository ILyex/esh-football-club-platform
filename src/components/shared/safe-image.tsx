"use client";

import { useState, type ImgHTMLAttributes } from "react";

type SafeImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  fallbackSrc: string;
};

/**
 * Prevent a stale or unavailable uploaded image from showing the browser's
 * broken-image icon. The fallback is local and bundled with every release.
 */
export function SafeImage({ fallbackSrc, src, alt = "", onError, ...props }: SafeImageProps) {
  const [imageSrc, setImageSrc] = useState<string | undefined>(src?.toString());

  return (
    <img
      {...props}
      src={imageSrc || fallbackSrc}
      alt={alt}
      onError={(event) => {
        if (imageSrc !== fallbackSrc) setImageSrc(fallbackSrc);
        onError?.(event);
      }}
    />
  );
}
