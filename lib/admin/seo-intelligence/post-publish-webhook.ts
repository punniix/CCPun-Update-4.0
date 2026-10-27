import "server-only";
import { timingSafeEqual } from "node:crypto";
import { decodeSignatureHeader, encodeSignatureHeader, SIGNATURE_HEADER_NAME } from "@sanity/webhook";
import { z } from "zod";
import { approvedPublishedArticle } from "./post-publish-network";

import { isSanityPublishIngress } from "./post-publish-origin";
const LIMIT = 4096;
const id = z.string().min(1).max(200).regex(/^[A-Za-z0-9._-]+$/)
  .refine(value => !value.startsWith("drafts.") && !value.startsWith("versions."));
const payloadSchema = z.object({
  articleId: id, rev: z.string().min(1).max(200), slug: z.string().max(200).optional(),
  categoryRef: z.string().max(200).nullish(), contentUpdatedAt: z.string().datetime(),
  noindex: z.boolean().optional(), canonical: z.string().max(2048).nullish(),
  deleted: z.boolean().optional(), op: z.enum(["create", "update", "delete"]),
}).strict();
type Article = { id: string; slug: string; category: string; categorySlug: string; updatedAt: string; noindex?: boolean | null; canonical?: string | null; reviewStatus?: string | null; rev?: string | null };
export type SanityPublishDependencies = {
  environment: string; secret?: string; now?: () => number;
  runtimeEnv?: Record<string, string | undefined>;
  readArticle: (id: string) => Promise<Article | null>;
  enqueue: (input: { article: Article; deliveryId: string; sanityRev: string }) => Promise<{ job_id: string } | null>;
};
// @sanity/webhook compares with `!==`; compare the recomputed header in constant time instead.
function sameSignature(received: string, expected: string) {
  const a = Buffer.from(received, "utf8"); const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
const buckets = new Map<string, { minute: number; count: number }>();
function allowedRate(request: Request, now: number) {
  const key = (request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip") ?? "unknown").slice(0, 100);
  const minute = Math.floor(now / 60_000);
  const bucket = buckets.get(key);
  if (!bucket || bucket.minute !== minute) {
    if (buckets.size >= 4096) buckets.delete(buckets.keys().next().value!);
    buckets.set(key, { minute, count: 1 }); return true;
  }
  return ++bucket.count <= 60;
}
async function rawBody(request: Request) {
  if (Number(request.headers.get("content-length")) > LIMIT) throw new RangeError("body-limit");
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = []; let size = 0;
  let timer!: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("body-timeout")), 10_000); });
  try {
    while (true) {
      const next = await Promise.race([reader.read(), timeout]); if (next.done) break;
      size += next.value.byteLength;
      if (size > LIMIT) throw new RangeError("body-limit");
      chunks.push(next.value);
    }
  } finally { clearTimeout(timer); void reader.cancel().catch(() => undefined); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export async function handleSanityArticlePublished(request: Request, deps: SanityPublishDependencies) {
  const reply = (body: object, status = 202) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
  if (deps.environment !== "production-admin") return reply({ state: "skipped", reason: "production-only" });
  if (!isSanityPublishIngress(request, deps.runtimeEnv)) return reply({ error: "forbidden-host" }, 403);
  const now = (deps.now ?? Date.now)();
  if (!allowedRate(request, now)) return reply({ error: "rate-limited" }, 429);
  if (request.headers.get("sanity-project-id") !== "kyfxgjnq" || request.headers.get("sanity-dataset") !== "production") return reply({ error: "forbidden-lane" }, 403);
  if (!deps.secret) return reply({ error: "webhook-not-configured" }, 503);
  let body: string;
  try { body = await rawBody(request); } catch (error) { return reply({ error: "invalid-body" }, error instanceof RangeError ? 413 : error instanceof Error && error.message === "body-timeout" ? 408 : 400); }
  const signature = request.headers.get(SIGNATURE_HEADER_NAME);
  try {
    if (!signature || signature.length > 1024) return reply({ error: "unauthorized" }, 401);
    const { timestamp } = decodeSignatureHeader(signature);
    if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > 300_000
      || !sameSignature(signature, await encodeSignatureHeader(body, timestamp, deps.secret))) return reply({ error: "unauthorized" }, 401);
  } catch { return reply({ error: "unauthorized" }, 401); }
  let parsed;
  try { parsed = payloadSchema.safeParse(JSON.parse(body)); } catch { return reply({ error: "invalid-input" }, 400); }
  if (!parsed.success) return reply({ error: "invalid-input" }, 400);
  // sanity-webhook-id identifies the configured hook, not this delivery.
  const deliveryId = request.headers.get("idempotency-key");
  // ponytail: accept the quoted-token envelope; retain exact raw identity and the 200-byte bound.
  // This bounded subset does not parse arbitrary RFC9651 strings, escapes, lists or parameters.
  if (!deliveryId || !(/^[A-Za-z0-9._:-]{1,200}$/.test(deliveryId)
    || /^"[A-Za-z0-9._:-]{1,198}"$/.test(deliveryId))) {
    const reason = deliveryId === null ? "missing" : deliveryId.length === 0 ? "empty"
      : deliveryId.length > 200 ? "too-long" : "unsupported-format";
    return reply({ error: "invalid-delivery-id", reason,
      present: deliveryId !== null, length: Math.min(deliveryId?.length ?? 0, 201),
      quoted: Boolean(deliveryId?.startsWith('"') && deliveryId.endsWith('"')) }, 400);
  }
  if (parsed.data.deleted || parsed.data.op === "delete") return reply({ state: "skipped", reason: "deleted" });
  try {
    const article = await deps.readArticle(parsed.data.articleId);
    if (!article || article.id !== parsed.data.articleId) return reply({ state: "skipped", reason: "not-published" });
    if (article.noindex === true) return reply({ state: "skipped", reason: "skipped-noindex" });
    if (!approvedPublishedArticle(article)) return reply({ state: "skipped", reason: "skipped-canonical" });
    if (article.reviewStatus !== "approved") return reply({ state: "skipped", reason: "not-approved" });
    const job = await deps.enqueue({ article, deliveryId, sanityRev: article.rev ?? parsed.data.rev });
    if (!job) throw new Error("queue-unavailable");
    return reply({ state: "queued", jobId: job.job_id });
  } catch (error) { return reply({ error: error instanceof Error && error.message === "SEO_DELIVERY_COLLISION" ? "delivery-conflict" : "queue-unavailable" }, error instanceof Error && error.message === "SEO_DELIVERY_COLLISION" ? 409 : 503); }
}
