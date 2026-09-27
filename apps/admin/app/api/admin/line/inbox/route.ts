import { NextResponse } from "next/server";
import { getAdminIdentity } from "@/lib/admin/identity";
import { listAdvisorInboxSafe } from "@/lib/admin/line/control-plane";
import { hasAdminPermission } from "@/lib/admin/rbac";

export const dynamic = "force-dynamic";

const privateHeaders = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export async function GET() {
  const identity = await getAdminIdentity();
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: privateHeaders });
  }
  if (!hasAdminPermission(identity.role, "advisor:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: privateHeaders });
  }

  const result = await listAdvisorInboxSafe();
  return NextResponse.json(result, {
    status: result.unavailableReason ? 503 : 200,
    headers: privateHeaders,
  });
}
