import { NextResponse } from "next/server";
import { z } from "zod";

import { createLinePrivateIngestor } from "@/lib/admin/line/private-ingestion";
import { isProductionWebServiceRequestAuthorized } from "@/lib/admin/line/web-service-auth";
import type { LinePrivateIngestEvent } from "@/lib/line/private-domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

const digestSchema = z.string().regex(/^[0-9a-f]{64}$/);
const encryptedSchema = z.object({
  keyVersion: z.union([z.literal(1), z.literal(2)]),
  ciphertextB64: z.string().min(1).max(100_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  nonceB64: z.string().min(16).max(64).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  authTagB64: z.string().min(16).max(64).regex(/^[A-Za-z0-9+/]+={0,2}$/),
}).strict();
const postbackSchema = z.object({
  journey: z.enum([
    "motor_quote_review",
    "life_health_policy_review",
    "investment_before_you_act",
    "human_handoff",
  ]),
  stage: z.string().min(1).max(80).regex(/^[a-z0-9][a-z0-9_-]*$/),
  needsHuman: z.boolean(),
}).strict();
const eventSchema = z.object({
  eventDigest: digestSchema,
  eventType: z.enum(["message", "follow", "unfollow", "postback", "unsend"]),
  occurredAt: z.iso.datetime(),
  isRedelivery: z.boolean(),
  sourceType: z.enum(["user", "group", "room", "unknown"]),
  identity: z.object({
    lookupDigest: digestSchema,
    encryptedExternalRef: encryptedSchema,
  }).strict().nullable(),
  message: z.object({
    providerMessageDigest: digestSchema,
    encryptedProviderMessageId: encryptedSchema,
    messageType: z.enum(["text", "image", "video", "audio", "file", "location", "sticker"]),
    encryptedContent: encryptedSchema.nullable(),
    materialReceived: z.boolean(),
  }).strict().nullable(),
  postback: postbackSchema.nullable(),
  unsendTargetDigest: digestSchema.nullable(),
  needsHuman: z.boolean(),
}).strict();

export async function POST(request: Request) {
  if (!(await isProductionWebServiceRequestAuthorized(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "unsupported-media-type" }, { status: 415, headers });
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > 256_000) {
    return NextResponse.json({ error: "payload-too-large" }, { status: 413, headers });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400, headers });
  }
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-encrypted-event" }, { status: 400, headers });
  }

  try {
    const ingest = createLinePrivateIngestor();
    const outcome = await ingest(parsed.data as LinePrivateIngestEvent);
    return NextResponse.json({ outcome }, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: "private-ingest-unavailable" }, { status: 503, headers });
  }
}

export function GET() {
  return new NextResponse(null, { status: 404, headers });
}
