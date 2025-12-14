import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "*.supabase.in",
      },
      {
        protocol: "https",
        hostname: "*.brandgears.com",
      },
    ],
    // Optimized device sizes - removed rarely used intermediate sizes
    deviceSizes: [640, 828, 1200, 1920],
    // Reduced image sizes for thumbnails - focuses on common use cases
    // Thumbnails: 256, 384 | Detail views: handled by deviceSizes
    imageSizes: [16, 32, 64, 128, 256, 384],
    // Two quality levels: standard (75) and high (85)
    // Removed 90 to reduce generated variants
    qualities: [75, 85],
    // Enable modern formats for better compression
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
  // Webpack configuration to prevent cache corruption
  webpack: (config, { dev }) => {
    if (dev) {
      // Use memory-based caching in development to avoid disk cache corruption
      config.cache = {
        type: "memory",
      };
      // Better file watching for WSL2/Docker environments
      config.watchOptions = {
        poll: 1000, // Check for changes every second
        aggregateTimeout: 300, // Delay before rebuilding
        ignored: ["**/node_modules", "**/.git", "**/.next"],
      };
    }
    return config;
  },
};

export default nextConfig;
