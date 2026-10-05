import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Calendar, ChevronRight, ChevronLeft, ArrowRight, ArrowLeft, Globe } from "lucide-react";
import { getPublicNewsArticle } from "@/lib/public/news";
import { ClubVideoPlayer } from "@/components/shared/club-video-player";
import { isVideoUrl } from "@/lib/media-utils";

export default async function PublicNewsDetailPage({
  params
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const isRtl = locale === "ar";
  const BreadcrumbChevron = isRtl ? ChevronLeft : ChevronRight;
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;
  const otherLocale = locale === "ar" ? "fr" : "ar";

  const [tPublic, article] = await Promise.all([
    getTranslations({ locale, namespace: "publicSite" }),
    getPublicNewsArticle(slug, locale)
  ]);

  if (!article) {
    notFound();
  }

  const formattedDate = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(article.publishedAt);

  return (
    <article className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      {/* Breadcrumbs */}
      <nav className="mb-8 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Link href={`/${locale}/news`} className="hover:text-club-primary transition-colors">
          {tPublic("news.title")}
        </Link>
        <BreadcrumbChevron className="h-3.5 w-3.5" />
        <span className="font-semibold text-foreground truncate max-w-xs">
          {article.title}
        </span>
      </nav>

      {/* Header Area */}
      <header className="space-y-4 border-b border-border/80 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {article.category && (
              <span className="rounded-md bg-club-primary/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-club-primary">
                {article.category}
              </span>
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <time dateTime={article.publishedAt.toISOString()}>{formattedDate}</time>
            </div>
          </div>

          {/* Alternate language link if available */}
          {article.alternateLocaleSlug && (
            <Link
              href={`/${otherLocale}/news/${article.alternateLocaleSlug}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            >
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{otherLocale === "ar" ? "اقرأ بالعربية" : "Lire en Français"}</span>
            </Link>
          )}
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight sm:text-4xl text-foreground leading-tight">
          {article.title}
        </h1>
      </header>

      {/* Featured Media (Video Player or Image) */}
      {article.featuredImageUrl && (
        <div className="my-8 aspect-16/9 w-full overflow-hidden rounded-2xl bg-black shadow-sm">
          {isVideoUrl(article.featuredImageUrl) ? (
            <ClubVideoPlayer
              src={article.featuredImageUrl}
              title={article.title}
              aspectRatio="16/9"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.featuredImageUrl}
              alt={article.title}
              className="h-full w-full object-cover"
            />
          )}
        </div>
      )}

      {/* Article Body Content */}
      <div className="mt-8 text-base leading-relaxed text-foreground/90 whitespace-pre-line space-y-4">
        {article.content}
      </div>

      {/* Additional Article Media (Photos & Videos) */}
      {article.imageUrls && article.imageUrls.length > 1 && (
        <div className="mt-12 pt-8 border-t border-border/70 space-y-4">
          <h3 className="text-lg font-bold text-foreground">
            {locale === "ar" ? "وسائط ومقتطفات الخبر:" : "Médias associés :"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {article.imageUrls
              .filter((url) => url !== article.featuredImageUrl)
              .map((url, idx) => {
                const isVideo = isVideoUrl(url);
                return (
                  <div key={idx} className="rounded-xl overflow-hidden border border-border bg-card shadow-xs">
                    {isVideo ? (
                      <ClubVideoPlayer src={url} aspectRatio="16/9" />
                    ) : (
                      <div className="relative aspect-16/9 w-full bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`${article.title} - ${idx + 1}`} className="h-full w-full object-cover" />
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="mt-12 border-t border-border/80 pt-8">
        <Link
          href={`/${locale}/news`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-club-primary hover:underline"
        >
          <BackArrow className="h-4 w-4" />
          <span>{tPublic("news.backToNews")}</span>
        </Link>
      </div>
    </article>
  );
}
