import { getAdminIdentity } from "@/lib/admin/identity";
import { migrationOwnerMetadata } from "@/lib/admin/migrations/google-data-transfer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
};

export async function GET(request: Request) {
  try {
    const metadata = migrationOwnerMetadata(request, await getAdminIdentity(), process.env);
    // Public deployment identity and one-way actor digest only; export remains separately disabled.
    return new Response(`<!doctype html><html lang="th"><meta charset="utf-8"><title>ยืนยันผู้รับผิดชอบการย้าย</title><body><h1>ยืนยันผู้รับผิดชอบการย้าย</h1><dl><dt>Owner SHA-256</dt><dd id="google-data-migration-owner-sha256">${metadata.ownerActorSha256}</dd><dt>Exporter SHA</dt><dd id="google-data-migration-exporter-sha">${metadata.exporterSha}</dd><dt>Project</dt><dd>${metadata.sourceProjectId}</dd><dt>Source ref</dt><dd>${metadata.sourceRef}</dd><dt>Deployment</dt><dd>${metadata.deploymentHost}</dd></dl></body></html>`,
      { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
  } catch { return new Response("Migration unavailable", { status: 404, headers }); }
}
