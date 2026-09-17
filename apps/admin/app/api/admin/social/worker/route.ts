import { NextResponse } from "next/server";
import { runSocialWorker } from "@/lib/admin/social/worker";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return NextResponse.json({ error: "social-worker-not-configured" }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const result = await runSocialWorker();
    return NextResponse.json({ result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "SOCIAL_WORKER_FAILED";
    const unavailable = code === "SOCIAL_OPERATIONS_NOT_CONFIGURED"
      || code === "SOCIAL_OPERATIONS_DATABASE_NOT_READY"
      || code === "SOCIAL_PROVIDER_WRITES_NOT_CONFIGURED"
      || code === "SOCIAL_PROVIDER_WRITES_IDENTITY_MISMATCH";
    return NextResponse.json({ error: unavailable ? "social-worker-unavailable" : "social-worker-failed" }, {
      status: unavailable ? 503 : 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
