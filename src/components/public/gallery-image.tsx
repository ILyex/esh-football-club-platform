"use client";

import { SafeImage } from "@/components/shared/safe-image";

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
  return (
    <SafeImage
      src={src}
      fallbackSrc={fallbackSrc}
      alt={alt}
      className={className}
    />
  );
}
