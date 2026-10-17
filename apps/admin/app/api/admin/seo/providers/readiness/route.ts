import { NextResponse } from "next/server";
import { isPostPublishAdminOriginAllowed } from "@/lib/admin/seo-intelligence/post-publish-origin";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { getGoogleSessionReadiness, hasGoogleSessionGrant } from "@/lib/admin/seo-intelligence/google-session-connection";
import {
  getSeoGoogleProviderReadiness,
  seoGoogleProviderSchema,
} from "@/lib/admin/seo-intelligence/provider-readiness";

export async function GET(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (identity.actorType !== "human" || !hasAdminPermission(identity.role, "seo:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!isPostPublishAdminOriginAllowed(request, process.env, getAdminEnvironment())) {
    return NextResponse.json({ error: "forbidden-origin" }, { status: 403 });
  }
  const provider = seoGoogleProviderSchema.safeParse(new URL(request.url).searchParams.get("provider"));
  if (!provider.success) return NextResponse.json({ error: "invalid-provider" }, { status: 400 });
  const sessionConnection = provider.data === "ga4" && identity.role === "owner"
    && (process.env.CCPUN_APP_ENV === "admin-uat" || hasGoogleSessionGrant(request, process.env))
    ? await getGoogleSessionReadiness(request, identity, process.env) : undefined;
  return NextResponse.json(getSeoGoogleProviderReadiness(provider.data, process.env, sessionConnection), {
    headers: { "Cache-Control": "no-store" },
  });
}
