import { NextResponse } from "next/server";
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

const commandSchema = z.object({
  resource: z.literal("line.rich_menu.default"),
  command: z.enum(["hold", "reconcile", "rollback"]),
  expectedVersion: z.number().int().positive(),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{15,159}$/),
  confirmation: z.enum([
    "hold-line-rich-menu-reconciliation",
    "activate-ccpun-rich-menu-v3",
    "restore-approved-previous-rich-menu",
  ]),
}).strict().superRefine((value, context) => {
  const expected = {
    hold: "hold-line-rich-menu-reconciliation",
    reconcile: "activate-ccpun-rich-menu-v3",
    rollback: "restore-approved-previous-rich-menu",
  } as const;
  if (value.confirmation !== expected[value.command]) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["confirmation"], message: "confirmation mismatch" });
  }
});

export async function GET() {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  if (!hasAdminPermission(identity.role, "settings:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  }
  const state = await readLineRichMenuControlState().catch(() => null);
  return state
    ? NextResponse.json({ resource: state }, { headers })
    : NextResponse.json({ error: "control-plane-unavailable" }, { status: 503, headers });
}

export async function POST(request: Request) {
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

  const body = commandSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "invalid-request" }, { status: 400, headers });

  try {
    const result = await submitLineRichMenuCommand({
      command: body.data.command,
      expectedVersion: body.data.expectedVersion,
      idempotencyKey: body.data.idempotencyKey,
      actor: identity.actor,
      actorType: identity.actorType,
      approvedBy: identity.actor,
      approvalReason: body.data.confirmation,
      ...(body.data.command === "reconcile"
        ? { definition: buildLineRichMenuProviderDefinition("line-rich-menu-v3") }
        : {}),
    });
    if (result.outcome === "conflict") {
      return NextResponse.json({ error: "stale-version", resourceVersion: result.resourceVersion }, { status: 409, headers });
    }
    if (result.outcome === "busy") {
      return NextResponse.json({ error: "provider-operation-in-progress", resourceVersion: result.resourceVersion }, { status: 409, headers });
    }
    if (result.outcome === "idempotency_conflict") {
      return NextResponse.json({ error: "idempotency-conflict" }, { status: 409, headers });
    }
    return NextResponse.json({
      status: result.outcome,
      commandId: result.commandId,
      resourceVersion: result.resourceVersion,
    }, { status: result.outcome === "pending_approval" ? 202 : 200, headers });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "CONTROL_PLANE_NOT_CONFIGURED") {
      return NextResponse.json({ error: "control-plane-unavailable" }, { status: 503, headers });
    }
    if (code === "CONTROL_PLANE_COMMAND_INVALID" || code === "CONTROL_PLANE_DEFINITION_REQUIRED") {
      return NextResponse.json({ error: "invalid-request" }, { status: 400, headers });
    }
    return NextResponse.json({ error: "control-command-failed" }, { status: 503, headers });
  }
}
