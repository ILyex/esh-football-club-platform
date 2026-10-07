"use client";

import { useEffect, useState, type ImgHTMLAttributes } from "react";

type SafeImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  fallbackSrc: string;
};

/**
 * Prevent a stale or unavailable uploaded image from showing the browser's
 * broken-image icon. The fallback is local and bundled with every release.
 */
export function SafeImage({ fallbackSrc, src, alt = "", onError, ...props }: SafeImageProps) {
  const normalizedSrc = typeof src === "string" && (
    src.startsWith("data:image/") ||
    src.startsWith("/") ||
    /^https?:\/\//i.test(src)
  ) ? src : undefined;
  const [imageSrc, setImageSrc] = useState<string | undefined>(normalizedSrc);

  // Server data can change after a settings/profile update without remounting
  // the header. Keep the displayed source in sync and avoid retaining a
  // previously failed or unrelated image URL.
  useEffect(() => {
    setImageSrc(normalizedSrc);
  }, [normalizedSrc]);

  return (
    <img
      {...props}
      src={imageSrc || fallbackSrc}
      alt={alt}
      draggable={false}
      data-protected-image="true"
      onError={(event) => {
        if (imageSrc !== fallbackSrc) setImageSrc(fallbackSrc);
        onError?.(event);
      }}
    />
  );
}
