import NextAuth from "next-auth";

// Middleware only needs to decode the JWT and expose the user ID to the
// coarse dashboard route guard. Keep database-backed credentials, bcrypt,
// rate limiting and audit logging in auth.ts so the edge/Worker bundle does
// not pull Node-only authentication code into every request.
export const { auth: edgeAuth } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    async jwt({ token }) {
      // The edge middleware only needs the user ID. Strip role/profile claims
      // from legacy cookies as they are refreshed so every request stays small.
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
        (session as any).invalid = true;
        return session;
      }
      session.user.id = token.userId as string;
      (session as any).rememberMe = token.rememberMe === true;
      return session;
    }
  }
});
