import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminIdentity } from "@/lib/admin/identity";
import { isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { analyticsDate } from "@/lib/admin/analytics/model";
import { beginAnalyticsCollection, finishAnalyticsCollection } from "@/lib/admin/analytics/store";
import { prepareUbersuggestWebImport } from "@/lib/admin/analytics/import";
import { UBERSUGGEST_CSV_MAX_BYTES } from "@/lib/admin/ubersuggest-csv";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive", "X-Content-Type-Options": "nosniff" };
const metadataSchema = z.object({ windowStart: z.iso.date(), windowEnd: z.iso.date(), market: z.string().trim().min(1).max(120), language: z.string().trim().min(1).max(80), currency: z.string().regex(/^[A-Z]{3}$/).nullable(), sourceAsOf: z.iso.date().nullable() }).refine((value) => value.windowStart <= value.windowEnd && value.windowEnd <= analyticsDate() && (!value.sourceAsOf || value.sourceAsOf <= analyticsDate()));
export async function POST(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  if (identity.role !== "owner" || identity.actorType !== "human") return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  if (!isSameOriginAdminMutation(request.url, request.headers.get("origin"))) return NextResponse.json({ error: "invalid-origin" }, { status: 403, headers });
  if (Number(request.headers.get("content-length")) > UBERSUGGEST_CSV_MAX_BYTES + 32_768) return NextResponse.json({ error: "file-too-large" }, { status: 413, headers });
  let form: FormData;
  try {
    const reader = request.body?.getReader(); if (!reader) throw new Error("INVALID_BODY");
    const chunks: Uint8Array[] = []; let size = 0;
    for (;;) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length; if (size > UBERSUGGEST_CSV_MAX_BYTES + 32_768) { await reader.cancel(); return NextResponse.json({ error: "file-too-large" }, { status: 413, headers }); } chunks.push(chunk.value); }
    form = await new Response(new Uint8Array(Buffer.concat(chunks)), { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
  } catch { return NextResponse.json({ error: "invalid-import" }, { status: 400, headers }); }
  const file = form.get("file");
  const metadata = metadataSchema.safeParse({ windowStart: form.get("windowStart"), windowEnd: form.get("windowEnd"), market: form.get("market"), language: form.get("language"), currency: form.get("currency") || null, sourceAsOf: form.get("sourceAsOf") || null });
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv") || !metadata.success) return NextResponse.json({ error: "invalid-import" }, { status: 400, headers });
  if (file.size > UBERSUGGEST_CSV_MAX_BYTES) return NextResponse.json({ error: "file-too-large" }, { status: 413, headers });
  const csv = await file.text(), collectedAt = new Date().toISOString();
  let prepared: ReturnType<typeof prepareUbersuggestWebImport>;
  try { prepared = prepareUbersuggestWebImport(csv, metadata.data, "00000000-0000-4000-8000-000000000000", collectedAt); }
  catch { return NextResponse.json({ error: "invalid-csv" }, { status: 400, headers }); }
  try {
    const claim = await beginAnalyticsCollection("ubersuggest", analyticsDate(), process.env, "web:" + prepared.hash);
    const result = { batchId: claim.batchId, rows: prepared.parsed.rows.length, sourceRows: prepared.parsed.sourceRows, duplicateRows: prepared.parsed.duplicateRows, invalidRowCount: prepared.parsed.invalidRowCount, report: "ubersuggest-web-keywords" };
    if (claim.status === "completed") return NextResponse.json({ status: "duplicate", ...result }, { headers });
    if (claim.status !== "claimed") return NextResponse.json({ error: "import-unavailable" }, { status: 503, headers });
    prepared.data.batchId = claim.batchId;
    await finishAnalyticsCollection({ batchId: claim.batchId, attempt: claim.attempt, reports: [prepared.data], raw: [{ report: "ubersuggest-web-keywords", page: 0, collectedAt, body: prepared.body, canonicalJson: JSON.stringify(prepared.body), hash: prepared.hash, origin: "owner-web-csv" }], error: null });
    return NextResponse.json({ status: "completed", ...result }, { headers });
  } catch { return NextResponse.json({ error: "import-unavailable" }, { status: 503, headers }); }
}
