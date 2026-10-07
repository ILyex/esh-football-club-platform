"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Image as ImageIcon,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  ArrowLeft
} from "lucide-react";
import { frenchPublicText } from "@/lib/public/locale-text";

export interface ClubPhotoItem {
  id: string;
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

  if (orderedPhotos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-border bg-card">
        <ImageIcon className="h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-xs text-muted-foreground">
          {isAr ? "لا توجد صور متاحة حالياً" : "Aucune photo disponible"}
        </p>
      </div>
    );
  }

  const currentPhoto = orderedPhotos[currentIndex]!;
  const photoCaption = isAr ? currentPhoto.caption : frenchPublicText(currentPhoto.caption, "Photo du club");
  const albumName = isAr ? currentPhoto.albumName : frenchPublicText(currentPhoto.albumName, "");

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-xs flex flex-col justify-between group">
      {/* Top Header */}
      <div className="p-5 pb-3 flex items-center justify-between border-b border-border/60">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-club-primary" />
          <h3 className="text-sm font-bold text-foreground">
            {isAr ? "معرض النادي" : "Galerie du Club"}
          </h3>
        </div>

        <Link
          href={`/${locale}/gallery`}
          className="text-xs font-semibold text-muted-foreground hover:text-club-primary transition-colors flex items-center gap-1"
        >
          <span>{isAr ? "جميع الصور" : "Voir tout"}</span>
          <Arrow className="h-3 w-3" />
        </Link>
      </div>

      {/* Main Carousel Stage - Strict Fixed Height (Prevent size jumps) */}
      <div className="relative h-[320px] sm:h-[380px] w-full overflow-hidden bg-black shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={currentPhoto.id}
          src={currentPhoto.url}
          alt={photoCaption || (isAr ? "صورة من النادي" : "Photo du club")}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover object-center transition-all duration-700 ease-out scale-100 group-hover:scale-105 animate-in fade-in zoom-in-95"
        />

        {/* Ambient Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent pointer-events-none" />

        {/* Caption & Album Title Overlay */}
        <div className="absolute bottom-0 inset-x-0 p-4 sm:p-5 text-white z-10 flex flex-col justify-end">
          {albumName && (
            <span className="inline-block rounded-md bg-club-primary/80 backdrop-blur-xs px-2 py-0.5 text-[10px] font-black uppercase tracking-wider mb-1.5 w-fit">
              {albumName}
            </span>
          )}
          <p className="text-xs sm:text-sm font-bold text-white drop-shadow-md line-clamp-2 leading-relaxed">
            {photoCaption || (isAr ? "الجمعية الرياضية أمل سيدي حسني لكرة القدم" : "Association Sportive Espoir Sidi Hosni de Football")}
          </p>
        </div>

        {/* Navigation Arrows */}
        <button
          type="button"
          onClick={() =>
            setCurrentIndex((prev) => (prev === 0 ? orderedPhotos.length - 1 : prev - 1))
          }
          className="absolute start-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md border border-white/20 hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100 cursor-pointer shadow-md"
          aria-label={isAr ? "الصورة السابقة" : "Image précédente"}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() =>
            setCurrentIndex((prev) => (prev + 1) % orderedPhotos.length)
          }
          className="absolute end-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md border border-white/20 hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100 cursor-pointer shadow-md"
          aria-label={isAr ? "الصورة التالية" : "Image suivante"}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Indicator Dots & Counter Footer */}
      <div className="p-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground bg-card">
        <span className="font-mono text-[11px] font-bold text-foreground">
          {currentIndex + 1} / {orderedPhotos.length}
        </span>

        {/* Dot Indicators */}
        <div className="flex items-center gap-1.5">
          {orderedPhotos.slice(0, 7).map((ph, idx) => (
            <button
              key={ph.id}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                currentIndex === idx
                  ? "w-5 bg-club-primary"
                  : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"
              }`}
              aria-label={isAr ? `انتقل إلى الصورة ${idx + 1}` : `Aller à l’image ${idx + 1}`}
            />
          ))}
        </div>

        <Link
          href={`/${locale}/gallery`}
          className="text-[11px] font-semibold text-club-primary hover:underline"
        >
          {isAr ? "تصفح الألبومات" : "Albums"}
        </Link>
      </div>
    </div>
  );
}
