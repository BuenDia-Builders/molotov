import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Soroban contract bindings ship as TypeScript from a workspace package.
  transpilePackages: ["@molotov/stellar-client"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "gateway.pinata.cloud" },
      { protocol: "https", hostname: "ipfs.io" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
