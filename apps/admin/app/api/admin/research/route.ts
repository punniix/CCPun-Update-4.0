import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { getAdminIdentity } from "@/lib/admin/identity";
import { evaluateAdminAction } from "@/lib/admin/policy";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { createResearchSnapshot, listResearchSnapshots } from "@/lib/admin/research";
import { manualResearchInputSchema } from "@/lib/admin/research-input";

export async function GET() {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasAdminPermission(identity.role, "research:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const result = await listResearchSnapshots();
  if (result.error) return NextResponse.json({ error: result.error }, { status: 503 });
  return NextResponse.json({ rows: result.rows });
}

export async function POST(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const policy = evaluateAdminAction({
    actorType: identity.actorType,
    role: identity.role,
    action: "research:create",
    environment: getAdminEnvironment(),
  });
  if (!policy.allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = manualResearchInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid-input" }, { status: 400 });

  const requestId = randomUUID();
  try {
    const snapshot = await createResearchSnapshot(parsed.data, {
      actor: identity.actor,
      actorType: identity.actorType,
      requestId,
    });
    return NextResponse.json({ id: snapshot._id, trustClass: "untrusted-external-data", requestId }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "research-snapshot-failed", requestId }, { status: 502 });
  }
}
