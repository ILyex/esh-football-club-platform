import "server-only";
import type { SocialReelPlatform } from "@/lib/social-reels";

const MAX_PAGE_BYTES = 512 * 1024;
const MAX_REDIRECTS = 5;
const GRAPH_API_VERSION = "v26.0";

function isAllowedHost(hostname: string, platform: SocialReelPlatform): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  if (platform === "tiktok") return host === "tiktok.com" || host === "vm.tiktok.com";
  if (platform === "instagram") return host === "instagram.com";
  return host === "facebook.com" || host === "m.facebook.com" || host === "fb.watch";
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, code: string) => {
      const point = Number(code);
      return point <= 0x10ffff ? String.fromCodePoint(point) : "";
    })
    .replace(/&#x([\da-f]+);/gi, (_match, code: string) => {
      const point = parseInt(code, 16);
      return point <= 0x10ffff ? String.fromCodePoint(point) : "";
    });
}

function cleanTitle(value: string | undefined): string | null {
  const title = decodeHtml((value ?? "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  if (!title || /^(?:facebook|instagram(?:\s*[•|·-]\s*.+)?|tiktok|log\s*in|log in or sign up|reel|original audio|لحظة من النادي|لحظة من نادي)$/i.test(title)) return null;
  return title;
}

function readHtmlTitle(html: string): string | null {
  const patterns = [
    /<meta\s+[^>]*(?:property|name)=["'](?:og:title|twitter:title)["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\s+[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:title|twitter:title)["'][^>]*>/i,
    /<meta\s+[^>]*(?:property|name)=["'](?:og:description|description|twitter:description)["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\s+[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:description|description|twitter:description)["'][^>]*>/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const title = cleanTitle(match?.[1]);
    if (title) return title;
  }
  return null;
}

function readCaption(html: string): string | null {
  const safeHtml = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  const paragraphs = safeHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi);
  for (const paragraph of paragraphs) {
    const title = cleanTitle(paragraph[1]);
    if (title) return title;
  }
  return null;
}

async function readLimitedBody(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < MAX_PAGE_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = MAX_PAGE_BYTES - size;
      const chunk = value.byteLength > remaining ? value.subarray(0, remaining) : value;
      chunks.push(chunk);
      size += chunk.byteLength;
      if (chunk.byteLength < value.byteLength) break;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function fetchPublicPage(startUrl: string, platform: SocialReelPlatform): Promise<{ url: string; html: string }> {
  let current = new URL(startUrl);
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    if (current.protocol !== "https:" || current.username || current.password || !isAllowedHost(current.hostname, platform)) {
      throw new Error("رابط الفيديو غير آمن أو لا ينتمي إلى المنصة المدعومة.");
    }
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; ClubWebsite/1.0)" },
      cache: "no-store",
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirectCount === MAX_REDIRECTS) throw new Error("تعذر تتبع رابط الفيديو.");
      current = new URL(location, current);
      await response.body?.cancel().catch(() => undefined);
      continue;
    }
    if (!response.ok) throw new Error("الفيديو غير متاح للعامة أو رفضت المنصة جلب بياناته.");
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) throw new Error("لم تُرجع المنصة صفحة فيديو قابلة لقراءة العنوان.");
    return { url: current.toString(), html: await readLimitedBody(response) };
  }
  throw new Error("تعذر الوصول إلى صفحة الفيديو.");
}

async function fetchTikTokTitle(url: string): Promise<string | null> {
  const endpoint = new URL("https://www.tiktok.com/oembed");
  endpoint.searchParams.set("url", url);
  const response = await fetch(endpoint, { redirect: "error", signal: AbortSignal.timeout(8_000), cache: "no-store" });
  if (!response.ok) return null;
  const data = await response.json() as { title?: unknown };
  return typeof data.title === "string" ? cleanTitle(data.title) : null;
}

async function fetchMetaEmbedTitle(url: string, platform: SocialReelPlatform): Promise<string | null> {
  const endpointName = platform === "instagram" ? "instagram_oembed" : "oembed_video";
  const endpoint = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${endpointName}`);
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("omitscript", "true");
  endpoint.searchParams.set("maxwidth", "420");
  endpoint.searchParams.set("hidecaption", "true");
  // Meta allows tokenless oEmbed for public posts. Keep the optional legacy
  // token server-side for installations with the higher authenticated quota.
  const accessToken = process.env.META_OEMBED_ACCESS_TOKEN?.trim();
  if (accessToken) endpoint.searchParams.set("access_token", accessToken);
  const response = await fetch(endpoint, { redirect: "error", signal: AbortSignal.timeout(8_000), cache: "no-store" });
  if (!response.ok) return null;
  const data = await response.json() as { title?: unknown; html?: unknown };
  if (typeof data.title === "string") return cleanTitle(data.title);
  if (typeof data.html === "string") return readHtmlTitle(data.html) ?? readCaption(data.html);
  return null;
}

export async function resolveSocialReelMetadata(
  url: string,
  platform: SocialReelPlatform,
): Promise<{ url: string; title: string }> {
  // Prefer platform oEmbed metadata first: Instagram may deny a direct page
  // fetch to server clients even though its official oEmbed endpoint can serve
  // metadata for a public reel.
  if (platform !== "tiktok") {
    const oembedTitle = await fetchMetaEmbedTitle(url, platform).catch(() => null);
    if (oembedTitle) return { url, title: oembedTitle };
  }

  let page: { url: string; html: string };
  page = await fetchPublicPage(url, platform);
  const title = platform === "tiktok"
    ? await fetchTikTokTitle(page.url).catch(() => null) ?? readHtmlTitle(page.html) ?? readCaption(page.html)
    : readHtmlTitle(page.html) ?? readCaption(page.html)
      ?? await fetchMetaEmbedTitle(page.url, platform).catch(() => null);
  if (!title) throw new Error("تعذر جلب عنوان الفيديو. تأكد أن المنشور عام وأن رابطه مباشر.");
  return { url: page.url, title };
}
