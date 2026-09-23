import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { importLineOAChatCsv } from "@/lib/admin/line/conversation-archive";
import { hasAdminPermission } from "@/lib/admin/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};
const MAX_CSV_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  if (identity.role !== "owner" || !hasAdminPermission(identity.role, "advisor:case:update")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  }
  if (!isSameOriginAdminMutation(request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "invalid-origin" }, { status: 403, headers });
  }

  const leadId = z.string().uuid().safeParse((await params).leadId);
  if (!leadId.success) return NextResponse.json({ error: "invalid-lead" }, { status: 400, headers });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "invalid-form" }, { status: 400, headers });
  const file = form.get("file");
  const senderLabel = form.get("senderLabel");
  if (!(file instanceof File) || typeof senderLabel !== "string" || file.size <= 0 || file.size > MAX_CSV_BYTES) {
    return NextResponse.json({ error: "invalid-import" }, { status: 400, headers });
  }
  const name = file.name.toLowerCase();
  if (!name.endsWith(".csv") && file.type !== "text/csv" && file.type !== "application/vnd.ms-excel") {
    return NextResponse.json({ error: "csv-required" }, { status: 400, headers });
  }

  try {
    const csv = await file.text();
    const result = await importLineOAChatCsv({
      leadId: leadId.data,
      csv,
      ccpunSenderLabel: senderLabel,
    });
    return NextResponse.json(result, { headers });
  } catch (error) {
    const code = error instanceof Error ? error.message : "LINE_OA_IMPORT_FAILED";
    const status = code === "LINE_OA_IMPORT_UNSUPPORTED_FORMAT" ? 422 : 503;
    return NextResponse.json({ error: code.toLowerCase() }, { status, headers });
  }
}
