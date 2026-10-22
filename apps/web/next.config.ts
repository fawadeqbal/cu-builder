import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Where the web server reaches the API. In production Caddy sends /api straight to the API,
// so this rewrite only matters in development and as a fallback.
const apiOrigin = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  // A self-contained Node server (apps/web/.next/standalone) for the Docker image on the VPS.
  output: "standalone",
  images: { unoptimized: true },
  // Workspace packages (@cvb/*) live outside this folder.
  outputFileTracingRoot: monorepoRoot,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
  turbopack: {
    root: monorepoRoot,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
