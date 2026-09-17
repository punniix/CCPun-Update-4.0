import type { NextConfig } from "next";
import path from "node:path";
import { withWorkflow } from "workflow/next";
import { SECURITY_HEADERS } from "../../lib/security-policy";
import { getAdminEnvironment, isSanityLaneAllowed } from "../../lib/admin/environment";

const PRIVATE_SURFACE_ROBOTS_HEADERS = [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }];
const PRIVATE_ADMIN_API_HEADERS = [
  ...PRIVATE_SURFACE_ROBOTS_HEADERS,
  { key: "Cache-Control", value: "private, no-cache, no-store, max-age=0, must-revalidate" },
];
const ADMIN_ENVIRONMENT = getAdminEnvironment();
const SANITY_PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
const SANITY_DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim();
const SANITY_LANE_ALLOWED = isSanityLaneAllowed(SANITY_DATASET, ADMIN_ENVIRONMENT);
const USE_REAL_DRAFT_PREVIEW_RUNTIME = [
  "development",
  "local-uat",
  "local-production",
  "admin-uat",
  "production-admin",
].includes(ADMIN_ENVIRONMENT);
const LOCAL_DIST_DIR = ADMIN_ENVIRONMENT === "local-uat"
  ? ".ccpun-local/next-uat"
  : ADMIN_ENVIRONMENT === "local-production"
    ? ".ccpun-local/next-production"
    : ".next";

const nextConfig: NextConfig = {
  distDir: LOCAL_DIST_DIR,
  env: {
    NEXT_PUBLIC_CCPUN_APP_ENV: ADMIN_ENVIRONMENT === "unknown" ? "" : ADMIN_ENVIRONMENT,
    NEXT_PUBLIC_CCPUN_VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID?.trim() ?? "",
    NEXT_PUBLIC_CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID:
      process.env.CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID?.trim() ?? "",
  },
  trailingSlash: true,
  compress: true,
  turbopack: {
    root: path.resolve(process.cwd(), "../.."),
    resolveAlias: {
      "@/components/preview/DraftPreviewRuntime": USE_REAL_DRAFT_PREVIEW_RUNTIME
        ? "../../components/preview/DraftPreviewRuntime.tsx"
        : "../../components/preview/DraftPreviewRuntimeNoop.tsx",
    },
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
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/api/snt-admin/:path*", destination: "/api/admin/:path*" },
      ],
    };
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...SECURITY_HEADERS, ...PRIVATE_SURFACE_ROBOTS_HEADERS],
      },
      {
        source: "/blog/:path*",
        headers: PRIVATE_ADMIN_API_HEADERS,
      },
      {
        source: "/api/admin/:path*",
        headers: PRIVATE_ADMIN_API_HEADERS,
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
        source: "/api/auth/:path*",
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
