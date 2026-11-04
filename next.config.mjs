import createNextIntlPlugin from "next-intl/plugin";

// Cloudflare's Wrangler bridge is only needed when explicitly requested. It
// starts an extra local runtime and can consume hundreds of MB on the club's
// low-spec administration PC, while the normal Node.js profile uses .env and
// PostgreSQL directly.
if (process.env.OPENNEXT_DEV === "true") {
  const { initOpenNextCloudflareForDev } = await import("@opennextjs/cloudflare");
  initOpenNextCloudflareForDev();
}

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isProduction = process.env.NODE_ENV === "production";
const lowMemoryBuild = process.env.OPENNEXT_LOW_MEMORY_BUILD === "true";
const imageRemotePatterns = isProduction ? [] : [
  { protocol: "http", hostname: "localhost", port: "3000", pathname: "/**" },
  { protocol: "http", hostname: "127.0.0.1", port: "3000", pathname: "/**" }
];
try {
  const publicStorageUrl = process.env.STORAGE_PUBLIC_BASE_URL?.trim();
  if (publicStorageUrl) {
    const parsed = new URL(publicStorageUrl);
    if (parsed.protocol === "https:" || (!isProduction && parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname))) {
      imageRemotePatterns.push({
        protocol: parsed.protocol.slice(0, -1),
        hostname: parsed.hostname,
        ...(parsed.port ? { port: parsed.port } : {}),
        pathname: `${parsed.pathname.replace(/\/$/, "")}/**`
      });
    }
  }
} catch {
  // Invalid optional CDN URLs do not broaden the image optimizer allowlist.
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Give each Cloudflare build a version marker so an open browser tab can
  // detect a newer deployment and reload before invoking stale Server Actions.
  ...(process.env.VERCEL_DEPLOYMENT_ID ? { deploymentId: process.env.VERCEL_DEPLOYMENT_ID } : process.env.NEXT_DEPLOYMENT_ID ? { deploymentId: process.env.NEXT_DEPLOYMENT_ID } : {}),
  // Keep the production runtime small for cPanel shared hosting. The build
  // helper copies public/static assets into this standalone runtime folder.
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
  // OpenNext packages the regular `.next` output in its worker bundle.
  reactStrictMode: true,
  // Hide Next.js development indicator from the application UI.
  devIndicators: false,
  // On low-memory Windows build hosts, run the verified lint/typecheck steps
  // separately and keep Next from spawning additional checker workers.
  ...(lowMemoryBuild ? {
    eslint: { ignoreDuringBuilds: true },
    typescript: { ignoreBuildErrors: true }
  } : {}),
  webpack(config) {
    // The development compiler otherwise keeps every visited route's module
    // graph in memory. That is convenient on a workstation but causes the
    // club's low-spec PC to grow continuously while staff browse the dashboard.
    // Production builds keep their normal optimized cache.
    if (!isProduction) config.cache = false;
    // Prisma's workerd client imports its query compiler as WebAssembly.
    // Next's webpack build must treat that import as an async WASM module.
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
  // Prisma loads its WebAssembly query compiler dynamically; include it in each server trace.
  outputFileTracingIncludes: {
    "/*": ["./node_modules/.prisma/client/query_compiler_bg.wasm"]
  },
  // unpdf uses import.meta — treat it as external on the server to avoid webpack warning
  serverExternalPackages: ["unpdf", "capjs-core", "esbuild"],
  images: {
    // Only the configured public-media host may be fetched by the image optimizer.
    remotePatterns: imageRemotePatterns
  },
  experimental: {
    ...(lowMemoryBuild ? { cpus: 1 } : {}),
    // Rewrites barrel-file imports to per-module ones. Without this, importing a
    // handful of icons from "lucide-react" (used in ~180 components) pulls the
    // whole icon barrel into the client graph, and recharts/date-fns behave the
    // same way. This is a build-time transform only — no runtime behaviour
    // changes.
    optimizePackageImports: ["lucide-react", "date-fns", "recharts"],
    // Keep a visited dashboard page in the client router cache for a short time
    // so Back/Forward and re-visits paint instantly instead of re-fetching the
    // whole RSC payload. Mutations still call revalidatePath(), which
    // invalidates the entry immediately.
    staleTimes: { dynamic: 30, static: 300 },
    serverActions: {
      bodySizeLimit: "40mb" // website media videos may be up to 35MB
    }
  },
  async headers() {
    return [
      // Management surfaces must never be cached: they render the signed-in
      // operator's data.
      {
        source: "/:locale(ar|fr)/(dashboard|field)/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }]
      },
      // API responses carry per-session data by definition.
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }]
      },
      // The PUBLIC website is anonymous (no session-derived HTML), so it can be
      // served from the CDN for a minute instead of hitting Postgres on every
      // visit. `no-store` used to be applied to every HTML response, which made
      // the 441 revalidate*() calls in the codebase meaningless.
      {
        source: "/:locale(ar|fr)/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, s-maxage=60, stale-while-revalidate=300" }
        ]
      },
      // Public media is immutable enough to cache for a long time; this rule is
      // intentionally declared after the HTML rules so assets keep winning.
      {
        source: "/((?:branding/|.*\\.(?:avif|gif|jpe?g|png|svg|webp|mp4|webm|woff2?))$)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=43200, stale-while-revalidate=86400" },
          { key: "Vercel-CDN-Cache-Control", value: "public, s-maxage=31536000, stale-while-revalidate=86400" }
        ]
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          ...(process.env.NODE_ENV === "production"
            ? [{
                key: "Content-Security-Policy",
                value: [
                  "default-src 'self'",
                  "base-uri 'self'",
                  "object-src 'none'",
                  "frame-ancestors 'self'",
                  "form-action 'self'",
                  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://www.instagram.com https://connect.facebook.net",
                  "worker-src 'self' blob:",
                  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                  "img-src 'self' data: blob: https:",
                  "font-src 'self' data: https://fonts.gstatic.com",
                  "connect-src 'self' https: wss:",
                  "frame-src 'self' blob: data: https:",
                  "media-src 'self' blob: data: https:"
                ].join("; ")
              }]
            : []),
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "Origin-Agent-Cluster", value: "?1" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
            : [])
        ]
      }
    ];
  }
};

export default withNextIntl(nextConfig);
