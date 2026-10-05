import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roleKey: string;
      roleName: string;
      permissions: string[];
    } & DefaultSession["user"];
  }

  interface User {
    roleKey: string;
    roleName: string;
    permissions: string[];
    tokenVersion: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    roleKey?: string;
    roleName?: string;
    permissions?: string[];
    tokenVersion?: number;
  }
}
