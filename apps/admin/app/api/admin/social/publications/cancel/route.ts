import { NextResponse } from "next/server";
import { isConfiguredAdminOrigin, isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { cancelSocialPublication, socialOperationMutationSchema } from "@/lib/admin/social/operations-service";

function mappedError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "SOCIAL_PUBLICATION_NOT_FOUND") return { error: "publication-not-found", status: 404 };
  if (code === "SOCIAL_OPERATION_CAS_CONFLICT") return { error: "job-version-conflict", status: 409 };
  if (code === "SOCIAL_CANCEL_NOT_ALLOWED") return { error: "cancel-not-allowed", status: 409 };
  if (code === "SOCIAL_OPERATIONS_NOT_CONFIGURED" || code === "SOCIAL_OPERATIONS_DATABASE_NOT_READY") {
    return { error: "social-operations-unavailable", status: 503 };
  }
  return { error: "cancel-failed", status: 500 };
}

export async function POST(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (identity.actorType !== "human" || identity.role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!isConfiguredAdminOrigin(request.url, process.env.AUTH_URL)
    || !isSameOriginAdminMutation(request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "forbidden-origin" }, { status: 403 });
  }
  const parsed = socialOperationMutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid-request" }, { status: 400 });

  try {
    const result = await cancelSocialPublication({ mutation: parsed.data, actor: identity.actor });
    return NextResponse.json({ result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const mapped = mappedError(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status, headers: { "Cache-Control": "no-store" } });
  }
}
