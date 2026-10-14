import { NextResponse } from "next/server";

import { getAdminIdentity } from "@/lib/admin/identity";
import { resolveLineIngestRuntime } from "@/lib/admin/line/private-ingestion";
import { createLinePrivateCrypto } from "@/lib/line/private-crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Vary": "Cookie",
};

/**
 * Owner-only deployment diagnostics. Deliberately exposes only three booleans.
 * Never return env values, partial keys, database URLs, crypto errors, or metadata.
 * This does not attempt to connect to Neon or LINE or inspect customer records.
 */
export async function GET() {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  if (identity.role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  }

  const checks = {
    channelSignatureConfiguration: Boolean(process.env.LINE_CHANNEL_SECRET?.trim()),
    runtimeLane: false,
    privateCrypto: false,
  };

  try { checks.runtimeLane = Boolean(resolveLineIngestRuntime()); }
  catch { checks.runtimeLane = false; }
  try { createLinePrivateCrypto(); checks.privateCrypto = true; }
  catch { checks.privateCrypto = false; }

  const ready = Object.values(checks).every(Boolean);
  return NextResponse.json(
    { status: ready ? "ready" : "not-ready", checks, appliesTo: "line-ingress-configuration-only" },
    { status: ready ? 200 : 503, headers },
  );
}
