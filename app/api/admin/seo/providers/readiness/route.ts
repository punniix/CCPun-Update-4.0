import { NextResponse } from "next/server";
import { isConfiguredAdminOrigin } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";
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
  if (!isConfiguredAdminOrigin(request.url, process.env.AUTH_URL)) {
    return NextResponse.json({ error: "forbidden-origin" }, { status: 403 });
  }
  const provider = seoGoogleProviderSchema.safeParse(new URL(request.url).searchParams.get("provider"));
  if (!provider.success) return NextResponse.json({ error: "invalid-provider" }, { status: 400 });
  return NextResponse.json(getSeoGoogleProviderReadiness(provider.data), {
    headers: { "Cache-Control": "no-store" },
  });
}
