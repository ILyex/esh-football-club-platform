import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isProduction = process.env.NODE_ENV === "production";
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
  reactStrictMode: true,
  // unpdf uses import.meta — treat it as external on the server to avoid webpack warning
  serverExternalPackages: ["unpdf"],
  images: {
    // Only the configured public-media host may be fetched by the image optimizer.
    remotePatterns: imageRemotePatterns
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb" // allow larger uploads via server actions where used
    }
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
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
