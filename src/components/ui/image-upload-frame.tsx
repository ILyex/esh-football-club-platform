import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ImageUploadFrameProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  density?: "compact" | "regular" | "spacious";
};

export const IMAGE_UPLOAD_FRAME = "group/image-upload relative flex min-w-0 items-center rounded-xl border border-dashed border-club-primary/35 bg-club-primary/[0.035] transition-colors hover:border-club-primary/65 hover:bg-club-primary/[0.07] focus-within:border-club-primary/70 focus-within:ring-2 focus-within:ring-club-primary/15";

/** Shared visual frame for image and media pickers; each page controls its own preview dimensions. */
export function ImageUploadFrame({ children, density = "regular", className, ...props }: ImageUploadFrameProps) {
  return (
    <div
      className={cn(
        IMAGE_UPLOAD_FRAME,
        density === "compact" && "min-h-12 gap-2 px-2.5 py-2",
        density === "regular" && "min-h-16 gap-3 px-3 py-2.5 sm:px-4",
        density === "spacious" && "min-h-32 flex-col justify-center gap-3 p-4 text-center sm:p-5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export const IMAGE_UPLOAD_PREVIEW = "flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-club-primary/15 bg-background text-club-primary";
export const IMAGE_UPLOAD_ICON = "flex shrink-0 items-center justify-center rounded-xl border border-club-primary/15 bg-club-primary/10 text-club-primary transition-colors group-hover/image-upload:bg-club-primary/15";
export const IMAGE_UPLOAD_ACTION = "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-club-primary px-3 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-club-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary/40 disabled:cursor-not-allowed disabled:opacity-60";
