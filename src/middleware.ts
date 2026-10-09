import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { edgeAuth } from "@/lib/auth-edge";

const intlMiddleware = createMiddleware(routing);

// Route-level protection is intentionally COARSE: any /dashboard path just
// requires *some* authenticated session. Fine-grained, per-action permission
// checks (can this role actually delete a player, view a restricted
// document, etc.) happen server-side in the Server Action / Route Handler
// itself via requirePermission() — see src/lib/permissions.ts and spec
// section 41. Never rely on middleware alone for authorization.
function handleRequest(req: NextRequest & { auth?: unknown }) {
  const { pathname } = req.nextUrl;
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
      const isPublicApi = /^\/api\/(?:health|public-analytics|storage\/public-file|auth)(?:\/|$)/.test(pathname);
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

  return intlMiddleware(req);
}

const rememberCookieModeHeader = "x-internal-auth-cookie-mode";
const authMiddleware = edgeAuth((req: NextRequest & { auth?: unknown }) => {
  const response = handleRequest(req);
  const session = req.auth as { user?: { id?: unknown } | null; invalid?: unknown; rememberMe?: unknown } | null;
  const hasValidSession = Boolean(session?.user) && typeof session?.user?.id === "string" && session.user.id.length > 0 && session.invalid !== true;
  response.headers.set(rememberCookieModeHeader, hasValidSession ? (session?.rememberMe === true ? "persistent" : "session") : "none");
  return response;
}) as any;

export default async function middleware(req: NextRequest) {
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
