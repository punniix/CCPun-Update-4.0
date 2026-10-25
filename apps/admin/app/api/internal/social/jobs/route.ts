import { NextResponse } from "next/server";
import { workerJobIdSchema } from "@/lib/admin/social/email-digest-model";
import { getWorkerJobDetail, listDueWorkerJobIds } from "@/lib/admin/social/email-digest-service";
import { authenticateWorkerRequest, WORKER_NO_STORE } from "@/lib/admin/social/worker-http";

export const dynamic = "force-dynamic";

/** HMAC, read-only. `?id=<jobId>` returns what the worker needs; no id lists due job IDs only. */
export async function GET(request: Request) {
  const authentication = await authenticateWorkerRequest(request, "");
  if ("response" in authentication) return authentication.response;
  const raw = new URL(request.url).searchParams.get("id");
  try {
    if (raw === null) return NextResponse.json({ jobIds: await listDueWorkerJobIds(authentication.store) }, { headers: WORKER_NO_STORE });
    const id = workerJobIdSchema.safeParse(raw);
    if (!id.success) return NextResponse.json({ error: "invalid-request" }, { status: 400, headers: WORKER_NO_STORE });
    const job = await getWorkerJobDetail(authentication.store, id.data);
    if (!job) return NextResponse.json({ error: "job-not-found" }, { status: 404, headers: WORKER_NO_STORE });
    return NextResponse.json({ job }, { headers: WORKER_NO_STORE });
  } catch {
    return NextResponse.json({ error: "worker-store-unavailable" }, { status: 503, headers: WORKER_NO_STORE });
  }
}
