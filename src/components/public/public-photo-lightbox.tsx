"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useSwipeCarousel } from "@/hooks/use-swipe-carousel";

export interface PublicPhotoLightboxItem {
  id: string;
  url: string;
  caption: string | null;
}

export function PublicPhotoLightbox({
  photos,
  initialIndex,
  locale,
  onClose
}: {
  photos: PublicPhotoLightboxItem[];
  initialIndex: number;
  locale: string;
  onClose: () => void;
}) {
  const isAr = locale === "ar";
  const [index, setIndex] = useState(() => Math.min(Math.max(initialIndex, 0), photos.length - 1));
  const photo = photos[index];
  const previous = () => setIndex((current) => (current === 0 ? photos.length - 1 : current - 1));
  const next = () => setIndex((current) => (current + 1) % photos.length);
  const swipe = useSwipeCarousel(next, previous);

  useEffect(() => {
    if (!photo) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight") setIndex((current) => isAr
        ? (current === 0 ? photos.length - 1 : current - 1)
        : (current + 1) % photos.length);
      else if (event.key === "ArrowLeft") setIndex((current) => isAr
        ? (current + 1) % photos.length
        : (current === 0 ? photos.length - 1 : current - 1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [photo, isAr, onClose, photos.length]);

  if (!photo || photos.length === 0) return null;

  const previousLabel = isAr ? "الصورة السابقة" : "Image précédente";
  const nextLabel = isAr ? "الصورة التالية" : "Image suivante";

  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center bg-black/95 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={isAr ? "عارض الصور" : "Visionneuse de photos"}
      onClick={onClose}
      {...swipe}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={isAr ? "إغلاق" : "Fermer"}
        className="absolute end-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:end-6 sm:top-6"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>

      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); previous(); }}
            aria-label={previousLabel}
            className="absolute start-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white transition-colors hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:start-6 sm:h-12 sm:w-12"
          >
            {isAr ? <ChevronRight className="h-6 w-6" /> : <ChevronLeft className="h-6 w-6" />}
          </button>
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); next(); }}
            aria-label={nextLabel}
            className="absolute end-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white transition-colors hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:end-6 sm:h-12 sm:w-12"
          >
            {isAr ? <ChevronLeft className="h-6 w-6" /> : <ChevronRight className="h-6 w-6" />}
          </button>
        </>
      )}

      <div className="flex h-full w-full max-w-6xl flex-col items-center justify-center gap-3" onClick={(event) => event.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={photo.id}
          src={photo.url}
          alt={photo.caption || (isAr ? "صورة من المعرض" : "Photo de la galerie")}
          draggable={false}
          className="max-h-[82dvh] max-w-full select-none rounded-xl object-contain shadow-2xl sm:rounded-2xl"
        />
        <div className="flex min-h-8 w-full items-center justify-center gap-3 text-center text-sm text-white/85" aria-live="polite">
          {photo.caption && <span className="max-w-[75vw] truncate">{photo.caption}</span>}
          {photos.length > 1 && <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 font-mono text-xs tabular-nums">{index + 1} / {photos.length}</span>}
        </div>
      </div>
    </div>
  );
}
