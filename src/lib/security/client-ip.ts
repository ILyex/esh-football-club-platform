import "server-only";

/**
 * Best-effort client IP for rate limiting — only from a header that a trusted
 * edge actually sets.
 *
 * Why this exists: the login and CAPTCHA layers used to read `x-real-ip` and
 * the first `x-forwarded-for` entry unconditionally. Both are attacker-supplied
 * on a direct connection, so rotating them bypassed the per-IP bucket and left
 * only the (much slower) per-account bucket — enough for password spraying.
 *
 * Rules:
 *  - Cloudflare: `cf-connecting-ip` is only trusted when the request also
 *    carries `cf-ray` (added by Cloudflare itself; a client that sets these
 *    headers directly would need to reach the origin around the edge).
 *  - Vercel: `x-forwarded-for` is written by the platform proxy, so the first
 *    entry is the real client.
 *  - Anywhere else (local dev, bare Node): no IP dimension at all. Rate
 *    limiting then falls back to the per-account bucket rather than trusting a
 *    value the caller controls.
 */
const IPV4_OR_IPV6 = /^[a-fA-F0-9:.]{1,64}$/;

export function getTrustedClientIp(request: Request): string | null {
  const headers = request.headers;
  const candidates: Array<string | null | undefined> = [];

  if (headers.get("cf-ray")) {
    candidates.push(headers.get("cf-connecting-ip"));
  }
  if (process.env.VERCEL) {
    candidates.push(headers.get("x-forwarded-for")?.split(",")[0]?.trim());
  }

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed && IPV4_OR_IPV6.test(trimmed)) return trimmed;
  }
  return null;
}
