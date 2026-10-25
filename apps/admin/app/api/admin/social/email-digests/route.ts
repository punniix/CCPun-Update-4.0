import { NextResponse } from "next/server";
import { EMAIL_DIGEST_RECIPIENTS_PLACEHOLDER, emailDigestMutationSchema, isEmailDigestSendEnabled } from "@/lib/admin/social/email-digest-model";
import { emailDigestErrorResponse, NO_STORE, readJson, requireEmailDigestActor } from "@/lib/admin/social/email-digest-http";
import { createNeonEmailDigestStore, getEmailDigestStoreReadiness } from "@/lib/admin/social/email-digest-neon-store";
import { getEmailDigestWorkspace, mutateEmailDigest, publicDigestView } from "@/lib/admin/social/email-digest-service";
import { createEmailDigestSender } from "@/lib/admin/social/social-worker-dispatch";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = await requireEmailDigestActor(request, "read");
  if ("response" in authorization) return authorization.response;
  const readiness = await getEmailDigestStoreReadiness();
  const base = { recipients: EMAIL_DIGEST_RECIPIENTS_PLACEHOLDER, sendEnabled: isEmailDigestSendEnabled() };
  if (!readiness.ready) return NextResponse.json({ ...base, store: readiness.reason, digests: [], jobs: [] }, { headers: NO_STORE });
  try {
    const workspace = await getEmailDigestWorkspace({ store: await createNeonEmailDigestStore() });
    return NextResponse.json({ ...base, ...workspace, store: "ready" }, { headers: NO_STORE });
  } catch (error) {
    return emailDigestErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const authorization = await requireEmailDigestActor(request, "mutate");
  if ("response" in authorization) return authorization.response;
  const parsed = emailDigestMutationSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "invalid-request" }, { status: 400, headers: NO_STORE });
  try {
    const result = await mutateEmailDigest({
      mutation: parsed.data,
      actor: authorization.identity.actor,
      store: await createNeonEmailDigestStore(),
      sender: createEmailDigestSender(),
    });
    return NextResponse.json({ result: { state: result.state, digest: publicDigestView(result.digest), notification: result.notification } }, { headers: NO_STORE });
  } catch (error) {
    return emailDigestErrorResponse(error);
  }
}
