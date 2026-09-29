import type { NextConfig } from "next";
import path from "node:path";
type WebEnvironment = "development" | "web-uat" | "production" | "unknown";
const WEB_VERCEL_PROJECT_ID = "prj_dxwjITkd0av5QiJQv2snUlIASUWu";

function parseWebEnvironment(value: string | undefined): WebEnvironment {
  const normalized = value?.trim().toLowerCase();
  return normalized === "development" || normalized === "web-uat" || normalized === "production"
    ? normalized
    : "unknown";
}

function resolveWebEnvironment(): WebEnvironment {
  const explicit = process.env.CCPUN_APP_ENV?.trim();
  if (explicit) return parseWebEnvironment(explicit);

  const vercelEnvironment = process.env.VERCEL_ENV?.trim().toLowerCase();
  const deploymentProjectId = process.env.VERCEL_PROJECT_ID?.trim();
  if (vercelEnvironment === "production" && deploymentProjectId === WEB_VERCEL_PROJECT_ID) return "production";
  if (vercelEnvironment === "preview" && deploymentProjectId === WEB_VERCEL_PROJECT_ID) return "web-uat";
  if (!deploymentProjectId) return "development";
  return "unknown";
}

const WEB_ENVIRONMENT = resolveWebEnvironment();
const IS_WEB_REVIEW_ENVIRONMENT =
  process.env.CCPUN_UAT_MODE === "1" ||
  WEB_ENVIRONMENT === "web-uat";

function isWebSanityLaneAllowed(
  projectId: string | undefined,
  dataset: string | undefined,
  environment: WebEnvironment = WEB_ENVIRONMENT,
): boolean {
  const expected = environment === "production"
    ? { projectId: "kyfxgjnq", dataset: "production" }
    : environment === "development" || environment === "web-uat"
      ? { projectId: "ccb9lnw5", dataset: "uat" }
      : null;
  if (!expected || projectId?.trim() !== expected.projectId || dataset?.trim() !== expected.dataset) return false;

  const provider = process.env.CCPUN_DEPLOYMENT_PROVIDER?.trim().toLowerCase();
  const role = process.env.CCPUN_DEPLOYMENT_ROLE?.trim().toLowerCase();
  const deploymentProjectId = process.env.VERCEL_PROJECT_ID?.trim();

  if (provider === "hostinger") return role === "web" && !deploymentProjectId;
  if (provider === "local") return environment === "development" && !deploymentProjectId;
  if (provider && provider !== "vercel") return false;
  if (deploymentProjectId) return deploymentProjectId === WEB_VERCEL_PROJECT_ID;
  return environment === "development";
}

function buildNextSecurityHeaders({
  isReviewEnvironment = false,
  sanityProjectId = "",
  nodeEnv = process.env.NODE_ENV,
  appEnvironment = process.env.CCPUN_APP_ENV,
}: {
  isReviewEnvironment?: boolean;
  sanityProjectId?: string;
  nodeEnv?: string;
  appEnvironment?: string;
} = {}) {
  const isDevelopment = nodeEnv === "development";
  const enforceHttps = appEnvironment !== "local-uat" && appEnvironment !== "local-production";
  const sanityReviewScriptSources = isReviewEnvironment
    ? " https://core.sanity-cdn.com"
    : "";
  const sanityConnectSources = /^[a-z0-9]+$/.test(sanityProjectId)
    ? ` https://${sanityProjectId}.api.sanity.io wss://${sanityProjectId}.api.sanity.io`
    : "";
  const sanityReviewConnectSources = isReviewEnvironment
    ? " https://sanity-cdn.com https://*.sanity-cdn.com"
    : "";

  const policy = [
    ...(enforceHttps ? ["upgrade-insecure-requests"] : []),
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com https://connect.facebook.net https://static.cloudflareinsights.com https://*.cloudflare.com https://apis.google.com https://accounts.google.com${sanityReviewScriptSources}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    `connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://connect.facebook.net https://www.facebook.com https://static.cloudflareinsights.com https://fonts.googleapis.com https://fonts.gstatic.com https://lead-proxy.ccpun.com https://www.googleapis.com https://accounts.google.com${sanityConnectSources}${sanityReviewConnectSources}`,
    "frame-src 'self' https://www.facebook.com https://accounts.google.com https://docs.google.com",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://www.facebook.com",
  ].join("; ");

  return [
    { key: "Content-Security-Policy", value: policy },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
    ...(enforceHttps
      ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
      : []),
  ];
}

const REVIEW_HEADERS = IS_WEB_REVIEW_ENVIRONMENT
  ? [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }]
  : [];
const SANITY_PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
const SANITY_DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim();
const SANITY_LANE_ALLOWED = isWebSanityLaneAllowed(SANITY_PROJECT_ID, SANITY_DATASET);
const SECURITY_HEADERS = buildNextSecurityHeaders({
  isReviewEnvironment: IS_WEB_REVIEW_ENVIRONMENT,
  sanityProjectId: SANITY_PROJECT_ID ?? "",
  appEnvironment: WEB_ENVIRONMENT,
});

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
