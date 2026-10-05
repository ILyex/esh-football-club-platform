import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { auth } from "@/lib/auth";

const intlMiddleware = createMiddleware(routing);

// Route-level protection is intentionally COARSE: any /dashboard path just
// requires *some* authenticated session. Fine-grained, per-action permission
// checks (can this role actually delete a player, view a restricted
// document, etc.) happen server-side in the Server Action / Route Handler
// itself via requirePermission() — see src/lib/permissions.ts and spec
// section 41. Never rely on middleware alone for authorization.
export default auth((req: NextRequest & { auth?: unknown }) => {
  const { pathname } = req.nextUrl;
  const isDashboardPath = /^\/(ar|fr)\/dashboard(?:\/|$)/.test(pathname);
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
  if (isDashboardPath && !hasValidSession) {
    const locale = pathname.split("/")[1] || routing.defaultLocale;
    const loginUrl = new URL(`/${locale}/login`, req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return intlMiddleware(req);
}) as any;

export const config = {
  matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"]
};
