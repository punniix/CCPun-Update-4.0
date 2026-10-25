import { NextResponse } from "next/server";
import { monthSchema } from "@/lib/admin/social/email-digest-model";
import { listMonthArticlesForDigest } from "@/lib/admin/social/email-digest-articles";
import { NO_STORE, requireEmailDigestActor } from "@/lib/admin/social/email-digest-http";

export const dynamic = "force-dynamic";

/** Read-only: articles published in the chosen Bangkok month, for the owner to reorder/remove. */
export async function GET(request: Request) {
  const authorization = await requireEmailDigestActor(request, "read");
  if ("response" in authorization) return authorization.response;
  const month = monthSchema.safeParse(new URL(request.url).searchParams.get("month"));
  if (!month.success) return NextResponse.json({ error: "invalid-request" }, { status: 400, headers: NO_STORE });
  const result = await listMonthArticlesForDigest(month.data);
  if (result.state !== "ok") return NextResponse.json({ error: result.state === "not-configured" ? "content-not-configured" : "content-unavailable" }, { status: 503, headers: NO_STORE });
  return NextResponse.json({ month: month.data, articles: result.articles }, { headers: NO_STORE });
}
