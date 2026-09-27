import { NextResponse } from "next/server";

import { exportDatasetSchema, exportFileName } from "@/lib/admin/agent-os/export-contract";
import { buildOwnerExportDataset } from "@/lib/admin/agent-os/export-datasets";
import { ownerDatasetToCsv } from "@/lib/admin/agent-os/export-csv";
import { getAdminIdentity } from "@/lib/admin/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (identity.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const dataset = exportDatasetSchema.safeParse(url.searchParams.get("dataset"));
  if (!dataset.success) return NextResponse.json({ error: "invalid-dataset" }, { status: 400 });

  const generatedAt = new Date().toISOString();
  try {
    const data = await buildOwnerExportDataset(dataset.data, generatedAt);
    const csv = ownerDatasetToCsv(data);
    const filename = exportFileName({ dataset: dataset.data, format: "csv", generatedAt });
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "export-unavailable" }, { status: 503 });
  }
}
