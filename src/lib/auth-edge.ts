import NextAuth from "next-auth";

// Middleware only needs to decode the JWT and expose the user ID to the
// coarse dashboard route guard. Keep database-backed credentials, bcrypt,
// rate limiting and audit logging in auth.ts so the edge/Worker bundle does
// not pull Node-only authentication code into every request.
export const { auth: edgeAuth } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    async jwt({ token }) {
      if (token.roleKey !== "super_admin" && Array.isArray(token.permissions)) {
        token.permissions = token.permissions.filter((key) => typeof key === "string" && key !== "*");
      }
      return token;
    },
    async session({ session, token }) {
      if (!token.userId) {
        (session as any).invalid = true;
        return session;
      }
      session.user.id = token.userId as string;
      (session.user as any).roleKey = token.roleKey;
      (session.user as any).roleName = token.roleName;
      const permissions = Array.isArray(token.permissions)
        ? token.permissions.filter((key): key is string => typeof key === "string")
        : [];
      (session.user as any).permissions = token.roleKey === "super_admin"
        ? permissions
        : permissions.filter((key) => key !== "*");
      return session;
    }
  }
});
