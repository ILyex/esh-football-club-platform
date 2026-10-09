/**
 * Media detection utility to identify whether a media URL or filename is a video.
 */
export function isVideoUrl(urlOrKey: string | null | undefined): boolean {
  if (!urlOrKey) return false;
  // Public media is usually served through `/api/storage/public-file?key=...`.
  // The extension therefore lives in the query string, not in the visible URL
  // path. Decode once so encoded storage keys such as `%2Emp4` are detected.
  let value = urlOrKey;
  try {
    value = decodeURIComponent(urlOrKey);
  } catch {
    // Keep the original value when a legacy URL contains malformed encoding.
  }

  return /\.(?:mp4|webm|mov)(?:$|[?#&])/i.test(value);
}

/**
 * Convert persisted public-storage keys and old absolute app URLs to a URL
 * served by the current deployment. Older releases sometimes saved the full
 * localhost/development origin; those links break on every other device.
 */
export function normalizePublicMediaUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const source = value.trim();
  if (!source) return null;
  if (/^data:image\//i.test(source)) return source;

  const keyToUrl = (key: string) => `/api/storage/public-file?key=${encodeURIComponent(key)}`;
  if (/^public\//i.test(source)) return keyToUrl(source);
  if (/^\/public\//i.test(source)) return keyToUrl(source.slice(1));

  try {
    const parsed = new URL(source, "https://local.invalid");
    if (parsed.pathname === "/api/storage/public-file" || parsed.pathname === "/api/storage/public-file/") {
      // Internal app storage must always resolve on this site's own origin.
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    if (parsed.origin === "https://local.invalid" && /^\/public\//i.test(parsed.pathname)) {
      return keyToUrl(`${parsed.pathname.slice(1)}${parsed.search}`);
    }
  } catch {
    // Keep ordinary relative and remote URLs below; the image fallback handles
    // malformed persisted values without rendering the browser's broken icon.
  }

  return source.startsWith("/") || /^https?:\/\//i.test(source) ? source : null;
}
