import { NextResponse } from "next/server";
import { workerClaimSchema } from "@/lib/admin/social/email-digest-model";
import { claimWorkerJob } from "@/lib/admin/social/email-digest-service";
import { authenticateWorkerRequest, WORKER_NO_STORE } from "@/lib/admin/social/worker-http";

export const dynamic = "force-dynamic";

const STATUS = { "not-due": 409, "not-claimable": 409, "attempts-exhausted": 409, "unknown-job": 404 } as const;

/** HMAC. queued -> claimed with a 15-minute lease; returns the claim token and the job payload. */
export async function POST(request: Request) {
  const body = await request.text();
  const authentication = await authenticateWorkerRequest(request, body);
  if ("response" in authentication) return authentication.response;
  let input: unknown = null;
  try { input = JSON.parse(body); } catch { /* invalid below */ }
  const parsed = workerClaimSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "invalid-request" }, { status: 400, headers: WORKER_NO_STORE });
  try {
    const result = await claimWorkerJob({ store: authentication.store, ...parsed.data });
    if (result.state !== "claimed") return NextResponse.json({ state: result.state }, { status: STATUS[result.state], headers: WORKER_NO_STORE });
    return NextResponse.json(result, { headers: WORKER_NO_STORE });
  } catch {
    return NextResponse.json({ error: "worker-store-unavailable" }, { status: 503, headers: WORKER_NO_STORE });
  }
}
