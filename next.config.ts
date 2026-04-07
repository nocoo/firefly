import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8")) as {
  version: string;
};

/**
 * Extract hostname from R2_PUBLIC_URL for Next.js image optimization whitelist.
 * Falls back to "localhost" if not configured (dev mode).
 */
function getAssetsHostname(): string {
  const url = process.env.R2_PUBLIC_URL;
  if (!url) return "localhost";
  try {
    return new URL(url).hostname;
  } catch {
    return "localhost";
  }
}

const nextConfig: NextConfig = {
  experimental: {},
  cacheHandler: require.resolve("./src/lib/cache-handler.ts"),
  cacheMaxMemorySize: 0, // Disable default in-memory cache (we use our own)
  allowedDevOrigins: (process.env.ALLOWED_DEV_ORIGINS ?? "").split(",").filter(Boolean),
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: getAssetsHostname(),
      },
    ],
  },
};

export default nextConfig;
