import createNextIntlPlugin from "next-intl/plugin";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Cloudflare's Wrangler bridge is only needed when explicitly requested. It
// starts an extra local runtime and can consume hundreds of MB on the club's
// low-spec administration PC, while the normal Node.js profile uses .env and
// PostgreSQL directly.
if (process.env.OPENNEXT_DEV === "true") {
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
  // Keep the production runtime small for cPanel shared hosting. The build
  // helper copies public/static assets into this standalone runtime folder.
  output: "standalone",
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
  // unpdf uses import.meta — treat it as external on the server to avoid webpack warning
  serverExternalPackages: ["unpdf"],
  images: {
    // Only the configured public-media host may be fetched by the image optimizer.
    remotePatterns: imageRemotePatterns
  },
  experimental: {
    ...(lowMemoryBuild ? { cpus: 1 } : {}),
    serverActions: {
      bodySizeLimit: "25mb" // allow larger uploads via server actions where used
    }
  },
  async headers() {
    return [
      // Revalidate HTML and RSC responses after a local rebuild. This avoids
      // stale pages retaining references to chunks from a previous build.
      {
        source: "/((?!_next/static|_next/image|favicon.ico).*)",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" }
        ]
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
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
