import { NextResponse } from "next/server";
import { workerJobRetrySchema } from "@/lib/admin/social/email-digest-model";
import { emailDigestErrorResponse, NO_STORE, readJson, requireEmailDigestActor } from "@/lib/admin/social/email-digest-http";
import { createNeonEmailDigestStore } from "@/lib/admin/social/email-digest-neon-store";
import { retryWorkerJob } from "@/lib/admin/social/email-digest-service";
import { createEmailDigestSender } from "@/lib/admin/social/social-worker-dispatch";

export const dynamic = "force-dynamic";

/** Owner action, audited: re-notify a queued job or requeue a failed / needs_attention job. */
export async function POST(request: Request) {
  const authorization = await requireEmailDigestActor(request, "mutate");
  if ("response" in authorization) return authorization.response;
  const parsed = workerJobRetrySchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "invalid-request" }, { status: 400, headers: NO_STORE });
  try {
    const result = await retryWorkerJob({
      request: parsed.data,
      actor: authorization.identity.actor,
      store: await createNeonEmailDigestStore(),
      sender: createEmailDigestSender(),
    });
    return NextResponse.json({ result }, { headers: NO_STORE });
  } catch (error) {
    return emailDigestErrorResponse(error);
  }
}
