import type { NextConfig } from "next";
import path from "node:path";
import { buildNextSecurityHeaders } from "../../lib/runtime/security-headers.mjs";
import { resolveWebEnvironment, isWebSanityLaneAllowed, WEB_REDIRECTS } from "../../lib/runtime/web-build-config.mjs";
import { resolveUatWebAnalytics } from "./analytics-configuration";
const IS_HOSTINGER_DEPLOYMENT =
  process.env.CCPUN_DEPLOYMENT_PROVIDER?.trim().toLowerCase() === "hostinger";
const HOSTINGER_PUBLIC_FALLBACK = "/_next/static/ccpun-public";

const WEB_ENVIRONMENT = resolveWebEnvironment();
const IS_WEB_REVIEW_ENVIRONMENT =
  process.env.CCPUN_UAT_MODE === "1" ||
  WEB_ENVIRONMENT === "web-uat";

const REVIEW_HEADERS = IS_WEB_REVIEW_ENVIRONMENT
  ? [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }]
  : [];
const SANITY_PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
const SANITY_DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim();
const SANITY_LANE_ALLOWED = isWebSanityLaneAllowed(SANITY_PROJECT_ID, SANITY_DATASET, WEB_ENVIRONMENT);
// Only the approved public parity snapshot images can enter the isolated UAT lane.
const UAT_PUBLIC_SNAPSHOT_IMAGES = IS_HOSTINGER_DEPLOYMENT && WEB_ENVIRONMENT === "web-uat"
  && process.env.CCPUN_DEPLOYMENT_ROLE?.trim().toLowerCase() === "web"
  && SANITY_PROJECT_ID === "ccb9lnw5" && SANITY_DATASET === "uat" && SANITY_LANE_ALLOWED;
const UAT_PUBLIC_IMAGE_PATHS = [
  "/images/kyfxgjnq/production/0bdd2a49f0429d2ea92fc199582002ff7f744b6d-1254x1254.png",
  "/images/kyfxgjnq/production/527e8f87fc700e2fb48140635fe0c3013689ddd1-1200x630.png",
  "/images/kyfxgjnq/production/677b4985ae5870b6711823c3f8244ed154806199-1200x630.png",
  "/images/kyfxgjnq/production/7382ab29e298ddbcf144aab913358bffc4d5e8b1-1200x630.png",
  "/images/kyfxgjnq/production/80a14fe1bc84eff63b79099afb64e961fcd6fbbd-1200x630.png",
  "/images/kyfxgjnq/production/8e06c3b1b6ed908cfe003bb3dfcb08456a5eaaeb-2315x3274.jpg",
  "/images/kyfxgjnq/production/8f171baceef0ef7b4726bd126a7a64fd219780a1-1122x1402.png",
  "/images/kyfxgjnq/production/9563caf40b4f12e67b528639a59b713209e636a4-1122x1402.png",
  "/images/kyfxgjnq/production/a3529519a792b88d6e4b211ed4c995f0ed8631c1-1200x630.png",
  "/images/kyfxgjnq/production/b6c6bbefa81e03a161a28b72312d0d8c9e1bb1d9-1200x630.png",
  "/images/kyfxgjnq/production/c5e78011c76c8356e98dd11317d6b330cfa1bd9f-1448x1086.png",
  "/images/kyfxgjnq/production/d07699ac66ee412dd8b8c5ee65b4a950d709dd2d-1200x630.png",
  "/images/kyfxgjnq/production/d799176e1f3107c659e837232ab3a0943a96ecca-1448x1086.png",
  "/images/kyfxgjnq/production/e6079b30fd2e8198ebb26d0f65e35487c63dd639-1122x1402.png",
  "/images/kyfxgjnq/production/e714e01cc55cb206539d8624f5a80761a409a708-1024x1536.png",
  "/images/kyfxgjnq/production/ee01debf22621f663cce28d185cbe8f5e08df08d-1200x630.png",
  "/images/kyfxgjnq/production/f7a6a3bda1b72343db4431a7d8b94dbec1b5874e-1206x505.png",
  "/images/kyfxgjnq/production/ff7625c3062fae141b175a3989fb452ebb9d0807-1024x1536.png"
];
const SECURITY_HEADERS = buildNextSecurityHeaders({
  isReviewEnvironment: IS_WEB_REVIEW_ENVIRONMENT,
  sanityProjectId: SANITY_PROJECT_ID ?? "",
  appEnvironment: WEB_ENVIRONMENT,
});

const nextConfig: NextConfig = {
  ...(IS_HOSTINGER_DEPLOYMENT
    ? {
        output: "standalone" as const,
        // Next's configured 308 redirects discard response headers. Hostinger
        // performs the same normalization in proxy.ts, where headers survive.
        skipTrailingSlashRedirect: true,
        outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
        outputFileTracingIncludes: {
          "/**/*": ["public/**/*", "../../public/**/*"],
        },
      }
    : {}),
  env: {
    NEXT_PUBLIC_CCPUN_APP_ENV: WEB_ENVIRONMENT === "unknown" ? "" : WEB_ENVIRONMENT,
    ...(resolveUatWebAnalytics().gtmId ? { NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED: "true" } : {}),
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
      ...(UAT_PUBLIC_SNAPSHOT_IMAGES ? UAT_PUBLIC_IMAGE_PATHS.map(pathname => ({ protocol: "https" as const, hostname: "cdn.sanity.io", port: "", pathname, search: "" })) : []),
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
    if (!IS_HOSTINGER_DEPLOYMENT) return [];

    return {
      beforeFiles: [
        { source: "/assets/:path*", destination: HOSTINGER_PUBLIC_FALLBACK + "/assets/:path*" },
        { source: "/.well-known/:path*", destination: HOSTINGER_PUBLIC_FALLBACK + "/.well-known/:path*" },
        { source: "/favicon.ico", destination: HOSTINGER_PUBLIC_FALLBACK + "/favicon.ico" },
        { source: "/favicon.png", destination: HOSTINGER_PUBLIC_FALLBACK + "/favicon.png" },
        { source: "/llms.txt", destination: HOSTINGER_PUBLIC_FALLBACK + "/llms.txt" },
        { source: "/nav-config.json", destination: HOSTINGER_PUBLIC_FALLBACK + "/nav-config.json" },
        { source: "/og-image-20260610.webp", destination: HOSTINGER_PUBLIC_FALLBACK + "/og-image-20260610.webp" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async redirects() {
    if (IS_HOSTINGER_DEPLOYMENT) return [];
    return WEB_REDIRECTS.map(({ prefix, destination }) => ({
      source: `${prefix}/:path*`, destination, permanent: true,
    }));
  },
  async headers() {
    return [
      {
        source: "/admin-not-found/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
      {
        source: "/:path*",
        headers: [...SECURITY_HEADERS, ...REVIEW_HEADERS],
      },
    ];
  },
};

export default nextConfig;
