import { NextResponse } from "next/server";
import { z } from "zod";

import { exportDatasetSchema, exportFileName } from "@/lib/admin/agent-os/export-contract";
import { buildOwnerExportDataset } from "@/lib/admin/agent-os/export-datasets";
import { isN8nExportRequestAuthorized } from "@/lib/admin/agent-os/export-service-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
};

const bodySchema = z.object({
  dataset: exportDatasetSchema,
  generatedAt: z.string().datetime(),
}).strict();

export async function POST(request: Request) {
  if (!isN8nExportRequestAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > 8_192) {
    return NextResponse.json({ error: "payload-too-large" }, { status: 413, headers });
  }
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { return NextResponse.json({ error: "invalid-json" }, { status: 400, headers }); }

  const parsed = bodySchema.safeParse(value);
  if (!parsed.success) return NextResponse.json({ error: "invalid-export-request" }, { status: 400, headers });

  try {
    const data = await buildOwnerExportDataset(parsed.data.dataset, parsed.data.generatedAt);
    return NextResponse.json({
      ...data,
      fileName: exportFileName({
        dataset: parsed.data.dataset,
        format: "google-sheet",
        generatedAt: parsed.data.generatedAt,
      }),
    }, { headers });
  } catch {
    return NextResponse.json({ error: "export-data-unavailable", retryable: true }, { status: 503, headers });
  }
}
