import type { NextConfig } from "next";
import path from "node:path";
import { SECURITY_HEADERS } from "../../lib/security-policy";
import {
  IS_WEB_REVIEW_ENVIRONMENT,
  WEB_ENVIRONMENT,
  isWebSanityLaneAllowed,
} from "./runtime-environment";

const REVIEW_HEADERS = IS_WEB_REVIEW_ENVIRONMENT
  ? [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }]
  : [];
const SANITY_PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
const SANITY_DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim();
const SANITY_LANE_ALLOWED = isWebSanityLaneAllowed(SANITY_PROJECT_ID, SANITY_DATASET);

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_CCPUN_APP_ENV: WEB_ENVIRONMENT === "unknown" ? "" : WEB_ENVIRONMENT,
  },
  trailingSlash: true,
  compress: true,
  turbopack: {
    root: path.resolve(process.cwd(), "../.."),
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-slot",
      "@radix-ui/react-toast",
      "class-variance-authority",
    ],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 90],
    deviceSizes: [640, 768, 1080, 1280, 1920],
    imageSizes: [16, 32, 64, 128, 256],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "blog.ccpun.com",
        port: "",
        pathname: "/wp-content/uploads/**",
        search: "",
      },
      ...(SANITY_PROJECT_ID && SANITY_DATASET && SANITY_LANE_ALLOWED
        ? [
            {
              protocol: "https" as const,
              hostname: "cdn.sanity.io",
              port: "",
              pathname: `/images/${SANITY_PROJECT_ID}/${SANITY_DATASET}/**`,
              search: "",
            },
          ]
        : []),
    ],
  },
  async redirects() {
    return [
      {
        source: "/living-benefits/:path*",
        destination: "/ci-planning/",
        permanent: true,
      },
      {
        source: "/tools/fhc/:path*",
        destination: "/tools/financial-health-check/",
        permanent: true,
      },
      {
        source: "/financial-advisor/:path*",
        destination: "/",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...SECURITY_HEADERS, ...REVIEW_HEADERS],
      },
    ];
  },
};

export default nextConfig;
