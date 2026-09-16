import { draftMode } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";

export async function POST(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity || !hasAdminPermission(identity.role, "draft:apply")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const draft = await draftMode();
  draft.disable();
  return NextResponse.redirect(new URL("/blog/", request.url), 303);
}
