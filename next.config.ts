import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8")) as {
  version: string;
};

const nextConfig: NextConfig = {
  experimental: {},
  allowedDevOrigins: ["firefly.dev.hexly.ai"],
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.lizheng.me",
      },
      {
        protocol: "https",
        hostname: "lizheng.me",
      },
    ],
  },
};

export default nextConfig;
