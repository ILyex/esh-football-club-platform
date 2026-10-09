import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Calendar, Clock3, Globe, Newspaper } from "lucide-react";
import { getPublicNewsArticle } from "@/lib/public/news";
import { ClubVideoPlayer } from "@/components/shared/club-video-player";
import { SafeImage } from "@/components/shared/safe-image";
import { isVideoUrl } from "@/lib/media-utils";
import { frenchPublicText } from "@/lib/public/locale-text";
import { PublicBackLink } from "@/components/public/public-back-link";

export const dynamic = "force-dynamic";

export default async function PublicNewsDetailPage({
  params
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const isRtl = locale === "ar";
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

  const categoryLabel = article.category
    ? (locale === "ar" ? article.category : frenchPublicText(article.category, "Club"))
    : null;
  const additionalMedia = article.imageUrls?.filter((url) => url && url !== article.featuredImageUrl) ?? [];
  const paragraphs = article.content.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const readingMinutes = Math.max(1, Math.ceil(article.content.trim().split(/\s+/).filter(Boolean).length / 200));

  return (
    <article className="mx-auto w-full max-w-[1440px] pb-14 sm:pb-20">
      <header dir={isRtl ? "rtl" : "ltr"} className="mx-auto max-w-5xl px-4 pt-5 sm:px-8 sm:pt-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 sm:mb-8">
          <PublicBackLink locale={locale} href={`/${locale}/news`}>
            {locale === "ar" ? "العودة إلى الأخبار" : "Retour aux actualités"}
          </PublicBackLink>
          {article.alternateLocaleSlug && (
            <Link
              href={`/${otherLocale}/news/${encodeURIComponent(article.alternateLocaleSlug)}`}
              aria-label={otherLocale === "ar" ? "اقرأ بالعربية" : "Lire en français"}
              title={otherLocale === "ar" ? "اقرأ بالعربية" : "Lire en français"}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full border border-border bg-card text-foreground transition-colors hover:border-club-primary/50 hover:text-club-primary sm:w-auto sm:px-4"
            >
              <Globe className="h-4 w-4" aria-hidden="true" />
              <span className="hidden whitespace-nowrap text-xs font-bold sm:inline">
                {otherLocale === "fr" ? "LIRE EN FRANÇAIS" : "LIRE EN ARABE"}
              </span>
            </Link>
          )}
        </div>
        <div className="border-b border-border/80 pb-6 sm:pb-9">
          <div className="mb-4 flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-2 rounded-full bg-club-primary/10 px-3 py-1.5 text-xs font-extrabold text-club-primary">
              <Newspaper className="h-3.5 w-3.5" aria-hidden="true" />
              {categoryLabel || tPublic("news.title")}
            </span>
            <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground sm:text-sm">
              <Calendar className="h-3.5 w-3.5 text-club-primary" aria-hidden="true" />
              <time dateTime={article.publishedAt.toISOString()}>{formattedDate}</time>
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:text-sm">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              {locale === "ar" ? `${readingMinutes} د للقراءة` : `${readingMinutes} min de lecture`}
            </span>
          </div>
          <h1 className="max-w-4xl text-[clamp(2rem,5.2vw,4.25rem)] font-black leading-[1.18] tracking-tight text-foreground">
            {article.title}
          </h1>
        </div>
      </header>

        {article.featuredImageUrl && (
          <figure className="mx-auto mt-5 max-w-6xl px-4 sm:mt-8 sm:px-8">
            <div className="relative overflow-hidden rounded-2xl bg-black shadow-lg shadow-black/10 sm:rounded-3xl">
            {isVideoUrl(article.featuredImageUrl) ? (
              <ClubVideoPlayer src={article.featuredImageUrl} title={article.title} aspectRatio="16/9" />
            ) : (
              <div className="relative aspect-[4/3] w-full sm:aspect-video lg:aspect-[16/8]">
                <SafeImage
                  src={article.featuredImageUrl}
                  fallbackSrc="/branding/esh-logo-128.png"
                  alt={article.title}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
            )}
            </div>
          </figure>
        )}

      <section aria-label={locale === "ar" ? "نص الخبر" : "Texte de l’actualité"} className="mx-auto mt-8 w-full max-w-4xl px-5 sm:mt-12 sm:px-8">
        <div dir={isRtl ? "rtl" : "ltr"} className="min-w-0 break-words text-[1.05rem] leading-[2] text-foreground/90 sm:text-lg sm:leading-[2.05] lg:text-xl">
          {paragraphs.map((paragraph, index) => (
            <p key={index} className={index === 0 ? "border-s-2 border-club-primary ps-4 text-lg font-medium leading-[1.9] text-foreground sm:ps-6 sm:text-xl sm:leading-[1.95]" : "mt-6 sm:mt-8"}>
              {paragraph}
            </p>
          ))}
        </div>
      </section>

      {additionalMedia.length > 0 && (
        <section aria-labelledby="news-media-heading" className="mt-12 px-4 sm:mt-16 sm:px-8 lg:px-12">
          <div className="mb-5 border-t border-border/80 pt-6 sm:mb-7 sm:pt-8">
            <h2 id="news-media-heading" className="text-lg font-black text-foreground sm:text-xl">
              {locale === "ar" ? "صور ومقاطع إضافية" : "Photos et vidéos"}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:gap-7">
            {additionalMedia.map((url, idx) => {
              const isVideo = isVideoUrl(url);
              return (
                <div key={`${url}-${idx}`} className="overflow-hidden rounded-xl bg-black sm:rounded-2xl">
                  {isVideo ? (
                    <ClubVideoPlayer src={url} aspectRatio="16/9" />
                  ) : (
                    <div className="relative aspect-[4/3] w-full bg-muted sm:aspect-video">
                      <SafeImage src={url} fallbackSrc="/branding/esh-logo-128.png" alt={`${article.title} - ${idx + 1}`} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </article>
  );
}
