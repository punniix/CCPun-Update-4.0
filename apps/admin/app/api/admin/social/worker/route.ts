import { NextResponse } from "next/server";

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

  // Execution belongs to the guarded private VPS CLI:
  // scripts/admin-background-worker.ts social. HTTP is never a worker invoker.
  return NextResponse.json({ error: "social-worker-unavailable" }, {
    status: 503,
    headers: { "Cache-Control": "no-store" },
  });
}
