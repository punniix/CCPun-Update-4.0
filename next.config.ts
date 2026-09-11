import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";
import { IS_REVIEW_ENVIRONMENT } from "./lib/deployment-environment";
import { SECURITY_HEADERS } from "./lib/security-policy";
import { getAdminEnvironment, isSanityLaneAllowed } from "./lib/admin/environment";

const REVIEW_HEADERS = IS_REVIEW_ENVIRONMENT
  ? [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }]
  : [];
const PRIVATE_SURFACE_ROBOTS_HEADERS = [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }];
const PRIVATE_ADMIN_API_HEADERS = [
  ...PRIVATE_SURFACE_ROBOTS_HEADERS,
  { key: "Cache-Control", value: "private, no-cache, no-store, max-age=0, must-revalidate" },
];

const SANITY_PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
const SANITY_DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim();
const APP_ENVIRONMENT = getAdminEnvironment();
const SANITY_LANE_ALLOWED = isSanityLaneAllowed(SANITY_DATASET, APP_ENVIRONMENT);
const LOCAL_DIST_DIR = APP_ENVIRONMENT === "local-uat"
  ? ".ccpun-local/next-uat"
  : APP_ENVIRONMENT === "local-production"
    ? ".ccpun-local/next-production"
    : ".next";

const nextConfig: NextConfig = {
  // ponytail: separate build state lets both fixed local lanes run at once.
  distDir: LOCAL_DIST_DIR,
  env: {
    NEXT_PUBLIC_CCPUN_APP_ENV: APP_ENVIRONMENT === "unknown" ? "" : APP_ENVIRONMENT,
    NEXT_PUBLIC_CCPUN_VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID?.trim() ?? "",
    NEXT_PUBLIC_CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID:
      process.env.CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID?.trim() ?? "",
  },
  trailingSlash: true,
  compress: true,
  turbopack: {
    root: process.cwd(),
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
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...SECURITY_HEADERS, ...REVIEW_HEADERS],
      },
      {
        source: "/snt-admin/:path*",
        headers: PRIVATE_SURFACE_ROBOTS_HEADERS,
      },
      {
        source: "/studio/:path*",
        headers: PRIVATE_SURFACE_ROBOTS_HEADERS,
      },
      {
        source: "/api/snt-admin/:path*",
        headers: PRIVATE_ADMIN_API_HEADERS,
      },
      {
        source: "/api/preview/:path*",
        headers: PRIVATE_ADMIN_API_HEADERS,
      },
      {
        source: "/.well-known/workflow/:path*",
        headers: PRIVATE_ADMIN_API_HEADERS,
      },
    ];
  },
};

export default withWorkflow(nextConfig);
