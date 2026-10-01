import { createHash } from "node:crypto";
import { getAdminIdentity } from "@/lib/admin/identity";
import { googleDataMigrationConfig } from "@/lib/admin/migrations/google-data-public-config";
import { encryptGoogleData, migrationAccess } from "@/lib/admin/migrations/google-data-transfer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
};
const unavailable = () => new Response("Migration unavailable", { status: 404, headers });
function html(body: string) {
  return new Response(`<!doctype html><html lang="th"><meta charset="utf-8"><title>ย้ายการเชื่อมต่อ Google Data</title><body>${body}</body></html>`,
    { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(request: Request) {
  if (!googleDataMigrationConfig.enabled) return unavailable();
  try {
    const metadata = migrationAccess(request, await getAdminIdentity(), googleDataMigrationConfig, process.env);
    return html(`<h1>ย้ายการเชื่อมต่อ Google Data</h1><p>ส่งเฉพาะข้อมูลเข้ารหัสให้ VPS ที่ตรวจสอบแล้ว การรับทำได้ครั้งเดียว และยังไม่เปิดงานอัตโนมัติ</p><form method="post"><input type="hidden" name="confirm" value="${metadata.transferId}"><button type="submit">สร้างข้อมูลเข้ารหัสสำหรับย้าย</button></form>`);
  } catch { return unavailable(); }
}

export async function POST(request: Request) {
  if (!googleDataMigrationConfig.enabled) return unavailable();
  try {
    const metadata = migrationAccess(request, await getAdminIdentity(), googleDataMigrationConfig, process.env);
    if (request.headers.get("content-type")?.split(";")[0] !== "application/x-www-form-urlencoded") return unavailable();
    const reader = request.body?.getReader();
    if (!reader) return unavailable();
    const chunks: Uint8Array[] = []; let size = 0;
    for (;;) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.length;
      if (size > 256) { await reader.cancel(); return unavailable(); }
      chunks.push(chunk.value);
    }
    if (Buffer.concat(chunks).toString("utf8") !== `confirm=${metadata.transferId}`) return unavailable();
    const envelope = JSON.stringify(encryptGoogleData(metadata, googleDataMigrationConfig, process.env));
    const sha = createHash("sha256").update(envelope).digest("hex");
    // Ciphertext only; errors, credentials and private headers are never rendered or logged.
    return html(`<h1>ข้อมูลเข้ารหัสสำหรับ VPS</h1><dl><dt>Exporter SHA</dt><dd id="google-data-migration-exporter-sha">${metadata.exporterSha}</dd><dt>Deployment</dt><dd>${metadata.deploymentHost}</dd><dt>Transfer ID</dt><dd id="google-data-migration-transfer-id">${metadata.transferId}</dd><dt>Recipient fingerprint</dt><dd id="google-data-migration-fingerprint">${metadata.recipientFingerprint}</dd><dt>Envelope SHA-256</dt><dd id="google-data-migration-envelope-sha">${sha}</dd></dl><pre id="google-data-migration-envelope">${envelope}</pre>`);
  } catch { return unavailable(); }
}
