import { NextResponse } from "next/server";
import { encryptedLineEventSchema, readEncryptedLineEventBody } from "@/lib/admin/line/encrypted-ingest";

import { createLinePrivateIngestor, resolveLineIngestRuntime } from "@/lib/admin/line/private-ingestion";
import { isProductionWebServiceRequestAuthorized } from "@/lib/admin/line/web-service-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export async function POST(request: Request) {
  if (process.env.CCPUN_DEPLOYMENT_PROVIDER?.trim().toLowerCase() === "hostinger") {
    return new NextResponse(null, { status: 404, headers });
  }
  if (!(await isProductionWebServiceRequestAuthorized(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  }
  if (resolveLineIngestRuntime()?.lane !== "production") {
    return NextResponse.json({ error: "private-ingest-unavailable" }, { status: 503, headers });
  }
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
    return NextResponse.json({ error: "unsupported-media-type" }, { status: 415, headers });
  }
  const raw = await readEncryptedLineEventBody(request).catch(() => null);
  if (raw === null) {
    return NextResponse.json({ error: "payload-too-large" }, { status: 413, headers });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400, headers });
  }
  const parsed = encryptedLineEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-encrypted-event" }, { status: 400, headers });
  }

  try {
    const ingest = createLinePrivateIngestor();
    const outcome = await ingest(parsed.data);
    return NextResponse.json({ outcome }, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: "private-ingest-unavailable" }, { status: 503, headers });
  }
}

export function GET() {
  return new NextResponse(null, { status: 404, headers });
}
