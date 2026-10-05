import Link from "next/link";
import { Calendar, Newspaper, Play } from "lucide-react";
import { PublicNewsItem } from "@/lib/public/news";
import { isVideoUrl } from "@/lib/media-utils";

interface NewsCardProps {
  article: PublicNewsItem;
  locale: string;
  readMoreLabel: string;
}

export function NewsCard({ article, locale, readMoreLabel }: NewsCardProps) {
  const formattedDate = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(article.publishedAt);

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-all hover:-translate-y-1 hover:border-club-primary/40 hover:shadow-md">
      {/* Cover Image / Video Area */}
      <Link href={`/${locale}/news/${article.slug}`} className="relative aspect-16/9 w-full overflow-hidden bg-muted/50">
        {article.featuredImageUrl ? (
          isVideoUrl(article.featuredImageUrl) ? (
            <div className="relative h-full w-full bg-black flex items-center justify-center">
              <video src={article.featuredImageUrl} className="h-full w-full object-cover" preload="metadata" muted />
              <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/10 transition-colors">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-club-primary text-white shadow-lg group-hover:scale-110 transition-transform">
                  <Play className="h-5 w-5 fill-white translate-x-0.5" />
                </span>
              </div>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.featuredImageUrl}
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
            <span className="rounded-md bg-card/90 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-foreground shadow-xs backdrop-blur-xs">
              {article.category}
            </span>
          </div>
        )}
      </Link>

      {/* Text Content */}
      <div className="flex flex-1 flex-col justify-between p-5">
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <time dateTime={article.publishedAt.toISOString()}>{formattedDate}</time>
          </div>

          <Link href={`/${locale}/news/${article.slug}`}>
            <h3 className="line-clamp-2 text-base font-bold text-foreground transition-colors group-hover:text-club-primary sm:text-lg">
              {article.title}
            </h3>
          </Link>

          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground leading-relaxed">
            {article.excerpt}
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-border/60">
          <Link
            href={`/${locale}/news/${article.slug}`}
            className="text-xs font-semibold text-club-primary group-hover:underline inline-flex items-center gap-1"
          >
            <span>{readMoreLabel}</span>
            <span>{locale === "ar" ? "←" : "→"}</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
