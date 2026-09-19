"use client";

import { useRef, useState } from "react";
import { requestGoogleDriveMemorySession, type GoogleDriveMemorySession } from "./social-workspace-client";
import { isGoogleDriveAuthorizationUsable } from "./social-workspace-media";

const googleClientId = process.env.NEXT_PUBLIC_CCPUN_GOOGLE_DRIVE_OAUTH_CLIENT_ID?.trim() ?? "";

export default function SocialSheetsExport() {
  const sessionRef = useRef<GoogleDriveMemorySession | null>(null);
  const [state, setState] = useState<"idle" | "running" | "ready" | "failed">("idle");
  const [notice, setNotice] = useState("");
  const [url, setUrl] = useState<string | null>(null);

  async function exportSheets() {
    if (!googleClientId) { setState("failed"); setNotice("ยังตั้งค่าการเชื่อมต่อ Google ไม่ครบ กรุณาติดต่อผู้ดูแลระบบ"); return; }
    setState("running"); setNotice(""); setUrl(null);
    try {
      let session = sessionRef.current;
      if (!session || !isGoogleDriveAuthorizationUsable(session.authorization)) {
        session = await requestGoogleDriveMemorySession(googleClientId);
        sessionRef.current = session;
      }
      const response = await fetch("/api/admin/social/export/sheets", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ accessToken: session.accessToken, authorization: session.authorization }),
      });
      const payload = await response.json().catch(() => null) as {
        error?: unknown; partialSpreadsheetUrl?: unknown;
        export?: { spreadsheetUrl?: unknown; sheets?: Array<{ title?: unknown; rows?: unknown }> };
      } | null;
      const partial = typeof payload?.partialSpreadsheetUrl === "string" ? payload.partialSpreadsheetUrl : null;
      if (!response.ok) {
        if (response.status === 401) sessionRef.current = null;
        if (partial) setUrl(partial);
        throw new Error(typeof payload?.error === "string" ? payload.error : "google-export-failed");
      }
      const spreadsheetUrl = typeof payload?.export?.spreadsheetUrl === "string" ? payload.export.spreadsheetUrl : null;
      if (!spreadsheetUrl) throw new Error("google-export-invalid-response");
      setUrl(spreadsheetUrl);
      setState("ready");
      setNotice(`สร้างไฟล์สำเร็จ ${payload?.export?.sheets?.length ?? 0} ชีต · สิทธิ์เข้าถึงจะใช้เฉพาะในหน้านี้`);
    } catch (error) {
      setState("failed");
      const code = error instanceof Error ? error.message : "google-export-failed";
      const messages: Record<string, string> = {
        "google-authorization-required": "สิทธิ์ Google หมดอายุ กรุณากดสร้างไฟล์ใหม่เพื่ออนุญาตอีกครั้ง",
        "google-rate-limited": "Google จำกัดการเรียกชั่วคราว กรุณารอสักครู่แล้วลองใหม่",
        "database-not-ready": "ฐานข้อมูลสำหรับสร้างไฟล์ยังไม่พร้อม",
        "export-too-large": "ข้อมูลมีหลายกลุ่มเกินขอบเขตของ Google Sheets",
        "google-export-failed": "สร้าง Google Sheets ไม่สำเร็จชั่วคราว",
      };
      setNotice(messages[code] ?? "ยกเลิกหรืออนุญาต Google ไม่สำเร็จ");
    }
  }

  return (
    <section aria-labelledby="social-sheets-export-title" className="mb-5 rounded-3xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="social-sheets-export-title" className="text-lg font-semibold">ส่งออกไป Google Sheets</h2>
          <p className="mt-1 text-sm text-white/65">สร้างไฟล์ใหม่ใน Google Drive พร้อมชีตสรุปโพสต์ ความครอบคลุม และข้อมูลสำหรับตรวจคุณภาพ</p>
        </div>
        <button type="button" onClick={exportSheets} disabled={state === "running" || !googleClientId}
          className="min-h-11 rounded-xl bg-[#9eebce] px-4 py-2.5 text-sm font-semibold text-[#101820] hover:bg-[#b6f3dc] focus:outline-none focus:ring-2 focus:ring-[#e0c985] disabled:cursor-not-allowed disabled:opacity-50">
          {state === "running" ? "กำลังสร้างไฟล์…" : "สร้าง Google Sheets"}
        </button>
      </div>
      {notice ? <p role="status" className={`mt-3 text-sm ${state === "ready" ? "text-emerald-200" : "text-rose-200"}`}>{notice}</p> : null}
      {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/85 hover:bg-white/5">เปิด Google Sheet</a> : null}
    </section>
  );
}
