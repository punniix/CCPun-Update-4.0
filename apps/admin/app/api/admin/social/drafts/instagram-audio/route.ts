import { NextResponse } from "next/server";
import { z } from "zod";
import { isConfiguredAdminOrigin, isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import {
  instagramAudioConfigurationMutationSchema,
  readSocialInstagramAudioConfiguration,
  saveSocialInstagramAudioConfiguration,
} from "@/lib/admin/social/instagram-audio-config";

const variantQuerySchema = z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9_.:-]+$/);

function mappedError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "SOCIAL_DRAFT_NOT_FOUND") return { error: "draft-not-found", status: 404 };
  if (code === "SOCIAL_AUDIO_REEL_DRAFT_REQUIRED") return { error: "instagram-reel-draft-required", status: 409 };
  if (code === "SOCIAL_DRAFT_REVISION_CONFLICT") return { error: "revision-conflict", status: 409 };
  if (code === "SOCIAL_INSTAGRAM_AUDIO_UNAVAILABLE") return { error: "instagram-audio-unavailable", status: 409 };
  if (["SOCIAL_AUDIO_DRAFT_UNAVAILABLE", "SOCIAL_DRAFT_WRITE_NOT_CONFIGURED"].includes(code)) {
    return { error: "audio-configuration-unavailable", status: 503 };
  }
  if (["META_API_NOT_CONFIGURED", "META_API_SCOPE_REQUIRED"].includes(code)) return { error: "provider-not-configured", status: 409 };
  if (["META_PAGE_SELECTION_REQUIRED", "META_INSTAGRAM_ACCOUNT_REQUIRED"].includes(code)) return { error: "provider-account-required", status: 409 };
  if (code === "META_API_AUTH_REQUIRED") return { error: "provider-auth-required", status: 401 };
  if (code === "META_API_RATE_LIMITED") return { error: "provider-rate-limited", status: 429 };
  return { error: "audio-configuration-failed", status: 503 };
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
  const url = new URL(request.url);
  const variantId = variantQuerySchema.safeParse(url.searchParams.get("variantId"));
  if (!variantId.success) return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  try {
    return NextResponse.json(
      { audio: await readSocialInstagramAudioConfiguration(variantId.data) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const mapped = mappedError(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  const authorization = await requireOwner(request, true);
  if ("response" in authorization) return authorization.response;
  const parsed = instagramAudioConfigurationMutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  try {
    return NextResponse.json(
      { audio: await saveSocialInstagramAudioConfiguration({ mutation: parsed.data }) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const mapped = mappedError(error);
    return NextResponse.json(
      { error: mapped.error },
      { status: mapped.status, headers: { "Cache-Control": "no-store", ...(mapped.status === 429 ? { "Retry-After": "60" } : {}) } },
    );
  }
}
