import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
