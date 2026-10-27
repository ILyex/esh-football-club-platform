export type SocialReelPlatform = "tiktok" | "instagram" | "facebook";

export interface SocialReel {
  id: string;
  url: string;
  title: string;
  platform: SocialReelPlatform;
  createdAt: string;
}

/** Pixel delta for a physical left/right carousel control. */
export function getReelScrollDelta(direction: "left" | "right", step: number): number {
  return direction === "left" ? -Math.abs(step) : Math.abs(step);
}

function getAllowedHost(hostname: string, platform: SocialReelPlatform) {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  if (platform === "tiktok") return host === "tiktok.com" || host === "vm.tiktok.com";
  if (platform === "instagram") return host === "instagram.com";
  return host === "facebook.com" || host === "fb.watch" || host === "m.facebook.com";
}

export function identifySocialReel(urlValue: string): { platform: SocialReelPlatform; id: string } | null {
  let url: URL;
  try {
    url = new URL(urlValue);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  let match: RegExpMatchArray | null = null;
  if (getAllowedHost(url.hostname, "tiktok")) {
    // TikTok photo-mode slideshows use /@creator/photo/{postId}; they share
    // the same post ID and Embed Player as ordinary /video/{postId} posts.
    match = url.pathname.match(/\/@[^/]+\/(?:video|photo)\/(\d+)/)
      ?? url.pathname.match(/\/(?:video|photo)\/(\d+)/)
      ?? url.pathname.match(/\/player\/v1\/(\d+)/);
    if (match) return { platform: "tiktok", id: match[1]! };
  }
  if (getAllowedHost(url.hostname, "instagram")) {
    match = url.pathname.match(/^\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/);
    if (match) return { platform: "instagram", id: match[1]! };
  }
  if (getAllowedHost(url.hostname, "facebook")) {
    match = url.pathname.match(/\/(?:reel|videos)\/(\d+)/)
      ?? url.pathname.match(/\/share\/(?:r|v)\/([A-Za-z0-9_-]+)/);
    const queryId = url.searchParams.get("v");
    const id = match?.[1] ?? queryId ?? (url.hostname.replace(/^www\./, "") === "fb.watch" ? url.pathname.split("/").filter(Boolean)[0] : null);
    if (id && /^[A-Za-z0-9_-]+$/.test(id)) return { platform: "facebook", id };
  }
  return null;
}

export function getSocialReelEmbedUrl(reel: Pick<SocialReel, "url" | "platform">): string | null {
  const identified = identifySocialReel(reel.url);
  if (!identified || identified.platform !== reel.platform) return null;
  if (reel.platform === "tiktok") {
    // Keep TikTok's end screen limited to the creator's posts; the site swaps
    // the player for its own replay card when playback ends.
    return `https://www.tiktok.com/player/v1/${identified.id}?controls=1&description=0&music_info=0&rel=0`;
  }
  if (reel.platform === "instagram") {
    return `https://www.instagram.com/reel/${identified.id}/embed?hidecaption=true`;
  }
  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(reel.url)}&show_text=false&width=420`;
}

export function readSocialReels(value: unknown): SocialReel[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const raw = (value as Record<string, unknown>).reels;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const item = entry as Record<string, unknown>;
    if (typeof item.id !== "string" || typeof item.url !== "string" || typeof item.title !== "string") return [];
    const detected = identifySocialReel(item.url);
    if (!detected || (item.platform !== "tiktok" && item.platform !== "instagram" && item.platform !== "facebook")) return [];
    if (detected.platform !== item.platform) return [];
    return [{
      id: item.id.slice(0, 80),
      url: item.url,
      title: item.title.slice(0, 160),
      platform: detected.platform,
      createdAt: typeof item.createdAt === "string" ? item.createdAt : ""
    }];
  }).slice(0, 24);
}
