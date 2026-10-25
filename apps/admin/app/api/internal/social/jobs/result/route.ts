import { NextResponse } from "next/server";
import { workerResultSchema } from "@/lib/admin/social/email-digest-model";
import { recordWorkerResult } from "@/lib/admin/social/email-digest-service";
import { authenticateWorkerRequest, WORKER_NO_STORE } from "@/lib/admin/social/worker-http";

export const dynamic = "force-dynamic";

/** HMAC. Idempotent by job ID + idempotency key + claim token; late/duplicate callbacks answer 200 as no-ops. */
export async function POST(request: Request) {
  const body = await request.text();
  const authentication = await authenticateWorkerRequest(request, body);
  if ("response" in authentication) return authentication.response;
  let input: unknown = null;
  try { input = JSON.parse(body); } catch { /* invalid below */ }
  const parsed = workerResultSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "invalid-request" }, { status: 400, headers: WORKER_NO_STORE });
  try {
    return NextResponse.json(await recordWorkerResult({ store: authentication.store, result: parsed.data }), { headers: WORKER_NO_STORE });
  } catch {
    // Unknown commit outcome: n8n retries the same callback, which is safe (idempotent).
    return NextResponse.json({ error: "worker-store-unavailable" }, { status: 503, headers: WORKER_NO_STORE });
  }
}
