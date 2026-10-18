"use client";

import { useState } from "react";
import { Shield } from "lucide-react";

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
  const showImage = Boolean(src && failedSrc !== src && loadedSrc === src);

  return (
    <span
      className={`relative inline-flex h-full w-full shrink-0 items-center justify-center ${className.replace(/\b(object-contain|object-cover)\b/g, "")}`}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
    >
      <Shield className={`${iconClassName} ${showImage ? "invisible" : ""}`} aria-hidden="true" />
      {src && failedSrc !== src && (
        // Keep the fallback visible until the image has fully loaded. Empty alt
        // prevents browsers from rendering the opponent name as broken-image text.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-150 ${showImage ? "opacity-100" : "opacity-0"}`}
          referrerPolicy="no-referrer"
          onLoad={() => setLoadedSrc(src)}
          onError={() => setFailedSrc(src)}
        />
      )}
    </span>
  );
}
