import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Image as ImageIcon, Calendar, Play, Video } from "lucide-react";
import { getPublicAlbums } from "@/lib/public/gallery";
import { isVideoUrl } from "@/lib/media-utils";
import { GalleryImage } from "@/components/public/gallery-image";
import { frenchPublicText } from "@/lib/public/locale-text";
import { PublicPageHeading } from "@/components/public/public-page-heading";
import { SocialReelsSection } from "@/components/public/social-reels-section";
import { getPublicClubSettings } from "@/lib/public/club";

export default async function PublicGalleryPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [tPublic, albums, club] = await Promise.all([
    getTranslations({ locale, namespace: "publicSite" }),
    getPublicAlbums(),
    getPublicClubSettings()
  ]);

  return (
    <div className="mx-auto max-w-7xl px-3 py-7 sm:px-6 sm:py-12">
      <PublicPageHeading locale={locale} icon={<ImageIcon />} eyebrow={tPublic("gallery.title")} title={tPublic("gallery.title")} description={tPublic("gallery.subtitle")} />

      {club.socialReels.length > 0 && (
        <div className="mt-6 sm:mt-8">
          <SocialReelsSection reels={club.socialReels} locale={locale} />
        </div>
      )}

      {/* Albums Grid */}
      <div className={`${club.socialReels.length > 0 ? "mt-8 sm:mt-10" : "mt-5 sm:mt-8"}`}>
        {albums.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
            {albums.map((album) => {
              const albumName = locale === "ar" ? album.name : frenchPublicText(album.name, "Album photo");
              const albumDescription = locale === "ar" ? album.description : frenchPublicText(album.description, "");
              const formattedDate = new Intl.DateTimeFormat(locale, {
                day: "numeric",
                month: "short",
                year: "numeric"
              }).format(album.createdAt);

              return (
                <Link
                  key={album.id}
                  href={`/${locale}/gallery/${album.id}`}
                  className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-all hover:-translate-y-1 hover:border-club-primary/50 hover:shadow-md sm:rounded-2xl"
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted/60 sm:min-h-[180px]">
                    {album.coverImageUrl ? (
                      isVideoUrl(album.coverImageUrl) ? (
                        <div className="relative h-full w-full bg-black/90 flex items-center justify-center">
                          <video src={album.coverImageUrl} className="h-full w-full object-cover" preload="metadata" muted controlsList="nodownload noremoteplayback" disableRemotePlayback draggable={false} />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-club-primary/90 text-white shadow-lg group-hover:scale-110 transition-transform">
                              <Play className="h-6 w-6 fill-white" />
                            </span>
                          </div>
                        </div>
                      ) : (
                        <GalleryImage
                          src={album.coverImageUrl}
                          alt={albumName}
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

                  <div className="flex flex-1 flex-col justify-between p-3 sm:p-5">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{formattedDate}</span>
                      </div>

                      <h2 className="mt-2 text-lg font-bold text-foreground transition-colors group-hover:text-club-primary">
                        {albumName}
                      </h2>

                      {albumDescription && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {albumDescription}
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
