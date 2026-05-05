import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8")) as {
  version: string;
};

/**
 * Extract hostname and protocol from R2_PUBLIC_URL for Next.js image
 * optimization whitelist. Falls back to http + localhost (dev/E2E mode).
 */
function getAssetsOrigin(): { protocol: "http" | "https"; hostname: string } {
  const url = process.env.R2_PUBLIC_URL;
  if (!url) return { protocol: "http", hostname: "localhost" };
  try {
    const parsed = new URL(url);
    const proto = parsed.protocol === "http:" ? "http" : "https";
    return { protocol: proto, hostname: parsed.hostname };
  } catch {
    return { protocol: "http", hostname: "localhost" };
  }
}

const assetsOrigin = getAssetsOrigin();

const nextConfig: NextConfig = {
  allowedDevOrigins: (process.env.ALLOWED_DEV_ORIGINS ?? "").split(",").filter(Boolean),
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  images: {
    remotePatterns: [
      {
        protocol: assetsOrigin.protocol,
        hostname: assetsOrigin.hostname,
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Link",
            value: [
              '</.well-known/api-catalog>; rel="api-catalog"',
              '</llms.txt>; rel="service-doc"',
              '</api/mcp>; rel="service-desc"',
            ].join(", "),
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "off",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' https:",
              "connect-src 'self' https: wss:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
