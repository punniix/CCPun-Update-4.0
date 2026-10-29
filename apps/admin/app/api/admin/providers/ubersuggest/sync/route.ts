import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isConfiguredAdminOrigin, isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { getAdminIdentity } from "@/lib/admin/identity";
import { evaluateAdminAction } from "@/lib/admin/policy";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { aisvSnapshotImportSchema } from "@/lib/admin/seo-intelligence/aisv";
import { runUbersuggestSync, ubersuggestSyncFailure, type UbersuggestSyncResult } from "@/lib/admin/ubersuggest-sync";
import { persistUbersuggestDashboardSync } from "@/lib/admin/ubersuggest-dashboard";

let syncInFlight: Promise<UbersuggestSyncResult> | null = null;

const requestSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("provider-sync") }).strict(),
  z.object({ mode: z.literal("reviewed-import"), snapshot: aisvSnapshotImportSchema }).strict(),
]);

function isReviewedImportEnvironment() {
  const environment = getAdminEnvironment();
  return environment === "admin-uat" || environment === "local-uat";
}

export async function POST(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (
    !isConfiguredAdminOrigin(request.url, process.env.AUTH_URL) ||
    !isSameOriginAdminMutation(request.url, request.headers.get("origin"))
  ) return NextResponse.json({ error: "forbidden-origin" }, { status: 403 });

  const policy = evaluateAdminAction({
    actorType: identity.actorType,
    role: identity.role,
    action: "research:create",
    environment: getAdminEnvironment(),
  });
  if (!policy.allowed || identity.actorType !== "human" || !hasAdminPermission(identity.role, "research:provider-query")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const maxBodyBytes = 1_048_576;
  if (Number(request.headers.get("content-length")) > maxBodyBytes) {
    return NextResponse.json({ error: "payload-too-large" }, { status: 413 });
  }
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let bodyBytes = 0;
  try {
    if (reader) for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bodyBytes += value.byteLength;
      if (bodyBytes > maxBodyBytes) {
        await reader.cancel().catch(() => undefined);
        return NextResponse.json({ error: "payload-too-large" }, { status: 413 });
      }
      chunks.push(value);
    }
  } catch {
    return NextResponse.json({ error: "invalid-input" }, { status: 400 });
  } finally { reader?.releaseLock(); }
  const rawText = Buffer.concat(chunks).toString("utf8");
  let raw: unknown = { mode: "provider-sync" };
  if (rawText.trim()) {
    try {
      raw = JSON.parse(rawText) as unknown;
    } catch {
      return NextResponse.json({ error: "invalid-input" }, { status: 400 });
    }
  }
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid-input" }, { status: 400 });

  const requestId = randomUUID();

  if (parsed.data.mode === "reviewed-import") {
    if (!isReviewedImportEnvironment()) return NextResponse.json({ error: "uat-import-only", requestId }, { status: 403 });
    try {
      const saved = await persistUbersuggestDashboardSync(parsed.data.snapshot, {
        actor: identity.actor,
        actorType: "human",
        requestId,
      });
      return NextResponse.json({ ...saved, reused: false, imported: true, requestId }, { status: 201 });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (["SANITY_WRITE_NOT_CONFIGURED", "ADMIN_DATABASE_NOT_CONFIGURED"].includes(code)) {
        return NextResponse.json({ error: "research-write-not-configured", requestId }, { status: 503 });
      }
      return NextResponse.json({ error: "provider-import-failed", requestId }, { status: 502 });
    }
  }

  const task = syncInFlight ?? runUbersuggestSync(identity.actor, requestId);
  syncInFlight = task;
  try {
    const result = await task;
    return NextResponse.json({ ...result, requestId }, { status: result.reused ? 200 : 201 });
  } catch (error) {
    return ubersuggestSyncFailure(error, requestId);
  } finally {
    if (syncInFlight === task) syncInFlight = null;
  }
}
