import { NextResponse } from "next/server";
import { z } from "zod";
import { emailDigestContentSchema } from "@/lib/admin/social/email-digest-model";
import { NO_STORE, readJson, requireEmailDigestActor } from "@/lib/admin/social/email-digest-http";
import { renderEmailDigestHtml, renderEmailDigestText } from "@/lib/admin/social/email-digest-render";

export const dynamic = "force-dynamic";

const previewSchema = z.strictObject({ content: emailDigestContentSchema });

/** Pure render, no persistence and no send. POST only because the draft travels in the body. */
export async function POST(request: Request) {
  const authorization = await requireEmailDigestActor(request, "mutate");
  if ("response" in authorization) return authorization.response;
  const parsed = previewSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "invalid-request" }, { status: 400, headers: NO_STORE });
  return NextResponse.json({
    html: renderEmailDigestHtml(parsed.data.content),
    text: renderEmailDigestText(parsed.data.content),
  }, { headers: NO_STORE });
}
