import { NextResponse } from "next/server";

import { probeLinePrivateIngestRuntime } from "@/lib/admin/line/private-ingestion";
import { isProductionWebServiceRequestAuthorized } from "@/lib/admin/line/web-service-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export async function HEAD(request: Request) {
  if (!(await isProductionWebServiceRequestAuthorized(request))) {
    return new NextResponse(null, { status: 401, headers });
  }
  return new NextResponse(null, {
    status: await probeLinePrivateIngestRuntime() ? 204 : 503,
    headers,
  });
}

export async function GET(request: Request) {
  if (!(await isProductionWebServiceRequestAuthorized(request))) {
    return NextResponse.json({ status: "unauthorized" }, { status: 401, headers });
  }
  const ready = await probeLinePrivateIngestRuntime();
  return NextResponse.json({ status: ready ? "ready" : "not-ready" }, {
    status: ready ? 200 : 503,
    headers,
  });
}
