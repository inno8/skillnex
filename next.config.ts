import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "xlsx"],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
