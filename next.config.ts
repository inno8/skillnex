import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit reads .afm font-metric files via fs.readFileSync at runtime;
  // Turbopack bundles the JS but not those data files, so it must stay
  // external (loaded from node_modules at request time) or PDF rendering
  // throws ENOENT inside the server bundle.
  serverExternalPackages: ["better-sqlite3", "xlsx", "pdfkit"],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
