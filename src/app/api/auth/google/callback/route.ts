import { NextRequest, NextResponse } from "next/server";
import { verifyOAuthState, getGoogleOAuthConfig, getPublicApplicationOrigin } from "@/lib/integrations/gmail/config";
import { connectOfficialGmail } from "@/lib/integrations/gmail/service";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/permissions";

// ============================================================================
// PHASE 11 — GOOGLE OAUTH 2.0 CALLBACK HANDLER
// ============================================================================

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl =
    process.env.NODE_ENV === "production"
      ? getPublicApplicationOrigin()
      : process.env.AUTH_URL || process.env.NEXTAUTH_URL || req.nextUrl.origin;

  const stateVerification = state ? verifyOAuthState(state) : null;
  const locale = stateVerification?.valid ? stateVerification.locale : "ar";

  if (error) {
    return NextResponse.redirect(
      new URL(`/${locale}/dashboard/mail?error=${encodeURIComponent(error === "access_denied" ? "google_access_denied" : "google_oauth_error")}`, baseUrl)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL(`/${locale}/dashboard/mail?error=missing_oauth_parameters`, baseUrl)
    );
  }

  // 1. Verify CSRF state token
  if (!stateVerification?.valid || !stateVerification.userId) {
    return NextResponse.redirect(
      new URL(`/${locale}/dashboard/mail?error=invalid_oauth_state`, baseUrl)
    );
  }

  // 2. Fetch authenticated user to enforce RBAC
  const user = await db.user.findUnique({
    where: { id: stateVerification.userId },
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true }
          }
        }
      }
    }
  });

  if (!user || !user.isActive) {
    return NextResponse.redirect(
      new URL(`/${locale}/dashboard/mail?error=user_not_found`, baseUrl)
    );
  }

  const permissions = user.role.permissions.map((rp) => rp.permission.key);
  const sessionUser: SessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    roleKey: user.role.key,
    roleName: user.role.name,
    permissions
  };

  // 3. Complete connection
  const config = getGoogleOAuthConfig();
  try {
    await connectOfficialGmail(code, config.redirectUri, sessionUser);
    return NextResponse.redirect(
      new URL(`/${locale}/dashboard/mail?success=connected`, baseUrl)
    );
  } catch (err: any) {
    return NextResponse.redirect(
      new URL(
        `/${locale}/dashboard/mail?error=oauth_failed`,
        baseUrl
      )
    );
  }
}
