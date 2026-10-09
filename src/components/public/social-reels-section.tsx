"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink, Film } from "lucide-react";
import { getReelScrollDelta, getSocialReelEmbedUrl, type SocialReel } from "@/lib/social-reels";
import { SocialReelEmbed } from "@/components/public/social-reel-embed";

interface Props {
  reels: SocialReel[];
  locale: string;
  compact?: boolean;
}

const platforms = {
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook"
} as const;

export function SocialReelsSection({ reels, locale, compact = false }: Props) {
  const reelsTrackRef = useRef<HTMLDivElement>(null);
  const isAr = locale === "ar";
  const visibleReels = reels.slice(0, compact ? 6 : 24);

  if (visibleReels.length === 0) return null;

  const scrollTrack = (direction: "left" | "right") => {
    const track = reelsTrackRef.current;
    if (!track) return;
    const firstCard = track.firstElementChild as HTMLElement | null;
    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 16;
    const step = firstCard ? firstCard.getBoundingClientRect().width + gap : Math.max(280, track.clientWidth * 0.75);
    track.scrollBy({ left: getReelScrollDelta(direction, step), behavior: "smooth" });
  };

  return (
    <section id="reels" className="space-y-4 scroll-mt-24">
      <div className="flex items-end justify-between gap-3 border-b border-border/70 pb-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-club-primary"><Film className="h-3.5 w-3.5" />{isAr ? "من حسابات النادي" : "Depuis nos réseaux"}</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-foreground sm:text-2xl">{isAr ? "لحظات حديثة" : "Moments récents"}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {compact && <Link href={`/${locale}/gallery#reels`} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[11px] font-bold text-muted-foreground transition-colors hover:border-club-primary/40 hover:text-club-primary"><span>{isAr ? "كل المقاطع" : "Tous les Reels"}</span><ExternalLink className="h-3.5 w-3.5" /></Link>}
        </div>
      </div>

      <div className="relative md:px-12">
        <div
          ref={reelsTrackRef}
          dir={isAr ? "rtl" : "ltr"}
          className="flex items-start snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-smooth pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4"
        >
        {visibleReels.map((reel) => {
          const embed = getSocialReelEmbedUrl(reel);
          if (!embed) return null;
          return (
            <article key={reel.id} className={`group min-w-0 shrink-0 snap-start overflow-hidden rounded-2xl bg-card ${compact ? "w-[min(78vw,280px)] sm:w-[min(38vw,300px)] lg:w-[calc((100%-2rem)/3)]" : "w-[min(78vw,320px)] sm:w-[min(36vw,340px)] lg:w-[calc((100%-3rem)/4)]"}`}>
              <div className="relative aspect-[9/16] overflow-hidden bg-[#08090a]">
                <SocialReelEmbed src={embed} originalUrl={reel.url} title={platforms[reel.platform]} platform={reel.platform} locale={locale} />
              </div>
              <div className="flex min-h-[52px] items-center px-3 py-2.5 sm:px-4">
                <p className="text-[10px] font-medium text-muted-foreground">{platforms[reel.platform]}</p>
              </div>
            </article>
          );
        })}
        </div>
        {visibleReels.length > 1 && (
          <>
            <button type="button" onClick={() => scrollTrack("left")} aria-label={isAr ? "تمرير الريلز إلى اليسار" : "Défiler les reels vers la gauche"} className="absolute left-0 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/95 text-foreground shadow-lg backdrop-blur transition-colors hover:border-club-primary hover:bg-club-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary md:inline-flex"><ChevronLeft className="h-5 w-5" aria-hidden="true" /></button>
            <button type="button" onClick={() => scrollTrack("right")} aria-label={isAr ? "تمرير الريلز إلى اليمين" : "Défiler les reels vers la droite"} className="absolute right-0 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/95 text-foreground shadow-lg backdrop-blur transition-colors hover:border-club-primary hover:bg-club-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary md:inline-flex"><ChevronRight className="h-5 w-5" aria-hidden="true" /></button>
          </>
        )}
      </div>
    </section>
  );
}
