import { NextResponse } from "next/server";
import { observeAiCrawlerRequest } from "@/lib/observability/ai-crawler";
import { SECURITY_HEADERS } from "@/lib/security-policy";
import { IS_REVIEW_ENVIRONMENT } from "@/lib/deployment-environment";

import { TAX_SLUG_MIGRATION, WEB_REDIRECTS } from "../../lib/runtime/web-build-config.mjs";

export function hostingerRedirectUrl(request: Request): URL | null {
  const url = new URL(request.url);
  const pathname = url.pathname;
  // Permanent redirects match the slash-normalised path before the trailing-slash
  // 308, so a slashless legacy URL reaches its final URL in one hop.
  const normalizedPathname = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  for (const { prefix, destination } of WEB_REDIRECTS) {
    if (normalizedPathname === prefix || normalizedPathname.startsWith(`${prefix}/`)) {
      url.pathname = destination;
      return url;
    }
  }
  // Match Next's trailingSlash rules, including .well-known and data requests.
  if (!pathname.startsWith("/.well-known/") && pathname !== "/.well-known") {
    if (!request.headers.has("x-nextjs-data") && /\/[^/]+\.\w+\/$/.test(pathname)) {
      url.pathname = pathname.slice(0, -1);
      return url;
    }
    if (/\/[^/.]+$/.test(pathname)) {
      url.pathname = `${pathname}/`;
      return url;
    }
  }
  return null;
}

export default function proxy(request: Request & { nextUrl: URL }) {
  const pathname = new URL(request.url).pathname;
  const headers = request.headers;

  observeAiCrawlerRequest({
    userAgent: headers.get("user-agent"),
    pathname,
    method: request.method,
    requestId: headers.get("x-request-id"),
    cloudflareRay: headers.get("cf-ray"),
  });

  if (process.env.CCPUN_DEPLOYMENT_PROVIDER?.trim().toLowerCase() === "hostinger") {
    const destination = hostingerRedirectUrl(request);
    if (destination) {
      // Preserve the original 301 contract for the published tax URL migration.
      // Other Hostinger redirects retain their existing 308 semantics.
      const isTaxSlugMigration = pathname === TAX_SLUG_MIGRATION
        || pathname.startsWith(`${TAX_SLUG_MIGRATION}/`);
      const response = NextResponse.redirect(destination, isTaxSlugMigration ? 301 : 308);
      for (const { key, value } of SECURITY_HEADERS) response.headers.set(key, value);
      if (IS_REVIEW_ENVIRONMENT) response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  // Static matchers cannot depend on the provider. Vercel now invokes this tiny
  // proxy on every request; its configured redirects and response stay intact.
  matcher: ["/:path*"],
};
