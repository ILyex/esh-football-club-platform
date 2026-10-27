"use client";

import { useMemo, useState } from "react";
import { GalleryImage } from "@/components/public/gallery-image";
import { GalleryVideoModal } from "@/components/public/gallery-video-modal";
import { PublicPhotoLightbox, type PublicPhotoLightboxItem } from "@/components/public/public-photo-lightbox";
import { isVideoUrl } from "@/lib/media-utils";

export function PublicGalleryPhotoGrid({
  photos,
  lightboxPhotos = photos,
  locale,
  albumName
}: {
  photos: PublicPhotoLightboxItem[];
  lightboxPhotos?: PublicPhotoLightboxItem[];
  locale: string;
  albumName: string;
}) {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const imagePhotos = useMemo(() => lightboxPhotos.filter((photo) => !isVideoUrl(photo.url)), [lightboxPhotos]);
  const imageIndexById = useMemo(
    () => new Map<string, number>(imagePhotos.map((photo, index): [string, number] => [photo.id, index])),
    [imagePhotos]
  );

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        {photos.map((photo) => {
          const isVideo = isVideoUrl(photo.url);
          return (
            <div
              key={photo.id}
              className="group flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-all hover:border-club-primary/50 hover:shadow-md sm:rounded-2xl"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/90 sm:min-h-[180px]">
                {isVideo ? (
                  <GalleryVideoModal src={photo.url} title={photo.caption || albumName} locale={locale} />
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedImage(imageIndexById.get(photo.id) ?? 0)}
                    aria-label={locale === "ar" ? `فتح الصورة ${photo.caption || albumName}` : `Ouvrir la photo ${photo.caption || albumName}`}
                    className="absolute inset-0 block h-full w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-club-primary"
                  >
                    <GalleryImage
                      src={photo.url}
                      alt={photo.caption || albumName}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </button>
                )}
              </div>
              {photo.caption && (
                <div className="border-t border-border/60 bg-card p-2.5 sm:p-3">
                  <p className="line-clamp-2 text-xs text-muted-foreground">{photo.caption}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {selectedImage !== null && (
        <PublicPhotoLightbox
          photos={imagePhotos}
          initialIndex={selectedImage}
          locale={locale}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </>
  );
}
