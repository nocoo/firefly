import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use Turbopack for development
  experimental: {},
  allowedDevOrigins: ["firefly.dev.hexly.ai"],
};

export default nextConfig;
