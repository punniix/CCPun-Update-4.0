import { NextResponse } from "next/server";
import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { listSeoSuggestions } from "@/lib/admin/sanity-control";

export async function GET() {
  const identity = await getAdminIdentity();
  if (!identity || !hasAdminPermission(identity.role, "reviews:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const result = await listSeoSuggestions();
  const statusCode = result.error === "request-failed" ? 502 : 200;

  return NextResponse.json(result, { status: statusCode });
}
