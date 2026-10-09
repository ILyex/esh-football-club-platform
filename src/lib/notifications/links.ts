/** Normalize stored dashboard notification links for the active locale. */
export function resolveNotificationLink(rawLink: string | null | undefined, locale: string): string {
  const fallback = `/${locale}/dashboard`;
  if (!rawLink) return fallback;

  const raw = rawLink.trim();
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) return fallback;

  const parsed = new URL(raw, "https://club.invalid");
  let path = parsed.pathname;
  path = path.replace(/^\/(?:ar|fr)(?=\/|$)/i, "") || "/";
  while (/^\/dashboard\/dashboard(?:\/|$)/.test(path)) {
    path = path.replace(/^\/dashboard\/dashboard/, "/dashboard");
  }
  if (path !== "/dashboard" && !path.startsWith("/dashboard/")) {
    path = `/dashboard${path === "/" ? "" : path}`;
  }

  return `/${locale}${path}${parsed.search}${parsed.hash}`;
}
