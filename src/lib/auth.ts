import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { CredentialsSignin } from "next-auth";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validations/auth";
import { writeAuditLog } from "@/lib/audit";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

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
        rememberMe: { label: "Remember me", type: "text" }
      },
      async authorize(raw, request) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        // Normalize here as well as in the form action so API/direct provider
        // calls behave identically for mixed-case or padded email addresses.
        const email = parsed.data.email.trim().toLowerCase();
        const { password } = parsed.data;

        // Enforce throttling at the credential verifier itself, so direct calls
        // to Auth.js cannot bypass the login page's server-action guard.
        const ipCandidates = [
          request.headers.get("x-real-ip")?.trim(),
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        ];
        const clientIp = ipCandidates.find((candidate) => candidate && /^[a-fA-F0-9:.]{1,64}$/.test(candidate)) ?? null;
        const accountHash = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(email));
        const accountKey = Array.from(new Uint8Array(accountHash), (byte) => byte.toString(16).padStart(2, "0")).join("");
        const windowMs = 15 * 60 * 1000;
        // Account throttling is independent of client IP so rotating or
        // spoofing forwarded addresses cannot reset the per-account budget.
        const accountLimitKey = `login:credentials:account:${accountKey}`;
        const ipLimitKey = clientIp ? `login:credentials:ip:${clientIp}` : null;
        const accountLimit = { key: accountLimitKey, limit: 10, windowMs };
        const ipLimit = ipLimitKey ? { key: ipLimitKey, limit: 30, windowMs } : null;
        const [accountResult, ipResult] = await Promise.all([
          checkRateLimit(accountLimit),
          ipLimit ? checkRateLimit(ipLimit) : Promise.resolve(null)
        ]);
        if (!accountResult.allowed || (ipResult !== null && !ipResult.allowed)) {
          const error = new CredentialsSignin();
          error.code = "rate_limited";
          throw error;
        }

        const user = await db.user.findUnique({
          where: { email: email.toLowerCase(), deletedAt: null },
          include: { role: { include: { permissions: { include: { permission: true } } } } }
        });

        // Constant-shape response path: always run bcrypt.compare even when
        // the user doesn't exist, using a dummy hash, so response timing
        // doesn't leak which emails are registered.
        const hashToCompare = user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinva";
        const passwordMatches = await bcrypt.compare(password, hashToCompare);

        if (!user || !user.isActive || !passwordMatches) {
          await writeAuditLog({
            userId: user?.id ?? null,
            action: "auth.login_failed",
            entityType: "User",
            entityId: user?.id ?? null
          });
          return null;
        }

        const loginTime = new Date();
        await db.user.update({ where: { id: user.id }, data: { lastLoginAt: loginTime, lastSeenAt: loginTime } });
        await writeAuditLog({ userId: user.id, action: "auth.login_success", entityType: "User", entityId: user.id });
        // Lockouts count failures only and reset for this account after success.
        // Keep the IP-wide counter so one successful account cannot erase
        // failures against other accounts from the same source.
        await resetRateLimit(accountLimitKey);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image ?? undefined,
          roleKey: user.role.key,
          roleName: user.role.name,
          tokenVersion: user.tokenVersion,
          rememberMe: raw?.rememberMe === "true" || raw?.rememberMe === true,
          permissions: user.role.permissions
            .map((rp) => rp.permission.key)
            .filter((key) => key !== "*" || user.role.key === "super_admin")
        };
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
