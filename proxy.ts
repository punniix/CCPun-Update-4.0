import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  isConfiguredAdminOrigin,
  isLocalAdminHost,
  isSameOriginAdminMutation,
} from "@/lib/admin/auth-config";
import {
  getAdminEnvironment,
  isAdminSurfaceAllowed,
  isProductionEnvironment,
} from "@/lib/admin/environment";
import { observeAiCrawlerRequest } from "@/lib/observability/ai-crawler";

export default auth((request) => {
  const { pathname } = request.nextUrl;

  observeAiCrawlerRequest({
    userAgent: request.headers.get("user-agent"),
    pathname,
    method: request.method,
    vercelRequestId: request.headers.get("x-vercel-id"),
    cloudflareRay: request.headers.get("cf-ray"),
  });

  const environment = getAdminEnvironment();
  const adminSurfaceAllowed = isAdminSurfaceAllowed(environment);
  const isProductionAdmin = environment === "production-admin";
  const isLocalUat = environment === "local-uat";
  const isLocalProduction = environment === "local-production";
  const isAdminPage = pathname.startsWith("/snt-admin");
  const isAdminApi = pathname.startsWith("/api/snt-admin");
  const isStudioPage = pathname.startsWith("/studio");
  const isPreviewApi = pathname.startsWith("/api/preview");
  const isAuthApi = pathname === "/api/auth" || pathname.startsWith("/api/auth/");
  const isPublicBootstrapPath =
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/_next/image") ||
    pathname.startsWith("/favicon.") ||
    pathname === "/robots.txt";
  const isLoginPage = pathname === "/snt-admin/login" || pathname === "/snt-admin/login/";
  const role = request.auth?.user?.role ?? null;
  const isInvalidAdminMutation =
    (isAdminApi || isPreviewApi) &&
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    !isSameOriginAdminMutation(request.url, request.headers.get("origin"));

  if (isProductionAdmin || isLocalUat || isLocalProduction) {
    if (!adminSurfaceAllowed) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const originAllowed = isLocalUat || isLocalProduction
      ? isLocalAdminHost(request.headers.get("host"), environment)
      : isConfiguredAdminOrigin(request.url, process.env.AUTH_URL);
    if (!originAllowed) {
      return new NextResponse("Not Found", { status: 404 });
    }
    if (isInvalidAdminMutation) {
      return NextResponse.json({ error: "invalid-origin" }, { status: 403 });
    }
    if (isAuthApi || isPublicBootstrapPath) return NextResponse.next();
    if (isLoginPage) {
      if (role) return NextResponse.redirect(new URL("/snt-admin/dashboard/", request.url));
      return NextResponse.next();
    }
    if (!role) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/snt-admin/login/", request.url));
    }
    return NextResponse.next();
  }

  if (!isAdminPage && !isAdminApi && !isStudioPage && !isPreviewApi) return NextResponse.next();
  if (isProductionEnvironment() || !adminSurfaceAllowed) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (isInvalidAdminMutation) {
    return NextResponse.json({ error: "invalid-origin" }, { status: 403 });
  }

  if (isLoginPage) {
    if (role) return NextResponse.redirect(new URL("/snt-admin/dashboard/", request.url));
    return NextResponse.next();
  }

  if (!role) {
    if (isAdminApi || isPreviewApi) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/snt-admin/login/", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/snt-admin/:path*",
    "/api/snt-admin/:path*",
    "/studio/:path*",
    "/api/preview/:path*",
    "/api/auth/:path*",
    // Workflow's signed internal transport does not use a browser Auth.js session.
    // The owner-facing API matchers above remain unchanged.
    { source: "/((?!\\.well-known/workflow/).*)", has: [{ type: "host", value: "ccpun-admin-prod.vercel.app" }] },
    { source: "/((?!\\.well-known/workflow/).*)", has: [{ type: "host", value: "ccpun-admin.vercel.app" }] },
    { source: "/((?!\\.well-known/workflow/).*)", has: [{ type: "host", value: "admin.ccpun.com" }] },
    {
      source: "/((?!\\.well-known/workflow/).*)",
      has: [
        {
          type: "header",
          key: "user-agent",
          value: "(GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|Claude-SearchBot|Claude-User|PerplexityBot|Perplexity-User|Google-CloudVertexBot|Bytespider|CCBot|meta-externalagent|meta-externalfetcher|FacebookBot|Applebot|Amazonbot|DuckAssistBot|MistralAI-User)",
        },
      ],
    },
  ],
};
