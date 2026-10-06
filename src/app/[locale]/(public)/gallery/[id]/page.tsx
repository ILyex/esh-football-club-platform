import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Image as ImageIcon, Calendar, ChevronRight, ChevronLeft, ArrowRight, ArrowLeft } from "lucide-react";
import { getPublicAlbumDetail } from "@/lib/public/gallery";
import { ClubVideoPlayer } from "@/components/shared/club-video-player";
import { isVideoUrl } from "@/lib/media-utils";
import { GalleryImage } from "@/components/public/gallery-image";
import { frenchPublicText } from "@/lib/public/locale-text";

export default async function PublicAlbumDetailPage({
  params
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const isRtl = locale === "ar";
  const BreadcrumbChevron = isRtl ? ChevronLeft : ChevronRight;
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;

  const [tPublic, album] = await Promise.all([
    getTranslations({ locale, namespace: "publicSite" }),
    getPublicAlbumDetail(id)
  ]);

  if (!album) {
    notFound();
  }
  const albumName = locale === "ar" ? album.name : frenchPublicText(album.name, "Album photo");
  const albumDescription = locale === "ar" ? album.description : frenchPublicText(album.description, "");

  const formattedDate = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(album.createdAt);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      {/* Breadcrumbs */}
      <nav className="mb-8 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Link href={`/${locale}/gallery`} className="hover:text-club-primary transition-colors">
          {tPublic("gallery.title")}
        </Link>
        <BreadcrumbChevron className="h-3.5 w-3.5" />
        <span className="font-semibold text-foreground truncate max-w-xs">
          {albumName}
        </span>
      </nav>

      {/* Album Header */}
      <div className="border-b border-border/80 pb-8">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Calendar className="h-3.5 w-3.5" />
          <span>{formattedDate}</span>
          <span>•</span>
          <span className="font-semibold text-foreground">
            {album.photoCount} {locale === "ar" ? "صورة" : "photos"}
          </span>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
          {albumName}
        </h1>

        {albumDescription && (
          <p className="mt-2 text-sm text-muted-foreground sm:text-base max-w-3xl">
            {albumDescription}
          </p>
        )}
      </div>

      {/* Photos & Videos Grid */}
      <div className="mt-8">
        {album.photos.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {album.photos.map((photo) => {
              const isVideo = isVideoUrl(photo.url);
              return (
                <div
                  key={photo.id}
                  className="group overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-all hover:border-club-primary/50 hover:shadow-md flex flex-col justify-between"
                >
                  <div className="relative aspect-[4/3] min-h-[180px] w-full overflow-hidden bg-black/90">
                    {isVideo ? (
                      <ClubVideoPlayer
                        src={photo.url}
                        title={locale === "ar" ? (photo.caption || albumName) : frenchPublicText(photo.caption, albumName)}
                        aspectRatio="4/3"
                      />
                    ) : (
                      <GalleryImage
                        src={photo.url}
                        alt={locale === "ar" ? (photo.caption || albumName) : frenchPublicText(photo.caption, albumName)}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    )}
                  </div>
                  {(locale === "ar" ? photo.caption : frenchPublicText(photo.caption, "")) && (
                    <div className="p-3 bg-card border-t border-border/60">
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {locale === "ar" ? photo.caption : frenchPublicText(photo.caption, "")}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">
              {tPublic("gallery.emptyAlbum")}
            </p>
          </div>
        )}
      </div>

      {/* Back Link */}
      <div className="mt-12 border-t border-border/80 pt-8">
        <Link
          href={`/${locale}/gallery`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-club-primary hover:underline"
        >
          <BackArrow className="h-4 w-4" />
          <span>{tPublic("gallery.backToGallery")}</span>
        </Link>
      </div>
    </div>
  );
}
