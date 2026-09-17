import { defineEnableDraftMode } from "next-sanity/draft-mode";
import { NextResponse } from "next/server";
import { IS_DRAFT_PREVIEW_ALLOWED } from "@/lib/deployment-environment";
import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { getSanityPreviewClient, hasSanityConfig } from "@/lib/content/sanity";
import { getAdminSanityReadToken } from "@/lib/admin/sanity-credentials";

export const dynamic = "force-dynamic";

const enabledHandler =
  IS_DRAFT_PREVIEW_ALLOWED && hasSanityConfig && getAdminSanityReadToken()
    ? defineEnableDraftMode({ client: getSanityPreviewClient() }).GET
    : null;

export async function GET(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity || !hasAdminPermission(identity.role, "draft:apply")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!enabledHandler) return new NextResponse("Not Found", { status: 404 });
  try {
    return await enabledHandler(request);
  } catch (error) {
    const digest = typeof error === "object" && error && "digest" in error ? String(error.digest) : "";
    if (digest.startsWith("NEXT_REDIRECT")) throw error;
    return new NextResponse("Preview unavailable", { status: 503 });
  }
}
