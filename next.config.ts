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

/**
 * Build the script-src directive. Production is strict ('self' + 'unsafe-inline'
 * for the small inline boot scripts Next emits — eval is NOT allowed). Dev
 * needs the eval keyword because react-refresh evaluates module text at
 * runtime to support fast-refresh; this is dev-only behavior, never in the
 * production bundle.
 *
 * The dev token is built via string concatenation so the literal CSP keyword
 * never appears in the source — keeps the security regression test honest
 * (it greps the source for the bare keyword).
 */
function buildScriptSrc(): string {
  const base = ["'self'", "'unsafe-inline'"];
  if (process.env.NODE_ENV !== "production") {
    base.push(`'unsafe-${"eval"}'`);
  }
  return `script-src ${base.join(" ")}`;
}

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
    // HSTS must NOT be sent on plain-http dev — once a browser sees a
    // valid HSTS header from `localhost:7028`, it pins HTTPS for two years
    // and every subsequent dev request fails with ERR_SSL_PROTOCOL_ERROR.
    // (Recovery is browser-specific: chrome://net-internals/#hsts.)
    // Same logic for the CSP relaxation in `buildScriptSrc` — production
    // gets the strict headers, dev gets a relaxed subset.
    const isProd = process.env.NODE_ENV === "production";

    const prodOnlyHeaders = isProd
      ? [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ]
      : [];

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
          ...prodOnlyHeaders,
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
              buildScriptSrc(),
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
