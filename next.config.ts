import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit reads .afm font-metric files via fs.readFileSync at runtime;
  // Turbopack bundles the JS but not those data files, so it must stay
  // external (loaded from node_modules at request time) or PDF rendering
  // throws ENOENT inside the server bundle.
  serverExternalPackages: ["better-sqlite3", "xlsx", "pdfkit"],
  // Promoted out of experimental in Next 16 — keeping the option enabled
  // so the typed Link href/router.push surfaces stay enforced at compile
  // time. Removed warning: 'experimental.typedRoutes has been moved'.
  typedRoutes: true,
};

export default nextConfig;
