import Link from "next/link";
import { Calendar, Newspaper, Play } from "lucide-react";
import { PublicNewsItem } from "@/lib/public/news";
import { isVideoUrl } from "@/lib/media-utils";
import { SafeImage } from "@/components/shared/safe-image";

interface NewsCardProps {
  article: PublicNewsItem;
  locale: string;
  readMoreLabel: string;
}

export function NewsCard({ article, locale, readMoreLabel }: NewsCardProps) {
  // Use the immutable id for card links. It avoids URL normalization issues
  // with Arabic or legacy slugs; the detail endpoint still supports slugs.
  const articleHref = `/${locale}/news/${encodeURIComponent(article.id)}`;
  const formattedDate = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(article.publishedAt);

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xs transition-all hover:-translate-y-1 hover:border-club-primary/40 hover:shadow-md sm:rounded-xl">
      {/* Cover Image / Video Area */}
      <Link href={articleHref} className="relative aspect-[4/3] w-full overflow-hidden bg-muted/50 sm:aspect-16/9">
        {article.featuredImageUrl ? (
          isVideoUrl(article.featuredImageUrl) ? (
            <div className="relative h-full w-full bg-black flex items-center justify-center">
              <video src={article.featuredImageUrl} className="h-full w-full object-cover" preload="metadata" muted controlsList="nodownload noremoteplayback" disableRemotePlayback draggable={false} onContextMenu={(event) => event.preventDefault()} />
              <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/10 transition-colors">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-club-primary text-white shadow-lg transition-transform group-hover:scale-110 sm:h-10 sm:w-10">
                  <Play className="h-4 w-4 translate-x-0.5 fill-white sm:h-5 sm:w-5" />
                </span>
              </div>
            </div>
          ) : (
            <SafeImage
              src={article.featuredImageUrl}
              fallbackSrc="/branding/esh-logo-128.png"
              alt={article.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted/40 text-muted-foreground/30">
            <Newspaper className="h-12 w-12" />
          </div>
        )}

        {article.category && (
          <div className="absolute top-3 start-3">
            <span className="max-w-[90%] truncate rounded-md bg-card/90 px-2 py-1 text-[9px] font-bold text-foreground shadow-xs backdrop-blur-xs sm:px-2.5 sm:text-[11px] sm:uppercase sm:tracking-wider">
              {article.category}
            </span>
          </div>
        )}
      </Link>

      {/* Text Content */}
      <div className="flex flex-1 flex-col justify-between p-3 sm:p-5">
        <div>
          <div className="mb-1.5 flex items-center gap-1 text-[10px] text-muted-foreground sm:mb-2 sm:gap-1.5 sm:text-xs">
            <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <time dateTime={article.publishedAt.toISOString()}>{formattedDate}</time>
          </div>

          <Link href={articleHref}>
            <h3 className="line-clamp-3 text-sm font-bold leading-snug text-foreground transition-colors group-hover:text-club-primary sm:line-clamp-2 sm:text-lg">
              {article.title}
            </h3>
          </Link>

          <p className="mt-2 hidden line-clamp-3 text-sm leading-relaxed text-muted-foreground sm:block">
            {article.excerpt}
          </p>
        </div>

        <div className="mt-3 border-t border-border/60 pt-2.5 sm:mt-4 sm:pt-3">
          <Link
            href={articleHref}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-club-primary group-hover:underline sm:text-xs"
          >
            <span>{readMoreLabel}</span>
            <span>{locale === "ar" ? "←" : "→"}</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
