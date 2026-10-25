import { NextResponse } from "next/server";

import { isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { readLineChatAdminModel, saveLineChatConfig } from "@/lib/admin/line/chat-config";
import { hasAdminPermission } from "@/lib/admin/rbac";

// LINE chat button settings (owner-approved 2026-10-25). Same access contract as LINE Discovery:
// GET needs settings:read; PUT is owner-only, same-origin, JSON and size-bounded.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export async function GET() {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  if (!hasAdminPermission(identity.role, "settings:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  }

  try {
    return NextResponse.json(await readLineChatAdminModel(), { headers });
  } catch {
    return NextResponse.json({ error: "line-chat-unavailable" }, { status: 503, headers });
  }
}

export async function PUT(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  if (identity.role !== "owner" || !hasAdminPermission(identity.role, "settings:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  }
  if (!isSameOriginAdminMutation(request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "invalid-origin" }, { status: 403, headers });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "unsupported-media-type" }, { status: 415, headers });
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > 65_536) {
    return NextResponse.json({ error: "payload-too-large" }, { status: 413, headers });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid-request" }, { status: 400, headers });
  }

  try {
    const result = await saveLineChatConfig(body, identity.actor);
    return NextResponse.json({ status: "saved", revision: result.revision, config: result.config }, { headers });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "LINE_CHAT_INVALID") return NextResponse.json({ error: "invalid-request" }, { status: 400, headers });
    if (code === "LINE_CHAT_IMMUTABLE") return NextResponse.json({ error: "immutable-key" }, { status: 409, headers });
    if (code === "LINE_CHAT_STALE") return NextResponse.json({ error: "stale-revision" }, { status: 409, headers });
    if (code === "LINE_CHAT_WRITE_UNAVAILABLE") return NextResponse.json({ error: "write-not-ready" }, { status: 503, headers });
    if (code === "LINE_CHAT_HISTORY_UNAVAILABLE") return NextResponse.json({ error: "history-unavailable" }, { status: 503, headers });
    return NextResponse.json({ error: "line-chat-save-unavailable" }, { status: 503, headers });
  }
}
