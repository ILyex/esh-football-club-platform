import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Image as ImageIcon, Calendar, Play, Video } from "lucide-react";
import { getPublicAlbums } from "@/lib/public/gallery";
import { isVideoUrl } from "@/lib/media-utils";
import { GalleryImage } from "@/components/public/gallery-image";

export default async function PublicGalleryPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [tPublic, albums] = await Promise.all([
    getTranslations({ locale, namespace: "publicSite" }),
    getPublicAlbums()
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      {/* Header */}
      <div className="border-b border-border/80 pb-8">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-club-primary">
          <ImageIcon className="h-4 w-4" />
          {tPublic("gallery.title")}
        </span>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
          {tPublic("gallery.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base max-w-2xl">
          {tPublic("gallery.subtitle")}
        </p>
      </div>

      {/* Albums Grid */}
      <div className="mt-8">
        {albums.length > 0 ? (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {albums.map((album) => {
              const formattedDate = new Intl.DateTimeFormat(locale, {
                day: "numeric",
                month: "short",
                year: "numeric"
              }).format(album.createdAt);

              return (
                <Link
                  key={album.id}
                  href={`/${locale}/gallery/${album.id}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-all hover:-translate-y-1 hover:border-club-primary/50 hover:shadow-md"
                >
                  <div className="relative aspect-[16/10] min-h-[180px] w-full overflow-hidden bg-muted/60">
                    {album.coverImageUrl ? (
                      isVideoUrl(album.coverImageUrl) ? (
                        <div className="relative h-full w-full bg-black/90 flex items-center justify-center">
                          <video src={album.coverImageUrl} className="h-full w-full object-cover" preload="metadata" muted />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-club-primary/90 text-white shadow-lg group-hover:scale-110 transition-transform">
                              <Play className="h-6 w-6 fill-white" />
                            </span>
                          </div>
                        </div>
                      ) : (
                        <GalleryImage
                          src={album.coverImageUrl}
                          alt={album.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      )
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground/30">
                        <ImageIcon className="h-12 w-12" />
                      </div>
                    )}

                    <div className="absolute top-3 end-3 rounded-md bg-card/90 px-2.5 py-1 text-xs font-bold text-foreground shadow-xs backdrop-blur-xs flex items-center gap-1.5">
                      {album.samplePhotos.some((p) => isVideoUrl(p.url)) ? (
                        <Video className="h-3 w-3 text-sky-500" />
                      ) : (
                        <ImageIcon className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span>{album.photoCount} {locale === "ar" ? "وسائط" : "médias"}</span>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col justify-between p-5">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{formattedDate}</span>
                      </div>

                      <h2 className="mt-2 text-lg font-bold text-foreground transition-colors group-hover:text-club-primary">
                        {album.name}
                      </h2>

                      {album.description && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {album.description}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">
              {tPublic("gallery.noAlbums")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
