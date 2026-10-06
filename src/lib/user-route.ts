/** Build a readable, collision-resistant user details URL. */
export function userRouteSegment(name: string, id: string): string {
  const readable = name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "user";
  // Keep a short stable suffix so duplicate names remain unambiguous without
  // exposing the complete database CUID in the browser address bar.
  return `${readable}--${id.slice(0, 8)}`;
}

export function userDetailsHref(locale: string, name: string, id: string): string {
  return `/${locale}/dashboard/users/${encodeURIComponent(userRouteSegment(name, id))}`;
}

export function userIdPrefixFromRoute(value: string): string | null {
  const marker = value.lastIndexOf("--");
  if (marker < 0) return null;
  const prefix = value.slice(marker + 2);
  return /^[a-z0-9]{8}$/i.test(prefix) ? prefix : null;
}
