import type { NextConfig } from "next";
import path from "node:path";
import { buildNextSecurityHeaders } from "../../lib/runtime/security-headers.mjs";
import { resolveWebEnvironment, isWebSanityLaneAllowed, WEB_REDIRECTS } from "../../lib/runtime/web-build-config.mjs";
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
const SECURITY_HEADERS = buildNextSecurityHeaders({
  isReviewEnvironment: IS_WEB_REVIEW_ENVIRONMENT,
  sanityProjectId: SANITY_PROJECT_ID ?? "",
  appEnvironment: WEB_ENVIRONMENT,
});

// Public, non-secret Production Web tracking identity (GTM-5DKMGSK3 lives in the
// layout). Vercel supplied these as NEXT_PUBLIC_* project variables; the Hostinger
// cutover dropped them, which silently unmounted the GA/LINE listener and moved
// trackEvent off the GTM semantic `ccpun_event` contract. NEXT_PUBLIC_* values are
// inlined at build time, so the Production analytics lane owns them here.
const PRODUCTION_WEB_PUBLIC_ANALYTICS = {
  NEXT_PUBLIC_GA_ID: "G-5BMX2SKJLZ",
  NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED: "true",
};
function resolveProductionWebPublicAnalytics() {
  if (WEB_ENVIRONMENT !== "production"
    || process.env.CCPUN_DEPLOYMENT_ROLE?.trim().toLowerCase() !== "web"
    || process.env.CCPUN_ENABLE_PRODUCTION_ANALYTICS !== "1") return {};
  for (const [key, expected] of Object.entries(PRODUCTION_WEB_PUBLIC_ANALYTICS)) {
    const explicit = process.env[key]?.trim();
    if (explicit && explicit !== expected) throw new Error(`PRODUCTION_WEB_PUBLIC_ANALYTICS_CONFLICT: ${key}`);
  }
  if (!/^\d{5,20}$/.test(process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "")) {
    console.warn("NEXT_PUBLIC_META_PIXEL_ID is not set: Meta Pixel stays disabled on Production tool pages.");
  }
  return { ...PRODUCTION_WEB_PUBLIC_ANALYTICS };
}

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
    ...resolveProductionWebPublicAnalytics(),
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
