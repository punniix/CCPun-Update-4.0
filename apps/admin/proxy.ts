import { NextResponse, type NextRequest } from "next/server";
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
import {
  classifyProductionAdminPath,
  isAdminRequestBoundary,
  isAuthenticatedAdminPreviewPath,
  isExactAdminPreviewOrigin,
  isInternalServiceApiPath,
} from "@/lib/admin/host-routing";
import {
  isAdminApiPath,
  isAdminPagePath,
  ADMIN_NOT_FOUND_PATH,
  legacyAdminPageDestination,
  safeAdminReturnPath,
} from "@/lib/admin/routes";
import { observeAiCrawlerRequest } from "@/lib/observability/ai-crawler";
import { adminCapabilityLandingPath, getAdminCapabilityProfile, isAdminCapabilityPathAllowed, safeAdminCapabilityReturnPath } from "@/lib/admin/capability-profile";
import { SECURITY_HEADERS } from "@/lib/security-policy";
import type { AdminRole } from "@/lib/admin/rbac";
import { nativeWorkflowTransportDisposition } from "@/lib/admin/workflow-transport-boundary";

function nativeWorkflowResponse(request: NextRequest) {
  const disposition = nativeWorkflowTransportDisposition(request);
  if (disposition === "unrelated") return null;
  if (disposition === "allow") return NextResponse.next();
  return new NextResponse("Not Found", { status: 404, headers: {
    ...Object.fromEntries(SECURITY_HEADERS.map(({ key, value }) => [key, value])),
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  } });
}

export function adminProxy(request: NextRequest & { auth?: { user?: { role?: AdminRole | null } } | null }) {
  const workflowResponse = nativeWorkflowResponse(request);
  if (workflowResponse) return workflowResponse;
  const { pathname } = request.nextUrl;
  const capabilityProfile = getAdminCapabilityProfile();
  const landingPath = adminCapabilityLandingPath(capabilityProfile);
  // This must precede internal-service exemptions, aliases and browser auth.
  if (!isAdminCapabilityPathAllowed(pathname, capabilityProfile)) {
    return new NextResponse("Not Found", { status: 404, headers: {
      ...Object.fromEntries(SECURITY_HEADERS.map(({ key, value }) => [key, value])),
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    } });
  }
  // Preserve Vercel's full-profile transport. Native Postgres requests must
  // pass the separate raw-request fence and private network perimeter.
  if (capabilityProfile === "full" && pathname.startsWith("/.well-known/workflow/")) return NextResponse.next();
  if (capabilityProfile === "editorial") {
    // Auth.js may rewrite request.url to AUTH_URL. Validate the actual ingress
    // Host too, so that rewrite cannot authorize an unknown request hostname.
    let configuredHost: string;
    try { configuredHost = new URL(process.env.AUTH_URL ?? "").host.toLowerCase(); }
    catch { return new NextResponse("Not Found", { status: 404 }); }
    const host = request.headers.get("host")?.trim().toLowerCase();
    const forwardedHost = request.headers.get("x-forwarded-host")?.trim().toLowerCase();
    if (host !== configuredHost || (forwardedHost && forwardedHost !== configuredHost)) return new NextResponse("Not Found", { status: 404 });
  }

  observeAiCrawlerRequest({
    userAgent: request.headers.get("user-agent"),
    pathname,
    method: request.method,
    requestId: request.headers.get("x-request-id"),
    vercelRequestId: request.headers.get("x-vercel-id"),
    cloudflareRay: request.headers.get("cf-ray"),
  });

  const environment = getAdminEnvironment();
  const adminSurfaceAllowed = isAdminSurfaceAllowed(environment);
  const isProductionAdmin = environment === "production-admin";
  const isAdminUat = environment === "admin-uat";
  const isDeployedAdmin = isProductionAdmin || isAdminUat;
  const isLocalUat = environment === "local-uat";
  const isLocalProduction = environment === "local-production";
  const isDedicatedAdmin = isDeployedAdmin || isLocalUat || isLocalProduction;
  const isAdminBoundaryRequest = isAdminRequestBoundary({
    environment,
    vercelEnvironment: process.env.VERCEL_ENV,
    deploymentProjectId: process.env.VERCEL_PROJECT_ID,
    host: request.headers.get("host"),
  });
  const isAdminPage = isAdminPagePath(pathname);
  const isAdminApi = isAdminApiPath(pathname);
  const legacyPageDestination = legacyAdminPageDestination(pathname);
  const isStudioPage = pathname.startsWith("/studio");
  const isPreviewApi = pathname.startsWith("/api/preview");
  const isAuthApi = pathname === "/api/auth" || pathname.startsWith("/api/auth/");
  const isInternalServiceApi = isInternalServiceApiPath(pathname);
  const isPublicBootstrapPath =
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/_next/image") ||
    pathname.startsWith("/favicon.") ||
    pathname === "/robots.txt";
  const isLoginPage = pathname === "/login" || pathname === "/login/";
  const isAdminNotFoundPage =
    pathname === ADMIN_NOT_FOUND_PATH || pathname === `${ADMIN_NOT_FOUND_PATH}/`;
  const role = request.auth?.user?.role ?? null;
  const isInvalidAdminMutation =
    (isAdminApi || isPreviewApi) &&
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    !isSameOriginAdminMutation(request.url, request.headers.get("origin"));

  if (isAdminBoundaryRequest) {
    if (!adminSurfaceAllowed) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const originAllowed = isLocalUat || isLocalProduction
      ? isLocalAdminHost(request.headers.get("host"), environment)
      : isExactAdminPreviewOrigin({
          environment,
          vercelEnvironment: process.env.VERCEL_ENV,
          deploymentProjectId: process.env.VERCEL_PROJECT_ID,
          host: request.headers.get("host"),
        }) || isConfiguredAdminOrigin(request.url, process.env.AUTH_URL);
    if (!originAllowed) {
      return new NextResponse("Not Found", { status: 404 });
    }

    if (isAdminNotFoundPage) {
      return NextResponse.next({ status: 404 });
    }

    if (isDedicatedAdmin) {
      const disposition = classifyProductionAdminPath(pathname);
      if (disposition === "entry") {
        return NextResponse.redirect(
          new URL(role ? landingPath : "/login/", request.url),
        );
      }
      if (disposition === "reject") {
        const authenticatedPreviewSurface = Boolean(role) && isAuthenticatedAdminPreviewPath(pathname);
        if (!authenticatedPreviewSurface) {
          return NextResponse.rewrite(new URL(`${ADMIN_NOT_FOUND_PATH}/`, request.url), { status: 404 });
        }
      }
    }

    if (isInvalidAdminMutation) {
      return NextResponse.json({ error: "invalid-origin" }, { status: 403 });
    }
    if (
      request.method === "POST" &&
      /^\/api\/admin\/content\/[^/]+\/preview\/$/.test(pathname)
    ) {
      const canonicalPreviewUrl = request.nextUrl.clone();
      canonicalPreviewUrl.pathname = pathname.slice(0, -1);
      return NextResponse.rewrite(canonicalPreviewUrl);
    }
    // These exact service routes authenticate inside their handlers with
    // purpose-specific bearer/capability contracts, not browser Auth.js.
    if (isAuthApi || isPublicBootstrapPath || isInternalServiceApi) return NextResponse.next();
    if (legacyPageDestination) {
      const destination = new URL(legacyPageDestination, request.url);
      destination.search = request.nextUrl.search;
      if (!role && legacyPageDestination !== "/login/") {
        const loginUrl = new URL("/login/", request.url);
        loginUrl.searchParams.set("callbackUrl", `${legacyPageDestination}${request.nextUrl.search}`);
        return NextResponse.redirect(loginUrl);
      }
      return NextResponse.redirect(role && legacyPageDestination === "/login/"
        ? new URL(landingPath, request.url)
        : destination);
    }
    if (isLoginPage) {
      if (role) return NextResponse.redirect(new URL(landingPath, request.url));
      return NextResponse.next();
    }
    if (!role) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
      const loginUrl = new URL("/login/", request.url);
      const callbackUrl = capabilityProfile === "full" ? safeAdminReturnPath(`${pathname}${request.nextUrl.search}`) : safeAdminCapabilityReturnPath(`${pathname}${request.nextUrl.search}`, capabilityProfile);
      if (callbackUrl) loginUrl.searchParams.set("callbackUrl", callbackUrl);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  if (!isAdminPage && !isAdminApi && !isStudioPage && !isPreviewApi && !isAuthApi) return NextResponse.next();
  if (isProductionEnvironment() || !adminSurfaceAllowed) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (isInvalidAdminMutation) {
    return NextResponse.json({ error: "invalid-origin" }, { status: 403 });
  }

  if (isLoginPage) {
    if (role) return NextResponse.redirect(new URL(landingPath, request.url));
    return NextResponse.next();
  }

  if (!role) {
    if (isAdminApi || isPreviewApi) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login/", request.url);
    const callbackUrl = capabilityProfile === "full" ? safeAdminReturnPath(`${pathname}${request.nextUrl.search}`) : safeAdminCapabilityReturnPath(`${pathname}${request.nextUrl.search}`, capabilityProfile);
    if (callbackUrl) loginUrl.searchParams.set("callbackUrl", callbackUrl);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

const authenticatedAdminProxy = auth(adminProxy);

export default function proxy(...args: Parameters<typeof authenticatedAdminProxy>) {
  // Auth.js can rewrite URL to AUTH_URL. Native Workflow must be classified
  // before that wrapper and without reading its body or a browser session.
  const workflowResponse = nativeWorkflowResponse(args[0]);
  return workflowResponse ?? authenticatedAdminProxy(...args);
}

export const config = {
  matcher: [
    // Root must always reach the environment/project boundary so a dedicated
    // Admin application can never fall through to the public homepage.
    "/",
    // Native candidate domains and unknown APIs also reach the profile fence.
    "/:path*",
    "/login/:path*",
    "/dashboard/:path*",
    "/content/:path*",
    "/seo/:path*",
    "/social/:path*",
    "/analytics/:path*",
    "/operations/:path*",
    "/settings/:path*",
    "/admin-not-found/:path*",
    "/snt-admin/:path*",
    "/api/admin/:path*",
    "/api/snt-admin/:path*",
    "/studio/:path*",
    "/api/preview/:path*",
    "/api/auth/:path*",
    // Vercel transport does not use a browser Auth.js session. Native transport
    // is constrained by the outer request fence and a private ingress perimeter.
    // The owner-facing API matchers above remain unchanged.
    { source: "/((?!\\.well-known/workflow/).*)", has: [{ type: "host", value: "ccpun-admin-prod.vercel.app" }] },
    { source: "/((?!\\.well-known/workflow/).*)", has: [{ type: "host", value: "ccpun-admin.vercel.app" }] },
    { source: "/((?!\\.well-known/workflow/).*)", has: [{ type: "host", value: "admin.ccpun.com" }] },
    { source: "/((?!\\.well-known/workflow/).*)", has: [{ type: "host", value: "localhost" }] },
    // Generated Vercel aliases must enter the environment/project boundary too.
    // Only the immutable Admin project may resolve Preview to the Admin UAT lane.
    { source: "/((?!\\.well-known/workflow/).*)", has: [{ type: "host", value: "ccpun-admin(?:-.+)?\\.vercel\\.app" }] },
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
