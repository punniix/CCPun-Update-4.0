import { NextResponse } from "next/server";
import { isConfiguredAdminOrigin } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";
import {
  isSyntheticPostLiveRuntimeEnabled,
  SYNTHETIC_POST_LIVE_REPORT,
} from "@/lib/admin/social/post-live";

export async function GET(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasAdminPermission(identity.role, "social:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!isConfiguredAdminOrigin(request.url, process.env.AUTH_URL)) {
    return NextResponse.json({ error: "forbidden-origin" }, { status: 403 });
  }
  if (!isSyntheticPostLiveRuntimeEnabled(process.env)) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  return NextResponse.json(SYNTHETIC_POST_LIVE_REPORT, {
    headers: { "Cache-Control": "no-store" },
  });
}
