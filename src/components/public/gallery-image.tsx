"use client";

import { useState } from "react";

interface GalleryImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackSrc?: string;
}

export function GalleryImage({
  src,
  alt,
  className,
  fallbackSrc = "/branding/esh-logo-256.png"
}: GalleryImageProps) {
  const [imageSrc, setImageSrc] = useState(src);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      onError={() => {
        if (imageSrc !== fallbackSrc) setImageSrc(fallbackSrc);
      }}
    />
  );
}
