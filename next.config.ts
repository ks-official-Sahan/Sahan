import type { NextConfig } from "next";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "assets.aceternity.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
  // experimental: {
  //   esmExternals: "loose",
  //   optimizePackageImports: ["@mantine/core", "@mantine/hooks"],
  // },

  // eslint: {
  //   ignoreDuringBuilds: true,
  // },
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // config.cache = {
    //   type: "filesystem",
    //   name: "project-cache",
    //   version: "1.0",
    //   buildDependencies: {
    //     config: [__filename], // Rebuild when config changes
    //   },
    // };
    config.cache = false;
    return config;
  },
};

export default nextConfig;
