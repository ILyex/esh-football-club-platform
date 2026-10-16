import "server-only";

// ============================================================================
// PHASE 10B — FAF CONNECT CONFIGURATION
// ----------------------------------------------------------------------------
// Loads, sanitizes, and bounds configuration for FAF Connect integration.
// Fails closed if credentials or configuration are absent.
// Never exposes passwords, session cookies, or secrets to client or logs.
// ============================================================================

export interface FAFConfig {
  enabled: boolean;
  portalUrl: string;
  clubCode: string;
  username: string;
  hasCredentials: boolean;
  sessionCookie?: string;
  hasSessionCookie: boolean;
  timeoutMs: number;
  rateLimitDelayMs: number;
  userAgent: string;
}

function sanitizeUrl(rawUrl?: string): string {
  const fallback = "https://ems.fafconnect.dz";
  if (!rawUrl || !rawUrl.trim()) return fallback;
  try {
    const parsed = new URL(rawUrl.trim());
    const host = parsed.hostname.toLowerCase();
    if (
      parsed.protocol !== "https:" ||
      host !== "ems.fafconnect.dz" ||
      parsed.username ||
      parsed.password
    ) {
      return fallback;
    }
    return parsed.origin;
  } catch {
    return fallback;
  }
}

export function getFAFConfig(): FAFConfig {
  const isExplicitlyDisabled = process.env.FAF_ENABLED === "false" || process.env.FAF_ENABLED === "0";
  const portalUrl = sanitizeUrl(process.env.FAF_PORTAL_URL);
  const clubCode = process.env.FAF_CLUB_CODE?.trim() || "14DLG9D";
  const username = process.env.FAF_USERNAME?.trim() || "";
  const password = process.env.FAF_PASSWORD?.trim() || "";

  const rawTimeout = parseInt(process.env.FAF_TIMEOUT_MS || "20000", 10);
  const timeoutMs = isNaN(rawTimeout) || rawTimeout < 2000 ? 20000 : Math.min(rawTimeout, 60000);

  const rawDelay = parseInt(process.env.FAF_RATE_LIMIT_DELAY_MS || "1000", 10);
  const rateLimitDelayMs = isNaN(rawDelay) || rawDelay < 200 ? 1000 : Math.min(rawDelay, 10000);

  const sessionCookie = process.env.FAF_SESSION_COOKIE?.trim() || "";
  const hasSessionCookie = Boolean(sessionCookie);
  const hasCredentials = Boolean(username && password) || hasSessionCookie;
  const enabled = !isExplicitlyDisabled && Boolean(portalUrl);

  return {
    enabled,
    portalUrl,
    clubCode,
    username,
    hasCredentials,
    sessionCookie: sessionCookie || undefined,
    hasSessionCookie,
    timeoutMs,
    rateLimitDelayMs,
    userAgent: "ESH-ClubPlatform/1.0 (Algerian Ligue Amateur; Club 14DLG9D)"
  };
}
