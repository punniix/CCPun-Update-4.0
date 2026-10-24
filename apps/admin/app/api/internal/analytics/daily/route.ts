import { NextResponse } from "next/server";
import { z } from "zod";
import { isN8nExportRequestAuthorized } from "@/lib/admin/agent-os/export-service-auth";
import { analyticsSourceSchema, analyticsDate } from "@/lib/admin/analytics/model";
import { collectAnalyticsSource } from "@/lib/admin/analytics/collect";
import { GOOGLE_RELAY_LIMITATION, GOOGLE_RELAY_MAX_BYTES, GOOGLE_RELAY_TOKEN, createGoogleRelayFetcher, googleRelayResponsesSchema } from "@/lib/admin/google-relay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive", "X-Content-Type-Options": "nosniff" };
const input = z.object({ source: analyticsSourceSchema, date: z.iso.date().optional(), relayResponses: googleRelayResponsesSchema.optional() }).strict();
export async function POST(request: Request) {
  if (!isN8nExportRequestAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  const text = await request.text();
  const bytes = Buffer.byteLength(text);
  if (bytes > GOOGLE_RELAY_MAX_BYTES) return NextResponse.json({ error: "payload-too-large" }, { status: 413, headers });
  let value: unknown; try { value = JSON.parse(text); } catch { return NextResponse.json({ error: "invalid-json" }, { status: 400, headers }); }
  const parsed = input.safeParse(value);
  if (!parsed.success || (parsed.data.date && parsed.data.date !== analyticsDate())) return NextResponse.json({ error: "invalid-collection-request" }, { status: 400, headers });
  const relayResponses = parsed.data.relayResponses;
  if (!relayResponses && bytes > 1024) return NextResponse.json({ error: "payload-too-large" }, { status: 413, headers });
  if (relayResponses && parsed.data.source !== "gsc" && parsed.data.source !== "ga4") return NextResponse.json({ error: "invalid-collection-request" }, { status: 400, headers });
  try {
    if (!relayResponses) return NextResponse.json({ results: [await collectAnalyticsSource(parsed.data.source, parsed.data.date)] }, { headers });
    // n8n relay: discover the provider requests still needed without touching storage, then collect with the relayed responses.
    const plan = createGoogleRelayFetcher(relayResponses);
    await collectAnalyticsSource(parsed.data.source, parsed.data.date, process.env, plan.fetcher, { mode: "relay-dry-run", relayToken: GOOGLE_RELAY_TOKEN });
    const requests = plan.missing();
    if (requests.length) return NextResponse.json({ state: "needs-requests", source: parsed.data.source, requests }, { headers });
    const submit = createGoogleRelayFetcher(relayResponses);
    const result = await collectAnalyticsSource(parsed.data.source, parsed.data.date, process.env, submit.fetcher, { mode: "relay-submit", relayToken: GOOGLE_RELAY_TOKEN, relayLimitation: GOOGLE_RELAY_LIMITATION });
    return NextResponse.json({ state: "submitted", results: [result], missingRequests: submit.missing().length }, { headers });
  }
  catch { return NextResponse.json({ error: "analytics-runtime-unavailable" }, { status: 503, headers }); }
}
