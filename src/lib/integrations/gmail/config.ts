import "server-only";
import crypto from "crypto";

// ============================================================================
// PHASE 11 — GMAIL INTEGRATION: OAUTH CONFIGURATION & SCOPE POLICIES
// ============================================================================

/**
 * Least-privilege OAuth scopes required for ESH Club Mail operations:
 * - Read inbox, threads, and individual messages
 * - Send official correspondence and replies
 * - Modify read/unread label states
 * - Download message attachments
 *
 * NOTE: We strictly DO NOT request full mailbox management ('mail.google.com')
 * or permanent deletion capabilities.
 */
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify"
];

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  isConfigured: boolean;
}

/** Resolve the canonical public origin used by OAuth redirects. */
export function getPublicApplicationOrigin(): string {
  const configuredOrigin =
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_PUBLIC_SITE_URL?.trim();

  if (!configuredOrigin) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("A public application URL is required for Google OAuth in production.");
    }
    return "http://localhost:3000";
  }

  let parsed: URL;
  try {
    parsed = new URL(configuredOrigin);
  } catch {
    throw new Error("The configured public application URL is invalid.");
  }

  const isLocalHost =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "::1" ||
    parsed.hostname.endsWith(".localhost");

  if (process.env.NODE_ENV === "production" && (parsed.protocol !== "https:" || isLocalHost)) {
    throw new Error("Google OAuth requires the public HTTPS application URL in production.");
  }

  return parsed.origin;
}

export function getGoogleOAuthConfig(): GoogleOAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || "";
  const canonicalRedirectUri = new URL(
    "/api/auth/google/callback",
    getPublicApplicationOrigin()
  ).toString();
  // In production the app's configured public origin is authoritative. This
  // prevents a stale GOOGLE_REDIRECT_URI secret from sending users to localhost.
  const redirectUri =
    process.env.NODE_ENV === "production"
      ? canonicalRedirectUri
      : process.env.GOOGLE_REDIRECT_URI?.trim() || canonicalRedirectUri;

  const encryptionSecret = process.env.GMAIL_TOKEN_ENCRYPTION_KEY?.trim() || process.env.AUTH_SECRET?.trim();
  const authSecret = process.env.AUTH_SECRET?.trim();
  const isConfigured = Boolean(clientId && clientSecret && redirectUri && encryptionSecret && encryptionSecret.length >= 32 && authSecret && authSecret.length >= 32);

  return {
    clientId,
    clientSecret,
    redirectUri,
    isConfigured
  };
}

/**
 * Generates an HMAC-signed state token for OAuth 2.0 to protect against CSRF attacks.
 */
export function generateOAuthState(userId: string, locale: "ar" | "fr" = "ar"): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("OAuth state signing requires AUTH_SECRET with at least 32 characters");
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString("hex");
  const payload = `${userId}:${timestamp}:${nonce}:${locale}`;
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  return Buffer.from(JSON.stringify({ payload, hmac })).toString("base64url");
}

/**
 * Verifies the HMAC-signed state token returned by Google OAuth.
 */
export function verifyOAuthState(stateToken: string): { valid: boolean; userId: string | null; locale: "ar" | "fr" } {
  try {
    const secret = process.env.AUTH_SECRET?.trim();
    if (!secret || secret.length < 32 || stateToken.length > 2048) return { valid: false, userId: null, locale: "ar" };
    const decoded = JSON.parse(Buffer.from(stateToken, "base64url").toString("utf8"));
    if (typeof decoded.payload !== "string" || typeof decoded.hmac !== "string" || !/^[a-f0-9]{64}$/i.test(decoded.hmac)) {
      return { valid: false, userId: null, locale: "ar" };
    }

    const expectedHmac = crypto.createHmac("sha256", secret).update(decoded.payload).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(decoded.hmac, "hex"), Buffer.from(expectedHmac, "hex"))) {
      return { valid: false, userId: null, locale: "ar" };
    }

    const [userId, timestampStr, nonce, requestedLocale] = decoded.payload.split(":");
    const timestamp = parseInt(timestampStr, 10);
    const age = Date.now() - timestamp;
    if (!userId || !nonce || !Number.isSafeInteger(timestamp) || age < -60_000 || age > 15 * 60 * 1000) {
      return { valid: false, userId: null, locale: "ar" };
    }

    return { valid: true, userId, locale: requestedLocale === "fr" ? "fr" : "ar" };
  } catch {
    return { valid: false, userId: null, locale: "ar" };
  }
}

/**
 * Generates the official Google OAuth 2.0 authorization URL.
 */
export function buildGoogleAuthUrl(userId: string, locale: "ar" | "fr" = "ar"): { url: string | null; error?: string } {
  const config = getGoogleOAuthConfig();
  if (!config.isConfigured) {
    return {
      url: null,
      error: "Google OAuth credentials (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) are unconfigured."
    };
  }

  const state = generateOAuthState(userId, locale);
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state
  });

  return {
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  };
}
