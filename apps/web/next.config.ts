import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // The shared package ships TypeScript source; Next compiles it like app code.
  transpilePackages: ["@leadline/shared"],
  partialPrefetching: true,
  // Hide the dev "N" badge: it sits over the board in every recording.
  devIndicators: false,
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
