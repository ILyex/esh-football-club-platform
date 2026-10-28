"use client";

import { useEffect, useRef, useState } from "react";
import {
  Image as ImageIcon,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  ArrowLeft
} from "lucide-react";
import { frenchPublicText } from "@/lib/public/locale-text";
import { isVideoUrl } from "@/lib/media-utils";
import { useSwipeCarousel } from "@/hooks/use-swipe-carousel";

export interface ClubPhotoItem {
  id: string;
  albumId?: string | null;
  url: string;
  caption: string | null;
  albumName?: string | null;
}

interface ClubPhotosCarouselProps {
  photos: ClubPhotoItem[];
  locale?: string;
}

export function ClubPhotosCarousel({ photos, locale = "ar" }: ClubPhotosCarouselProps) {
  const isAr = locale === "ar";
  const Arrow = isAr ? ArrowLeft : ArrowRight;

  // The server supplies the newest items in stable order. Keeping that order
  // avoids random server/client markup and limits how much image data ships.
  const orderedPhotos = photos.slice(0, 8);

  const [currentIndex, setCurrentIndex] = useState(0);
  const lastWheelNavigation = useRef(0);
  useEffect(() => {
    setCurrentIndex((index) => Math.min(index, Math.max(orderedPhotos.length - 1, 0)));
  }, [orderedPhotos.length]);
  const swipe = useSwipeCarousel(
    () => setCurrentIndex((prev) => (prev + 1) % orderedPhotos.length),
    () => setCurrentIndex((prev) => (prev === 0 ? orderedPhotos.length - 1 : prev - 1))
  );

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    // Trackpad horizontal scrolling and Shift + mouse wheel navigate photos.
    // Plain vertical wheel input stays native so the page never gets trapped.
    const horizontalDelta = event.shiftKey
      ? event.deltaY
      : Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : 0;
    if (Math.abs(horizontalDelta) < 24) return;

    if (event.shiftKey) event.preventDefault();
    const now = performance.now();
    if (now - lastWheelNavigation.current < 320) return;
    lastWheelNavigation.current = now;

    if (horizontalDelta < 0) {
      setCurrentIndex((prev) => (prev + 1) % orderedPhotos.length);
    } else {
      setCurrentIndex((prev) => (prev === 0 ? orderedPhotos.length - 1 : prev - 1));
    }
  };

  if (orderedPhotos.length === 0) {
    return (
      <div className="relative flex h-full min-h-[330px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs lg:min-h-[348px]">
        <div className="flex items-center justify-between border-b border-border/60 p-4 pb-3 sm:p-6 sm:pb-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-club-primary" />
            <h3 className="text-sm font-bold text-foreground">
              {isAr ? "معرض النادي" : "Galerie du Club"}
            </h3>
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center border-y border-dashed border-border/70 bg-muted/10 p-8 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-background text-muted-foreground/50">
            <ImageIcon className="h-7 w-7" />
          </div>
          <p className="text-xs font-medium text-muted-foreground">
            {isAr ? "لا توجد ميديا حاليا" : "Aucun média disponible"}
          </p>
        </div>
        <div className="flex min-h-[82px] items-start border-t border-border/60 px-3 pb-0 pt-4 text-xs text-muted-foreground">
          <a href={`/${locale}/gallery`} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-club-primary/20 bg-club-primary/10 px-3 text-[11px] font-bold text-club-primary transition-colors hover:bg-club-primary hover:text-white">
            <span>{isAr ? "الألبومات" : "Albums"}</span>
            <Arrow className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    );
  }

  const safeIndex = Math.min(currentIndex, orderedPhotos.length - 1);
  // Keep the footer compact on narrow cards. The arrow buttons still let
  // visitors reach every image when the carousel contains many photos.
  const visibleDotCount = Math.min(5, orderedPhotos.length);
  const firstVisibleDot = Math.max(
    0,
    Math.min(
      safeIndex - Math.floor(visibleDotCount / 2),
      orderedPhotos.length - visibleDotCount
    )
  );
  const currentPhoto = orderedPhotos[safeIndex]!;
  const photoCaption = isAr ? currentPhoto.caption : frenchPublicText(currentPhoto.caption, "Photo du club");
  const albumName = isAr ? currentPhoto.albumName : frenchPublicText(currentPhoto.albumName, "");
  const albumHref = currentPhoto.albumId
    ? `/${locale}/gallery/${encodeURIComponent(currentPhoto.albumId)}`
    : `/${locale}/gallery`;

  return (
    <>
    <div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card shadow-xs lg:min-h-[348px]">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border/60 p-4 pb-3 sm:p-6 sm:pb-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-club-primary" />
          <h3 className="text-sm font-bold text-foreground">
            {isAr ? "معرض النادي" : "Galerie du Club"}
          </h3>
        </div>

      </div>

      {/* Main Carousel Stage - Strict Fixed Height (Prevent size jumps) */}
      <div className="relative h-[clamp(250px,50svh,360px)] w-full shrink-0 select-none overflow-hidden bg-black touch-pan-y sm:h-[380px]" {...swipe} onWheel={handleWheel}>
        <a
          href={albumHref}
          aria-label={isAr ? "فتح الألبوم" : "Ouvrir l’album"}
          className="absolute inset-0 z-0 block h-full w-full cursor-pointer text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-club-primary"
        >
          {isVideoUrl(currentPhoto.url) ? (
            <video
              src={currentPhoto.url}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              controlsList="nodownload noremoteplayback"
              disableRemotePlayback
              draggable={false}
              onContextMenu={(event) => event.preventDefault()}
              aria-hidden="true"
              className="pointer-events-none h-full w-full object-cover object-center transition-transform duration-300 ease-out group-hover:scale-[1.02]"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentPhoto.url}
              alt={photoCaption || (isAr ? "صورة من النادي" : "Photo du club")}
              draggable={false}
              loading="eager"
              decoding="async"
              className="h-full w-full object-cover object-center transition-transform duration-300 ease-out group-hover:scale-[1.02]"
            />
          )}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end p-4 text-white sm:p-5">
            {albumName && (
              <span className="mb-1.5 inline-block w-fit rounded-md bg-club-primary/80 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider backdrop-blur-xs">
                {albumName}
              </span>
            )}
            <p className="line-clamp-2 text-xs font-bold leading-relaxed text-white drop-shadow-md sm:text-sm">
              {photoCaption || (isAr ? "الجمعية الرياضية أمل سيدي حسني لكرة القدم" : "Association Sportive Espoir Sidi Hosni de Football")}
            </p>
          </div>
        </a>

        {/* Navigation Arrows */}
        <button
          type="button"
          onClick={() =>
            setCurrentIndex((prev) => (prev === 0 ? orderedPhotos.length - 1 : prev - 1))
          }
          title={isAr ? "الصورة السابقة" : "Image précédente"}
          className="absolute start-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white shadow-md transition-colors hover:bg-black/90"
          aria-label={isAr ? "الصورة السابقة" : "Image précédente"}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() =>
            setCurrentIndex((prev) => (prev + 1) % orderedPhotos.length)
          }
          title={isAr ? "الصورة التالية" : "Image suivante"}
          className="absolute end-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white shadow-md transition-colors hover:bg-black/90"
          aria-label={isAr ? "الصورة التالية" : "Image suivante"}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Indicator Dots & Counter Footer */}
      <div className="flex min-h-[72px] w-full min-w-0 items-center justify-between gap-2 border-t border-border/60 bg-card px-3 py-3 text-xs text-muted-foreground">
        <span className="shrink-0 whitespace-nowrap font-mono text-[11px] font-bold tabular-nums text-foreground" aria-live="polite">
          {safeIndex + 1} / {orderedPhotos.length}
        </span>

        {/* Dot Indicators */}
        <div className="flex min-w-0 flex-1 items-center justify-center overflow-hidden">
          {orderedPhotos.slice(firstVisibleDot, firstVisibleDot + visibleDotCount).map((ph, visibleIdx) => {
            const idx = firstVisibleDot + visibleIdx;
            return (
            <button
              key={ph.id}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary/40"
              aria-label={isAr ? `انتقل إلى الصورة ${idx + 1}` : `Aller à l’image ${idx + 1}`}
              aria-current={safeIndex === idx ? "true" : undefined}
            >
              <span className={`block h-1.5 rounded-full transition-all ${
                safeIndex === idx
                  ? "w-4 bg-club-primary"
                  : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"
              }`} />
            </button>
            );
          })}
        </div>

        <a href={`/${locale}/gallery`} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-club-primary/20 bg-club-primary/10 px-2.5 text-[11px] font-bold text-club-primary transition-colors hover:bg-club-primary hover:text-white sm:gap-2 sm:px-3">
          <span>{isAr ? "الألبومات" : "Albums"}</span>
          <Arrow className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
    </div>
    </>
  );
}
