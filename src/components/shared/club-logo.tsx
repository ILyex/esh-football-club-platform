import type { ImgHTMLAttributes } from "react";
import { SafeImage } from "@/components/shared/safe-image";

type ClubLogoProps = ImgHTMLAttributes<HTMLImageElement> & {
  fallbackSrc: string;
};

/** Always show the supplied static club crest; theme changes must not alter its appearance. */
export function ClubLogo({ fallbackSrc, src, onError, ...props }: ClubLogoProps) {
  return <SafeImage {...props} src={src} fallbackSrc={fallbackSrc} onError={onError} />;
}
