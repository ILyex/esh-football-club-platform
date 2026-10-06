import type { PrismaClient } from "@prisma/client";

type CloudflareEnv = { DATABASE_URL?: string; DEPLOY_TARGET?: string };

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const overrides = new Map<string, unknown>();
let localClient: Promise<PrismaClient> | undefined;
const clientsByRequest = new WeakMap<object, Promise<PrismaClient>>();

function prismaLogLevels(): ("warn" | "error")[] {
  return process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"];
}

function nodePoolOptions() {
  const configuredMax = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "5", 10);
  // Keep each Node process conservative by default. On shared cPanel hosting,
  // Passenger may run more than one process, so total connections are
  // DATABASE_POOL_MAX × process count. Cap the setting to avoid accidental
  // exhaustion of a small managed PostgreSQL plan.
  const max = Number.isInteger(configuredMax) && configuredMax >= 1
    ? Math.min(configuredMax, 20)
    : 5;

  return {
    connectionString: process.env.DATABASE_URL,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000
  };
}

async function getLocalClient(): Promise<PrismaClient> {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  localClient ??= Promise.all([
    import("@prisma/client"),
    import("@prisma/adapter-pg"),
    import("pg")
  ]).then(([{ PrismaClient: Client }, { PrismaPg }, { default: pg }]) => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is required for the PostgreSQL adapter.");
    const pool = new pg.Pool({ ...nodePoolOptions(), connectionString });
    const client = new Client({ adapter: new PrismaPg(pool), log: prismaLogLevels() });
    if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
    return client;
  });
  return localClient;
}

async function getClient(): Promise<PrismaClient> {
  const isDevelopment = process.env.NODE_ENV !== "production";
  let context: { env: CloudflareEnv; ctx: object } | undefined;
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const cloudflareContext = await getCloudflareContext({ async: true });
    context = { env: cloudflareContext.env as unknown as CloudflareEnv, ctx: cloudflareContext.ctx };
  } catch (error) {
    // Normal Node.js hosting (local, cPanel, and other Node hosts) has no
    // Cloudflare request context and continues to use DATABASE_URL.
    if (process.env.DEPLOY_TARGET === "cloudflare" && !isDevelopment) {
      throw new Error("Cloudflare request context is unavailable; refusing to use the Node.js database fallback.", { cause: error });
    }
  }

  const connectionString = context?.env.DATABASE_URL;
  if (connectionString) {
    // A Prisma client/pool belongs to one Worker request context. Reusing a
    // pending initialization promise across requests is rejected by workerd.
    let clientPromise = clientsByRequest.get(context!.ctx);
    if (!clientPromise) {
      clientPromise = Promise.all([
      import("@/generated/prisma-worker/client"),
      import("@prisma/adapter-neon"),
      import("@neondatabase/serverless")
      ]).then(([{ PrismaClient: Client }, { PrismaNeon }, { neonConfig }]) => {
        neonConfig.webSocketConstructor = WebSocket;
        const adapter = new PrismaNeon({ connectionString });
        return new Client({ adapter, log: prismaLogLevels() }) as unknown as PrismaClient;
      });
      clientsByRequest.set(context!.ctx, clientPromise);
    }
    return clientPromise;
  }

  // `initOpenNextCloudflareForDev()` loads Wrangler vars into the local Next.js
  // dev process. That makes DEPLOY_TARGET look like a Worker even though this
  // request is running in Node and its database URL comes from .env. Use the
  // Node adapter in development; keep the strict missing-secret guard in the
  // actual production Worker runtime.
  if (!isDevelopment && (context?.env.DEPLOY_TARGET === "cloudflare" || process.env.DEPLOY_TARGET === "cloudflare")) {
    throw new Error("Cloudflare deployment is missing the DATABASE_URL Neon secret.");
  }

  return getLocalClient();
}

function pathKey(path: PropertyKey[]): string {
  return path.map(String).join(".");
}

function makeDelegateProxy(path: PropertyKey[]): object {
  const callable = () => undefined;
  return new Proxy(callable, {
    get(_target, property) {
      if (property === "then") return undefined;
      return makeDelegateProxy([...path, property]);
    },
    set(_target, property, value) {
      overrides.set(pathKey([...path, property]), value);
      return true;
    },
    apply(_target, _thisArg, args) {
      const key = pathKey(path);
      if (overrides.has(key)) return (overrides.get(key) as (...callArgs: unknown[]) => unknown)(...args);
      return getClient().then((client) => {
        let receiver: any = client;
        for (const segment of path.slice(0, -1)) receiver = receiver[segment];
        const method = receiver[path[path.length - 1]!];
        return method.apply(receiver, args);
      });
    }
  });
}

// The proxy keeps the existing `db.model.operation()` API intact while
// resolving Cloudflare's request-scoped Hyperdrive binding only when a query
// runs. This avoids opening a PostgreSQL client during module initialization.
export const db = new Proxy(() => undefined, {
  get(_target, property) {
    if (property === "then") return undefined;
    return makeDelegateProxy([property]);
  },
  set(_target, property, value) {
    overrides.set(String(property), value);
    return true;
  }
}) as unknown as PrismaClient;
