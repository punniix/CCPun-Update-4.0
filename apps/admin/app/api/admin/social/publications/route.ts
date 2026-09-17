import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isConfiguredAdminOrigin, isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";
import {
  approveSocialPublication,
  listApprovedSocialVariants,
  socialPublicationApprovalRequestSchema,
} from "@/lib/admin/social/publishing-store";
import { isSocialPublicationApprovalEnabled } from "@/lib/admin/social/publishing";

function mappedError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "SOCIAL_VARIANT_NOT_FOUND") return { error: "variant-not-found", status: 404 };
  if (code === "SOCIAL_VARIANT_NOT_APPROVED_OR_UNSUPPORTED") return { error: "variant-not-approved-or-unsupported", status: 409 };
  if (code === "SOCIAL_PUBLICATION_REVISION_CONFLICT") return { error: "revision-conflict", status: 409 };
  if (["SOCIAL_PUBLICATION_APPROVAL_NOT_CONFIGURED", "SOCIAL_PUBLICATION_APPROVAL_IDENTITY_MISMATCH"].includes(code)) {
    return { error: "database-not-ready", status: 409 };
  }
  if (code === "SOCIAL_SANITY_READ_NOT_CONFIGURED") return { error: "sanity-read-not-configured", status: 409 };
  return { error: "approval-failed", status: 503 };
}

export async function GET(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (identity.actorType !== "human" || !hasAdminPermission(identity.role, "social:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!isConfiguredAdminOrigin(request.url, process.env.AUTH_URL)) {
    return NextResponse.json({ error: "forbidden-origin" }, { status: 403 });
  }
  if (!isSocialPublicationApprovalEnabled()) return NextResponse.json({ error: "not-found" }, { status: 404 });
  try {
    return NextResponse.json(
      { variants: await listApprovedSocialVariants() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const mapped = mappedError(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
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
  if (!isSocialPublicationApprovalEnabled()) return NextResponse.json({ error: "not-found" }, { status: 404 });

  const parsed = socialPublicationApprovalRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  const requestId = randomUUID();
  try {
    const result = await approveSocialPublication({ request: parsed.data, actor: identity.actor, requestId });
    return NextResponse.json({ requestId, publication: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const mapped = mappedError(error);
    return NextResponse.json({ error: mapped.error, requestId }, { status: mapped.status });
  }
}
