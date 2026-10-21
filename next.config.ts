import type { NextConfig } from "next";

// On GitHub Pages the site lives under /<repo-name>; the deploy workflow sets this.
// Locally it is empty, so the app runs at http://localhost:3000.
const basePath = process.env.PAGES_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
