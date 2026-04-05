import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // tRPC + Server Components compatibility
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
