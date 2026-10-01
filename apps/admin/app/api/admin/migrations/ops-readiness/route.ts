import { getAdminIdentity } from "@/lib/admin/identity";
import { migrationOwnerMetadata } from "@/lib/admin/migrations/google-data-transfer";
import { opsAccess, encryptOps } from "@/lib/admin/migrations/ops-transfer";
import { opsTransferConfig } from "@/lib/admin/migrations/ops-transfer-public-config";
import { readOpsReadiness } from "@/lib/admin/migrations/ops-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};

export async function GET(request: Request) {
  try {
    migrationOwnerMetadata(request, await getAdminIdentity(), process.env);
    const readiness = await readOpsReadiness(process.env);
    // This fixed projection contains boolean capability metadata and aggregate counts only.
    const metadata = JSON.stringify(readiness);
    const transfer = opsTransferConfig.enabled && /^[a-f0-9]{32}$/.test(opsTransferConfig.transferId)
      ? `<form method="post" action="/api/admin/migrations/ops-readiness/"><input type="hidden" name="transferId" value="${opsTransferConfig.transferId}"><button type="submit">สร้างไฟล์เข้ารหัสสำหรับย้ายระบบ</button></form>` : "";
    return new Response(`<!doctype html><html lang="th"><meta charset="utf-8"><title>ตรวจความพร้อมระบบก่อนย้าย</title><body><h1>ตรวจความพร้อมระบบก่อนย้าย</h1><p>สถานะการตั้งค่าไม่ใช่ผลทดสอบผู้ให้บริการ จำนวนงาน Social และ n8n ยังไม่ยืนยัน</p><pre id="ccpun-ops-migration-readiness">${metadata}</pre>${transfer}</body></html>`,
      { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
  } catch { return new Response("Migration unavailable", { status: 404, headers }); }
}

export async function POST(request: Request) {
  try {
    // Authenticate and bind deployment/recipient BEFORE reading any credential.
    const metadata = opsAccess(request, await getAdminIdentity(), process.env, opsTransferConfig, Math.floor(Date.now() / 1000));
    if (request.headers.get("content-type") !== "application/x-www-form-urlencoded") throw new Error("OPS_TRANSFER_DENIED");
    const reader = request.body?.getReader();
    if (!reader) throw new Error("OPS_TRANSFER_DENIED");
    let body = "", size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.length;
        if (size > 128) { await reader.cancel(); throw new Error("OPS_TRANSFER_DENIED"); }
        body += new TextDecoder("utf-8", { fatal: true }).decode(value);
      }
    } finally { reader.releaseLock(); }
    if (body !== "transferId=" + opsTransferConfig.transferId) throw new Error("OPS_TRANSFER_DENIED");
    const ciphertext = JSON.stringify(encryptOps(metadata, opsTransferConfig, process.env));
    return new Response(ciphertext, { headers: { ...headers, "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="ccpun-ops-${opsTransferConfig.transferId}.json"` } });
  } catch { return new Response("Migration unavailable", { status: 404, headers }); }
}
