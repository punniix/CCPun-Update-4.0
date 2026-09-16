import { NextResponse } from "next/server";
import { isConfiguredAdminOrigin, isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { getSocialDraftWorkspace, saveSocialDraft, socialDraftRequestSchema } from "@/lib/admin/social/drafts";

function mappedError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "SOCIAL_DRAFT_NOT_FOUND") return { error: "draft-not-found", status: 404 };
  if (code === "SOCIAL_DRAFT_REVISION_CONFLICT") return { error: "revision-conflict", status: 409 };
  if (code === "SOCIAL_DRAFT_MASTER_CONTENT_NOT_APPROVED") return { error: "master-content-not-approved", status: 409 };
  if (code === "SOCIAL_DRAFT_WRITE_NOT_CONFIGURED") return { error: "sanity-write-not-configured", status: 409 };
  if (code === "SOCIAL_DRAFT_UAT_ONLY") return { error: "not-found", status: 404 };
  return { error: "draft-write-failed", status: 503 };
}

async function requireOwner(request: Request, mutation = false) {
  const identity = await getAdminIdentity();
  if (!identity) return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (identity.actorType !== "human" || identity.role !== "owner") {
    return { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  if (!isConfiguredAdminOrigin(request.url, process.env.AUTH_URL)
    || (mutation && !isSameOriginAdminMutation(request.url, request.headers.get("origin")))) {
    return { response: NextResponse.json({ error: "forbidden-origin" }, { status: 403 }) };
  }
  return { identity };
}

export async function GET(request: Request) {
  const authorization = await requireOwner(request);
  if ("response" in authorization) return authorization.response;
  try {
    return NextResponse.json(await getSocialDraftWorkspace(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const mapped = mappedError(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function POST(request: Request) {
  const authorization = await requireOwner(request, true);
  if ("response" in authorization) return authorization.response;
  const parsed = socialDraftRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  try {
    return NextResponse.json({ draft: await saveSocialDraft(parsed.data) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const mapped = mappedError(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
