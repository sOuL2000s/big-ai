import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure the package is treated as a server-side external
  serverExternalPackages: ["@google/generative-ai"],
  // Optional: If using Turbopack specifically, you might need to ensure 
  // it doesn't try to optimize this package for the browser
  experimental: {
    turbo: {
      resolveAlias: {
        "@google/generative-ai": "@google/generative-ai",
      },
    },
  },
};

export default nextConfig;
