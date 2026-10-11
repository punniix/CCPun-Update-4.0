import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isPostPublishAdminOriginAllowed } from "@/lib/admin/seo-intelligence/post-publish-origin";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { enqueuePublishedSeoArticle, readPublishedSeoJob } from "@/lib/admin/seo-intelligence/post-publish-queue";

const headers = { "Cache-Control": "private, no-store" };
const articleIdSchema = z.string().trim().min(1).max(200).regex(/^[A-Za-z0-9._-]+$/);

async function ownerIdentity() {
  const identity = await getAdminIdentity();
  if (!identity) return { error: "unauthorized", status: 401 } as const;
  if (identity.actorType !== "human" || identity.role !== "owner" || !hasAdminPermission(identity.role, "seo:read")) {
    return { error: "forbidden", status: 403 } as const;
  }
  return { identity };
}

export async function POST(request: Request) {
  const access = await ownerIdentity();
  if ("error" in access) return NextResponse.json({ error: access.error }, { status: access.status, headers });
  if (!isPostPublishAdminOriginAllowed(request, process.env, getAdminEnvironment())) {
    return NextResponse.json({ error: "forbidden-origin" }, { status: 403, headers });
  }
  if (getAdminEnvironment() !== "production-admin") {
    return NextResponse.json({ state: "skipped", reason: "production-only" }, { status: 202, headers });
  }
  const parsed = z.object({ articleId: articleIdSchema }).strict().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid-input" }, { status: 400, headers });
  try {
    // No HTTP 202 until the Neon outbox commit has succeeded.
    const receipt = await enqueuePublishedSeoArticle({
      articleId: parsed.data.articleId, actor: access.identity.actor,
      source: "owner", ownerApproved: true, requestId: randomUUID(),
    });
    if (!receipt) return NextResponse.json({ error: "published-article-not-eligible" }, { status: 409, headers });
    return NextResponse.json({ state: receipt.state, jobId: receipt.job_id }, { status: 202, headers });
  } catch {
    return NextResponse.json({ error: "queue-unavailable" }, { status: 503, headers });
  }
}

export async function GET(request: Request) {
  const access = await ownerIdentity();
  if ("error" in access) return NextResponse.json({ error: access.error }, { status: access.status, headers });
  if (!isPostPublishAdminOriginAllowed(request, process.env, getAdminEnvironment())) {
    return NextResponse.json({ error: "forbidden-origin" }, { status: 403, headers });
  }
  const id = articleIdSchema.safeParse(new URL(request.url).searchParams.get("articleId"));
  if (!id.success) return NextResponse.json({ error: "invalid-input" }, { status: 400, headers });
  try {
    const job = await readPublishedSeoJob(id.data);
    return NextResponse.json(job
      ? { state: job.state, jobId: job.job_id, attempts: job.attempts, result: job.result_json ?? null }
      : { state: "not-found" }, { status: job ? 200 : 404, headers });
  } catch {
    return NextResponse.json({ error: "queue-unavailable" }, { status: 503, headers });
  }
}
