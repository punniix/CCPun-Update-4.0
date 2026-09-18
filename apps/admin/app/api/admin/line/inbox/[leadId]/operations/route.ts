import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { updateAdvisorCaseOperations } from "@/lib/admin/line/advisor-workflow";
import { hasAdminPermission } from "@/lib/admin/rbac";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate", "X-Robots-Tag": "noindex, nofollow, noarchive" };
const safeId = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/);
const bodySchema = z.object({
  assignedAdvisor: z.string().trim().max(200).nullable().optional(),
  priority: z.enum(["low","normal","high","urgent"]).optional(),
  followUpAt: z.string().datetime().nullable().optional(),
  caseState: z.enum(["active","waiting","completed"]).optional(),
  tagAdd: safeId.optional(),
  tagRemove: safeId.optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

export async function POST(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  if (identity.role !== "owner" || !hasAdminPermission(identity.role, "advisor:case:update")) return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  if (!isSameOriginAdminMutation(request.url, request.headers.get("origin"))) return NextResponse.json({ error: "invalid-origin" }, { status: 403, headers });
  const leadId = z.string().uuid().safeParse((await params).leadId);
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!leadId.success || !body.success) return NextResponse.json({ error: "invalid-request" }, { status: 400, headers });
  try {
    const result = await updateAdvisorCaseOperations({ leadId: leadId.data, actor: identity.actor, ...body.data });
    return NextResponse.json(result, { headers });
  } catch {
    return NextResponse.json({ error: "case-operation-unavailable" }, { status: 503, headers });
  }
}
