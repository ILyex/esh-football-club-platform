"use client";

import { useEffect, useRef, useState } from "react";
import { Shield } from "lucide-react";
import { normalizePublicMediaUrl } from "@/lib/media-utils";

interface OpponentCrestProps {
  src?: string | null;
  alt?: string;
  className?: string;
  iconClassName?: string;
}

/** Render an opponent crest safely when an old or migrated asset URL is stale. */
export function OpponentCrest({
  src,
  alt = "",
  className = "h-full w-full object-contain",
  iconClassName = "h-6 w-6 text-muted-foreground"
}: OpponentCrestProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  // Opponent logos can be stored as a public-storage key, a legacy absolute
  // URL, or a normal remote URL. Resolve all forms before rendering so an old
  // record does not produce a broken image on the public site.
  // Local upload previews use blob: URLs. Keep those untouched: the persisted
  // media normalizer intentionally accepts only URLs that can be stored/shared.
  const normalizedSrc = src?.startsWith("blob:") ? src : normalizePublicMediaUrl(src);

  // Cached/static images can finish before React hydrates and attaches onLoad.
  // In that case the browser reports complete but the component never receives
  // the event, leaving a valid crest hidden behind its fallback forever.
  useEffect(() => {
    const image = imageRef.current;
    if (!normalizedSrc || !image?.complete) return;
    if (image.naturalWidth > 0) setLoadedSrc(normalizedSrc);
    else setFailedSrc(normalizedSrc);
  }, [normalizedSrc]);

  const showImage = Boolean(normalizedSrc && failedSrc !== normalizedSrc && loadedSrc === normalizedSrc);

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${className.replace(/\b(object-contain|object-cover)\b/g, "")}`}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
    >
      <Shield className={`${iconClassName} ${showImage ? "invisible" : ""}`} aria-hidden="true" />
      {normalizedSrc && failedSrc !== normalizedSrc && (
        // Keep the fallback visible until the image has fully loaded. Empty alt
        // prevents browsers from rendering the opponent name as broken-image text.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imageRef}
          src={normalizedSrc}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-150 ${showImage ? "opacity-100" : "opacity-0"}`}
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          onLoad={() => setLoadedSrc(normalizedSrc)}
          onError={() => setFailedSrc(normalizedSrc)}
        />
      )}
    </span>
  );
}
