import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { readAgentRuntimeJobDetail } from "@/lib/admin/operations/agent-os-runtime-detail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  if (!hasAdminPermission(identity.role, "settings:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  }

  const jobId = (await params).jobId;
  if (!z.string().uuid().safeParse(jobId).success) {
    return NextResponse.json({ error: "invalid-job-id" }, { status: 400, headers });
  }

  const result = await readAgentRuntimeJobDetail(jobId);
  if (result.state === "not_found") {
    return NextResponse.json({ error: "not-found" }, { status: 404, headers });
  }
  if (result.state !== "ready" || !result.detail) {
    return NextResponse.json(
      { error: "runtime-unavailable", retryable: true },
      { status: 503, headers: { ...headers, "Retry-After": "5" } },
    );
  }

  return NextResponse.json(result.detail, { headers });
}
