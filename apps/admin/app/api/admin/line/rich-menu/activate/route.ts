import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import {
  readLineRichMenuControlState,
  submitLineRichMenuCommand,
} from "@/lib/admin/control-plane/provider-state";
import { getAdminIdentity } from "@/lib/admin/identity";
import { buildLineRichMenuProviderDefinition } from "@/lib/admin/line/rich-menu-provider";
import { hasAdminPermission } from "@/lib/admin/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

const bodySchema = z.object({
  confirmation: z.literal("activate-ccpun-rich-menu-v3"),
  expectedVersion: z.number().int().positive().optional(),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{15,159}$/).optional(),
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

  const current = await readLineRichMenuControlState().catch(() => null);
  if (!current) return NextResponse.json({ error: "control-plane-unavailable" }, { status: 503, headers });
  const expectedVersion = body.data.expectedVersion ?? current.rowVersion;
  const idempotencyKey = body.data.idempotencyKey ?? `admin:${randomUUID()}`;

  try {
    const result = await submitLineRichMenuCommand({
      command: "reconcile",
      expectedVersion,
      idempotencyKey,
      actor: identity.actor,
      actorType: identity.actorType,
      approvedBy: identity.actor,
      approvalReason: body.data.confirmation,
      definition: buildLineRichMenuProviderDefinition("line-rich-menu-v3"),
    });
    if (result.outcome === "conflict" || result.outcome === "busy" || result.outcome === "idempotency_conflict") {
      return NextResponse.json({ error: result.outcome, resourceVersion: result.resourceVersion }, { status: 409, headers });
    }
    return NextResponse.json({
      status: result.outcome === "duplicate" ? "queued" : result.outcome,
      commandId: result.commandId,
      resourceVersion: result.resourceVersion,
    }, { status: 202, headers });
  } catch {
    return NextResponse.json({ error: "control-command-failed" }, { status: 503, headers });
  }
}
