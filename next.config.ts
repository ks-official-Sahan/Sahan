import type { NextConfig } from "next";

import { SECURITY_HEADERS } from "./lib/security/headers";
import { buildPublicCsp } from "./lib/security/public-csp";

const dev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Gzip in `next start` only. In dev it buys nothing on localhost, and its
  // per-response gzip stream is what raises MaxListenersExceededWarning [Gzip]
  // on long streamed pages. Vercel compresses at the edge either way.
  compress: !dev,
  async headers() {
    // Static headers for every route, plus a baseline CSP for everything
    // except /admin and /api/admin: those get their own per-request nonce
    // CSP from proxy.ts, so this entry excludes them by source pattern —
    // sending both would put two conflicting Content-Security-Policy headers
    // on the same admin response.
    return [
      { source: "/:path*", headers: SECURITY_HEADERS.map((header) => ({ ...header })) },
      {
        source: "/((?!admin(?:/|$)|api/admin(?:/|$)).*)",
        headers: [{ key: "Content-Security-Policy", value: buildPublicCsp({ dev }) }],
      },
      // Admin pages and admin APIs: strictly private, no-store, no-cache so proxies and browsers never retain sensitive data
      {
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-cache, no-store, max-age=0, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
      {
        source: "/api/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-cache, no-store, max-age=0, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
      // Skill logos (CSS-mask sources) are requested on every page that lists
      // skills; the names are not content-hashed, so cache for a day and serve
      // stale while revalidating rather than marking them immutable.
      {
        source: "/icons/skills/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },
  images: {
    qualities: [70, 75, 80, 85, 90, 95],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        port: "",
        pathname: `/${process.env.CLOUDINARY_CLOUD_NAME || "**"}/**`,
      },
    ],
  },
  experimental: {
    optimizePackageImports: [
      "@mantine/core",
      "@mantine/hooks",
      "@tabler/icons-react",
      "lucide-react",
    ],
  },
  reactStrictMode: true,
};

export default nextConfig;
