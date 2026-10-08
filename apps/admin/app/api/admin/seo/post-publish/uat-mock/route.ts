import { NextResponse } from "next/server";
import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { isPostPublishAdminOriginAllowed } from "@/lib/admin/seo-intelligence/post-publish-origin";
import { isUatPostPublishMockAllowed } from "@/lib/admin/seo-intelligence/post-publish-uat-policy";
import { enqueueUatPostPublishMock, readUatPostPublishMock } from "@/lib/admin/seo-intelligence/post-publish-uat-queue";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" };

async function guard(request: Request) {
  if (getAdminEnvironment() !== "admin-uat" || !isUatPostPublishMockAllowed(process.env))
    return NextResponse.json({ error: "not-found" }, { status: 404, headers: noStore });
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  if (identity.actorType !== "human" || identity.role !== "owner" || !hasAdminPermission(identity.role, "seo:read"))
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: noStore });
  if (!isPostPublishAdminOriginAllowed(request, process.env, "admin-uat"))
    return NextResponse.json({ error: "forbidden-origin" }, { status: 403, headers: noStore });
  return null;
}

export async function GET(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    const receipt = await readUatPostPublishMock();
    return NextResponse.json(receipt ?? { state: "not-found", mock: true }, { status: receipt ? 200 : 404, headers: noStore });
  } catch {
    return NextResponse.json({ error: "uat-mock-queue-unavailable" }, { status: 503, headers: noStore });
  }
}

export async function POST(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  const value = await request.json().catch(() => null);
  if (!value || Object.keys(value).length !== 1 || value.action !== "run-uat-postpublish-mock")
    return NextResponse.json({ error: "invalid-mock-action" }, { status: 400, headers: noStore });
  try {
    // No Sanity mutation; no Production queue; no GSC calls.
    const receipt = await enqueueUatPostPublishMock();
    return NextResponse.json(receipt, { status: 202, headers: noStore });
  } catch {
    return NextResponse.json({ error: "uat-mock-queue-unavailable" }, { status: 503, headers: noStore });
  }
}
