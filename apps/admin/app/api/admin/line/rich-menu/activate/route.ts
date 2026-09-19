import { NextResponse } from "next/server";
import { z } from "zod";

import { isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { loadLineRichMenuV3Asset } from "@/lib/admin/line/rich-menu-asset";
import {
  activateDefaultLineRichMenu,
  getLineRichMenuProviderReadiness,
  readDefaultLineRichMenuStatus,
} from "@/lib/admin/line/rich-menu-provider";
import { getLineSystemDeliveryProviderReadiness } from "@/lib/admin/line/provider";
import { hasAdminPermission } from "@/lib/admin/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

const bodySchema = z.object({
  confirmation: z.literal("activate-ccpun-rich-menu-v3"),
}).strict();

export async function POST(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  if (identity.role !== "owner" || !hasAdminPermission(identity.role, "settings:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  }
  if (!isSameOriginAdminMutation(request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "invalid-origin" }, { status: 403, headers });
  }

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "invalid-request" }, { status: 400, headers });

  const readiness = getLineRichMenuProviderReadiness();
  const systemDelivery = getLineSystemDeliveryProviderReadiness();
  if (
    !readiness.tokenPresent
    || !readiness.providerWriteEnabled
    || !systemDelivery.enabled
    || !systemDelivery.tokenPresent
    || !systemDelivery.cryptoReady
  ) {
    return NextResponse.json({ error: "rich-menu-not-ready" }, { status: 409, headers });
  }

  const current = await readDefaultLineRichMenuStatus();
  if (current.state === "active_v3") {
    return NextResponse.json({ status: "already-active" }, { status: 200, headers });
  }
  if (current.state === "provider_unavailable") {
    return NextResponse.json({ error: "rich-menu-status-unavailable" }, { status: 503, headers });
  }

  try {
    const asset = await loadLineRichMenuV3Asset();
    const result = await activateDefaultLineRichMenu(asset.blob);
    if (result.ok) {
      return NextResponse.json({ status: "assigned" }, { status: 200, headers });
    }
    if (result.status === "not_configured") {
      return NextResponse.json({ error: "rich-menu-not-ready" }, { status: 409, headers });
    }
    if (result.status === "invalid_image") {
      return NextResponse.json({ error: "rich-menu-asset-invalid" }, { status: 500, headers });
    }
    if (result.status === "reconciliation_required") {
      return NextResponse.json({ error: "rich-menu-status-unclear" }, { status: 502, headers });
    }
    return NextResponse.json({ error: "rich-menu-provider-failed" }, { status: 502, headers });
  } catch {
    return NextResponse.json({ error: "rich-menu-activation-unavailable" }, { status: 503, headers });
  }
}
