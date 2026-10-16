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

  if (src && failedSrc !== src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={className}
        referrerPolicy="no-referrer"
        onError={() => setFailedSrc(src)}
      />
    );
  }

  return <Shield className={iconClassName} role="img" aria-label={alt || undefined} aria-hidden={alt ? undefined : true} />;
}
