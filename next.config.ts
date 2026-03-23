import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use Turbopack for development
  experimental: {},
  allowedDevOrigins: ["firefly.dev.hexly.ai"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.lizheng.me",
      },
    ],
  },
};

export default nextConfig;
