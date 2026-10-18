import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { edgeAuth } from "@/lib/auth-edge";

const intlMiddleware = createMiddleware(routing);
const nextIntlLocaleHeader = "X-NEXT-INTL-LOCALE";

function continueLocalizedRequest(req: NextRequest, locale: "ar" | "fr") {
  // Locale-prefixed URLs already identify their locale. Avoid running the full
  // next-intl routing/cookie/alternate-link pipeline on every such request;
  // pass the locale header consumed by next-intl server components directly.
  const headers = new Headers(req.headers);
  headers.set(nextIntlLocaleHeader, locale);
  return NextResponse.next({ request: { headers } });
}

// Route-level protection is intentionally COARSE: any /dashboard path just
// requires *some* authenticated session. Fine-grained, per-action permission
// checks (can this role actually delete a player, view a restricted
// document, etc.) happen server-side in the Server Action / Route Handler
// itself via requirePermission() — see src/lib/permissions.ts and spec
// section 41. Never rely on middleware alone for authorization.
function handleRequest(req: NextRequest & { auth?: unknown }) {
  const { pathname } = req.nextUrl;
  const launchAt = Date.parse(process.env.ESH_LAUNCH_AT ?? "");
  const launchDemoActive = process.env.NODE_ENV === "development" &&
    process.env.ESH_LAUNCH_DEMO_ENABLED === "true" &&
    Number.isFinite(launchAt) && Date.now() < launchAt;
  const isLaunchPresentation = /^\/(?:ar|fr)\/launch\/?$/.test(pathname);

  // Local-only launch rehearsal: keep the app and API untouched on production,
  // while visitors to the local site see the presentation until the deadline.
  if (launchDemoActive && !pathname.startsWith("/api/") && !isLaunchPresentation) {
    const locale = pathname.startsWith("/fr") ? "fr" : "ar";
    return NextResponse.rewrite(new URL(`/${locale}/launch`, req.url));
  }

  const publicSiteOnly = process.env.PUBLIC_SITE_ONLY === "true" || process.env.PUBLIC_SITE_ONLY === "1";

  // The public deployment can share the same build while exposing only the
  // read-only website surface. The local administration build leaves this
  // flag false and keeps the normal authenticated dashboard available.
  if (publicSiteOnly) {
    // The public deployment keeps the full dashboard hidden, while exposing
    // the deliberately small, permission-gated field page for match updates.
    const isAdminPage = /^\/(ar|fr)\/dashboard(?:\/|$)/.test(pathname);
    if (isAdminPage) return new NextResponse(null, { status: 404 });

    if (pathname.startsWith("/api/")) {
      const isPublicApi = /^\/api\/(?:health|public-analytics|storage\/public-file|auth|push)(?:\/|$)/.test(pathname) || pathname === "/api/internal/push/process";
      if (!isPublicApi) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.next();
    }
  }

  // API handlers perform their own authentication and permission checks. Do
  // not send API requests through next-intl, which is page-route middleware.
  if (pathname.startsWith("/api/")) return NextResponse.next();

  // The field surface is protected like the dashboard, but remains allowed
  // in PUBLIC_SITE_ONLY so approved operators can use it online.
  const isProtectedOperatorPath = /^\/(ar|fr)\/(?:dashboard|field)(?:\/|$)/.test(pathname);
  const session = (req as NextRequest & {
    auth?: { user?: { id?: unknown } | null; invalid?: unknown } | null;
  }).auth;
  const hasValidSession =
    Boolean(session?.user) &&
    typeof session?.user?.id === "string" &&
    session.user.id.length > 0 &&
    session.invalid !== true;

  // Fail closed for absent, malformed, or explicitly invalid sessions. Auth.js
  // can return a session-shaped object for an invalidated JWT, so checking only
  // whether `req.auth` is truthy is not a sufficient route gate.
  if (isProtectedOperatorPath && !hasValidSession) {
    const locale = pathname.split("/")[1] || routing.defaultLocale;
    // OpenNext can expose an internal localhost URL as `req.url` in the Worker
    // adapter. Redirect to the configured public origin in production so a
    // protected request never sends visitors to the operator's local machine.
    const publicAuthUrl = process.env.NODE_ENV === "production"
      ? process.env.AUTH_URL || process.env.NEXTAUTH_URL
      : undefined;
    const loginUrl = new URL(`/${locale}/login`, publicAuthUrl || req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const localizedPath = pathname.match(/^\/(ar|fr)(?:\/|$)/);
  if (localizedPath) {
    return continueLocalizedRequest(req, localizedPath[1] as "ar" | "fr");
  }

  // Keep next-intl routing for unprefixed URLs, where it must choose/redirect
  // to the configured locale.
  return intlMiddleware(req);
}

const rememberCookieModeHeader = "x-internal-auth-cookie-mode";
const sessionCookieName = /^(?:__Secure-)?authjs\.session-token(?:\.\d+)?$/i;
const oversizedSessionCookieBytes = 8 * 1024;

function recoverOversizedSessionCookie(req: NextRequest) {
  const sessionCookies = req.cookies.getAll().filter((cookie) => sessionCookieName.test(cookie.name));
  const sessionCookieBytes = sessionCookies.reduce((size, cookie) => size + cookie.name.length + cookie.value.length + 2, 0);
  if (sessionCookieBytes <= oversizedSessionCookieBytes) return null;

  const isAuthApi = req.nextUrl.pathname.startsWith("/api/auth/");
  const response = isAuthApi
    ? NextResponse.json({ error: "session_cookie_reset" }, { status: 401, headers: { "Cache-Control": "no-store" } })
    : NextResponse.redirect(new URL(`/${req.nextUrl.pathname.split("/")[1] || routing.defaultLocale}/login?reason=session_reset`, req.url));

  // Auth.js may split a legacy JWT into multiple cookies. Clear every chunk
  // observed on this request so the next navigation can start with a clean jar.
  for (const cookie of sessionCookies) {
    response.cookies.set(cookie.name, "", {
      httpOnly: true,
      secure: cookie.name.startsWith("__Secure-"),
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      expires: new Date(0)
    });
  }
  return response;
}

const authMiddleware = edgeAuth((req: NextRequest & { auth?: unknown }) => {
  const response = handleRequest(req);
  const session = req.auth as { user?: { id?: unknown } | null; invalid?: unknown; rememberMe?: unknown } | null;
  const hasValidSession = Boolean(session?.user) && typeof session?.user?.id === "string" && session.user.id.length > 0 && session.invalid !== true;
  response.headers.set(rememberCookieModeHeader, hasValidSession ? (session?.rememberMe === true ? "persistent" : "session") : "none");
  return response;
}) as any;

export default async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const needsAuthSession =
    /^\/(?:ar|fr)\/(?:dashboard|field)(?:\/|$)/.test(pathname) ||
    /^\/api\/auth(?:\/|$)/.test(pathname);

  // Public pages and public APIs do not need Auth.js to decrypt a session JWT.
  // Keep that CPU-heavy work only on operator routes and auth endpoints; this
  // is particularly important on Cloudflare where middleware runs per request.
  if (!needsAuthSession) return handleRequest(req as NextRequest & { auth?: unknown });

  // Recover older, chunked Auth.js cookies before JWT decoding so users whose
  // request is still below the CDN limit can log in again without manual cleanup.
  const cookieRecovery = recoverOversizedSessionCookie(req);
  if (cookieRecovery) return cookieRecovery;

  const response = await authMiddleware(req) as NextResponse;
  const cookieMode = response.headers.get(rememberCookieModeHeader);
  response.headers.delete(rememberCookieModeHeader);

  // Auth.js refreshes JWT cookies on every request and normally adds an
  // expiry date. Keep unremembered logins as browser-session cookies even
  // after those refreshes, while preserving the 30-day cookie when requested.
  const isSignOutRequest = /\/api\/auth\/signout\/?$/i.test(req.nextUrl.pathname);
  if (cookieMode === "session" && !isSignOutRequest) {
    const headers = response.headers as Headers & { getSetCookie?: () => string[] };
    const setCookies = headers.getSetCookie?.() ?? [];
    if (setCookies.length > 0) {
      headers.delete("set-cookie");
      for (const setCookie of setCookies) {
        const sessionCookie = setCookie.match(/^(?:__Secure-)?authjs\.session-token(?:\.\d+)?=([^;]*)/i);
        const isSessionCookie = Boolean(sessionCookie?.[1]) && !/;\s*max-age=0(?:;|$)/i.test(setCookie);
        headers.append("set-cookie", isSessionCookie
          ? setCookie.replace(/;\s*(?:expires|max-age)=[^;]*/gi, "")
          : setCookie);
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/api/:path*", "/((?!trpc|_next|_vercel|.*\\..*).*)"]
};
