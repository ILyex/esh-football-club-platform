import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { cache } from "react";
import { authenticatePlatformCredentials } from "@/lib/credentials-auth";
import { db } from "@/lib/db";

// ============================================================================
// AUTHENTICATION (Auth.js / NextAuth v5)
// ----------------------------------------------------------------------------
// Design notes:
//  - Credentials provider + bcrypt password hashing (never plaintext, never
//    reversible encryption for passwords).
//  - JWT session strategy. The browser cookie contains only the user ID,
//    token version, and remember-me flag. Role and permission data is loaded
//    from the database into the server-side session, keeping request headers
//    small while preserving current RBAC checks.
//  - `tokenVersion`: every issued JWT carries the User.tokenVersion value at
//    login time. On each request we compare it against the current DB value;
//    if they differ (password changed, user disabled, role changed by an
//    admin) the session is rejected immediately — this is what makes
//    Dashboard > Users > "Disable user" actually take effect right away
//    instead of waiting for a JWT to expire naturally.
//  - Generic error messages ("Invalid credentials") regardless of whether the
//    email doesn't exist or the password is wrong — avoids user enumeration.
//  - Failed and successful logins are written to AuditLog for traceability
//    (helps detect brute-force patterns; pair with rate limiting — see
//    src/middleware.ts — in production).
// ============================================================================

export const { handlers, signIn, signOut, auth, unstable_update } = NextAuth({
  trustHost: true,
  // The JWT remains valid for up to 30 days, while the login action makes the
  // browser cookie session-only unless the user explicitly selects remember me.
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/login"
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        rememberMe: { label: "Remember me", type: "text" },
        captchaToken: { label: "Security verification", type: "text" }
      },
      async authorize(raw, request) {
        return authenticatePlatformCredentials(raw, request);
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Keep only compact, security-relevant claims in the browser cookie.
        token.userId = user.id;
        token.tokenVersion = (user as any).tokenVersion;
        token.rememberMe = (user as any).rememberMe === true;
      }

      // Remove bulky legacy claims as old cookies are refreshed. Session data
      // is rebuilt from the current database record below, never from these
      // client-held snapshots.
      delete token.name;
      delete token.email;
      delete token.picture;
      delete token.roleKey;
      delete token.roleName;
      delete token.permissions;
      return token;
    },
    async session({ session, token }) {
      if (!token.userId) {
        // Invalidated token from the jwt() callback above.
        (session as any).invalid = true;
        return session;
      }
      try {
        // Load the authoritative account and role for this request. This also
        // keeps immediate account disablement, token revocation, and permission
        // changes effective without storing large permission arrays in cookies.
        const current = await db.user.findUnique({
          where: { id: token.userId as string },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            isActive: true,
            tokenVersion: true,
            deletedAt: true,
            role: {
              select: {
                key: true,
                name: true,
                permissions: { select: { permission: { select: { key: true } } } }
              }
            }
          }
        });

        if (!current || !current.isActive || current.deletedAt || current.tokenVersion !== token.tokenVersion) {
          (session as any).invalid = true;
          return session;
        }

        session.user.id = current.id;
        session.user.name = current.name;
        session.user.email = current.email;
        session.user.image = current.image;
        (session as any).rememberMe = token.rememberMe === true;
        (session.user as any).roleKey = current.role.key;
        (session.user as any).roleName = current.role.name;
        (session.user as any).permissions = current.role.permissions
          .map(({ permission }) => permission.key)
          .filter((key) => key !== "*" || current.role.key === "super_admin");
      } catch {
        // Fail closed if the database cannot confirm the account or role.
        (session as any).invalid = true;
      }
      return session;
    }
  }
});

// Share the authoritative session lookup across layouts, pages, and nested
// server components in the same render. Without request-scoped memoization,
// each call re-queries the account and its complete role-permission graph.
export const getRequestAuthSession = cache(() => auth());
