import { NextResponse } from "next/server";
import { isConfiguredAdminOrigin } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { getSeoIntelligenceRuntimeStatus, getSyntheticSeoIntelligenceSnapshot } from "@/lib/admin/seo-intelligence/foundation";

export async function GET(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasAdminPermission(identity.role, "seo:read")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isConfiguredAdminOrigin(request.url, process.env.AUTH_URL)) return NextResponse.json({ error: "forbidden-origin" }, { status: 403 });
  if (!getSeoIntelligenceRuntimeStatus().enabled) return NextResponse.json({ error: "not-found" }, { status: 404 });

  return NextResponse.json(getSyntheticSeoIntelligenceSnapshot(), { headers: { "Cache-Control": "no-store" } });
}
