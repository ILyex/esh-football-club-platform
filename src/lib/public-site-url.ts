/**
 * Canonical public-site origin used by the local administration build.
 *
 * The admin UI may run on localhost while the public site runs on its own
 * deployment. Keeping the origin in one environment variable prevents local
 * links from accidentally pointing back to localhost.
 */
const DEFAULT_PUBLIC_SITE_URL = "https://esh-platform-vercel-preview.vercel.app";

export function getPublicSiteUrl(locale?: string): string {
  const configured = process.env.NEXT_PUBLIC_PUBLIC_SITE_URL?.trim();
  const origin = configured || DEFAULT_PUBLIC_SITE_URL;

  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      return `${DEFAULT_PUBLIC_SITE_URL}/${locale ?? "ar"}`;
    }
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return `${url.toString().replace(/\/$/, "")}/${locale ?? "ar"}`;
  } catch {
    return `${DEFAULT_PUBLIC_SITE_URL}/${locale ?? "ar"}`;
  }
}
