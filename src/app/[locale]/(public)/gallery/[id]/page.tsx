import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Image as ImageIcon, Calendar, ChevronRight, ChevronLeft } from "lucide-react";
import { getPublicAlbumDetail } from "@/lib/public/gallery";
import { PublicGalleryPhotoGrid } from "@/components/public/public-gallery-photo-grid";
import { frenchPublicText } from "@/lib/public/locale-text";
import { PublicPageHeading } from "@/components/public/public-page-heading";

export default async function PublicAlbumDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, id } = await params;
  const sp = await searchParams;
  const isRtl = locale === "ar";

  const [tPublic, album] = await Promise.all([
    getTranslations({ locale, namespace: "publicSite" }),
    getPublicAlbumDetail(id)
  ]);

  if (!album) {
    notFound();
  }
  const albumName = locale === "ar" ? album.name : frenchPublicText(album.name, "Album photo");
  const albumDescription = locale === "ar" ? album.description : frenchPublicText(album.description, "");
  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(album.photoCount / pageSize));
  const requestedPage = Number.parseInt(sp.page || "1", 10);
  const currentPage = Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), totalPages) : 1;
  const pagePhotos = album.photos.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageHref = (page: number) => `/${locale}/gallery/${id}?page=${page}`;

  const formattedDate = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(album.createdAt);

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-8">
      <PublicPageHeading
        locale={locale}
        backHref={`/${locale}/gallery`}
        backLabel={locale === "ar" ? "العودة إلى المعرض" : "Retour à la galerie"}
        icon={<ImageIcon />}
        eyebrow={locale === "ar" ? "تفاصيل المعرض" : "Détails de la galerie"}
        title={albumName}
        description={albumDescription}
        trailing={(
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 text-club-primary" aria-hidden="true" />
              <span>{formattedDate}</span>
            </span>
            <span className="rounded-full border border-club-primary/20 bg-club-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-club-primary">
              {album.photoCount} {locale === "ar" ? "صورة" : "photos"}
            </span>
          </>
        )}
      />

      {/* Photos & Videos Grid */}
      <div className="mt-5 sm:mt-8">
        {pagePhotos.length > 0 ? (
          <PublicGalleryPhotoGrid
            locale={locale}
            albumName={albumName}
            photos={pagePhotos.map((photo) => ({
              id: photo.id,
              url: photo.url,
              caption: locale === "ar" ? photo.caption : frenchPublicText(photo.caption, "")
            }))}
            lightboxPhotos={album.photos.map((photo) => ({
              id: photo.id,
              url: photo.url,
              caption: locale === "ar" ? photo.caption : frenchPublicText(photo.caption, "")
            }))}
          />
        ) : (
          <div className="flex h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">
              {tPublic("gallery.emptyAlbum")}
            </p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <nav aria-label={isRtl ? "صفحات الألبوم" : "Pages de l’album"} className="mt-8 flex flex-wrap items-center justify-center gap-2 border-t border-border/80 pt-6">
          <Link
            href={pageHref(Math.max(1, currentPage - 1))}
            aria-disabled={currentPage === 1}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-colors ${currentPage === 1 ? "pointer-events-none border-border/50 text-muted-foreground/40" : "border-border bg-card text-foreground hover:border-club-primary/50 hover:text-club-primary"}`}
          >
            {isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {isRtl ? "السابق" : "Précédent"}
          </Link>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
              <Link
                key={page}
                href={pageHref(page)}
                aria-current={page === currentPage ? "page" : undefined}
                className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-xs font-bold transition-colors ${page === currentPage ? "border-club-primary bg-club-primary text-white" : "border-border bg-card text-muted-foreground hover:border-club-primary/50 hover:text-club-primary"}`}
              >
                {page}
              </Link>
            ))}
          </div>
          <Link
            href={pageHref(Math.min(totalPages, currentPage + 1))}
            aria-disabled={currentPage === totalPages}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-colors ${currentPage === totalPages ? "pointer-events-none border-border/50 text-muted-foreground/40" : "border-border bg-card text-foreground hover:border-club-primary/50 hover:text-club-primary"}`}
          >
            {isRtl ? "التالي" : "Suivant"}
            {isRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Link>
        </nav>
      )}

    </div>
  );
}
