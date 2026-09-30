import { NextResponse } from "next/server";
import { observeAiCrawlerRequest } from "@/lib/observability/ai-crawler";
import { SECURITY_HEADERS } from "@/lib/security-policy";
import { IS_REVIEW_ENVIRONMENT } from "@/lib/deployment-environment";

export function hostingerRedirectUrl(request: Request): URL | null {
  const url = new URL(request.url);
  const pathname = url.pathname;
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
  for (const [prefix, destination] of [
    ["/living-benefits", "/ci-planning/"],
    ["/tools/fhc", "/tools/financial-health-check/"],
    ["/financial-advisor", "/"],
  ]) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      url.pathname = destination;
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
    vercelRequestId: headers.get("x-vercel-id"),
    cloudflareRay: headers.get("cf-ray"),
  });

  if (process.env.CCPUN_DEPLOYMENT_PROVIDER?.trim().toLowerCase() === "hostinger") {
    const destination = hostingerRedirectUrl(request);
    if (destination) {
      const response = NextResponse.redirect(destination, 308);
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
