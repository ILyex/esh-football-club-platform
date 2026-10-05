import { PrismaClient } from "@prisma/client";

// Keep Prisma's runtime metadata attached to this central module. When the
// schema changes, regenerate the client and restart the dev server so Next /
// Turbopack cannot keep validating queries against stale runtime metadata.
// Standard Next.js-safe Prisma singleton: prevents exhausting DB connections
// from hot-reloading in development, where every file save would otherwise
// instantiate a brand new client.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
