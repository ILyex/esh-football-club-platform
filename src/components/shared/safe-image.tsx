"use client";

import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { normalizePublicMediaUrl } from "@/lib/media-utils";

type SafeImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  fallbackSrc: string;
};

/**
 * Prevent a stale or unavailable uploaded image from showing the browser's
 * broken-image icon. The fallback is local and bundled with every release.
 */
export function SafeImage({ fallbackSrc, src, alt = "", onError, ...props }: SafeImageProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const normalizedSrc = normalizePublicMediaUrl(typeof src === "string" ? src : null) ?? undefined;
  const [imageSrc, setImageSrc] = useState<string | undefined>(normalizedSrc);

  // Server data can change after a settings/profile update without remounting
  // the header. Keep the displayed source in sync and avoid retaining a
  // previously failed or unrelated image URL.
  useEffect(() => {
    setImageSrc(normalizedSrc);
    // An image can fail before React hydrates, so the browser's original error
    // event is missed. Detect that settled failure after mounting as well.
    const image = imageRef.current;
    const expectedSrc = normalizedSrc ? new URL(normalizedSrc, window.location.href).href : undefined;
    if (expectedSrc && image?.currentSrc === expectedSrc && image.complete && image.naturalWidth === 0) {
      setImageSrc(fallbackSrc);
    }
  }, [fallbackSrc, normalizedSrc]);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- requires legacy URL normalization and runtime fallback.
    <img
      // Below-the-fold media should never compete with the first paint. A caller
      // that renders a hero/LCP image passes loading="eager" and wins here.
      loading={props.loading ?? "lazy"}
      decoding={props.decoding ?? "async"}
      {...props}
      ref={imageRef}
      src={imageSrc || fallbackSrc}
      alt={alt}
      data-protected-image="true"
      onError={(event) => {
        if (imageSrc !== fallbackSrc) setImageSrc(fallbackSrc);
        onError?.(event);
      }}
    />
  );
}
