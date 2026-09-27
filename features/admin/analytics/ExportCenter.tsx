"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import type { ExportAnalysisView } from "@/lib/admin/agent-os/export-contract";
const VIEWS: Array<[ExportAnalysisView | "", string]> = [["", "ข้อมูลรวมทุกแหล่ง (ใช้เก็บอ้างอิง)"], ["seo-review", "งานตรวจ SEO"], ["measurement-gaps", "ข้อมูลที่ต้องเชื่อม"], ["campaign-performance", "แคมเปญและหน้าเข้า"], ["marketing-activities", "กิจกรรม CI / FHC / LINE"]];

const OPTIONS = [
  ["marketing-analytics", "Dashboard รวม: Google, Social และ SEO", "Dashboard รวม"],
  ["social-performance", "Social Performance", "Social"],
  ["seo-intelligence", "SEO Search Intelligence", "SEO"],
  ["crm-overview", "ภาพรวม CRM", "CRM & Operations"],
  ["crm-leads", "รายชื่อลูกค้า CRM", "CRM & Operations"],
  ["crm-follow-ups", "งานติดตามลูกค้า", "CRM & Operations"],
  ["growth-funnel", "Growth Funnel", "CRM & Operations"],
  ["customer-insights", "Customer Insights", "CRM & Operations"],
  ["automation-runs", "Automation Runs", "CRM & Operations"],
] as const;

const GROUPS = ["Dashboard รวม", "Social", "SEO", "CRM & Operations"] as const;
type Dataset = (typeof OPTIONS)[number][0];

const DATASET_HELP: Record<Dataset, string> = {
  "marketing-analytics": "ใช้ชุดข้อมูลล่าสุดที่บันทึกสำเร็จของแต่ละแหล่ง พร้อมช่วงข้อมูล เวลาอัปเดต และคำอธิบายคอลัมน์ ไม่เรียก API ต้นทางตอนส่งออก",
  "social-performance": "ข้อมูลโพสต์ Meta จากชุดที่บันทึกสำเร็จล่าสุด อ่าน insights ของ 50 โพสต์ล่าสุดต่อแพลตฟอร์ม ส่วนโพสต์อื่นอาจมีเฉพาะข้อมูลประกอบ พร้อมเวลาและข้อจำกัดของแต่ละ metric",
  "seo-intelligence": "รวม Keyword Research, AISV และ CSV จากเว็บ Ubersuggest ที่บันทึกสำเร็จแล้ว พร้อมช่วงข้อมูลและวันที่ต้นทางอัปเดต",
  "crm-overview": "สรุปจำนวน Lead งานติดตาม และผลลัพธ์หลักของ CRM",
  "crm-leads": "รายชื่อลูกค้าและสถานะการดูแลแบบ owner-friendly",
  "crm-follow-ups": "รายการติดตามลูกค้าที่ต้องทำต่อ",
  "growth-funnel": "สรุปเส้นทางจากการเริ่มต้นจนถึง Qualified / Won / Lost",
  "customer-insights": "คำถามที่พบบ่อยและ Content Gap จากข้อมูลลูกค้า",
  "automation-runs": "สถานะงานเบื้องหลังล่าสุดจาก Agent OS และระบบที่เกี่ยวข้อง",
};

type RuntimeDetail = {
  terminal: boolean;
  job: {
    status: string;
    stage: string;
    providerReference: string | null;
    errorCategory: string | null;
  };
};

function statusText(status: string) {
  if (status === "queued") return "รอคิว";
  if (status === "running") return "กำลังสร้าง";
  if (status === "waiting_external") return "กำลังรอ Google";
  if (status === "completed") return "เสร็จแล้ว";
  if (status === "failed") return "ไม่สำเร็จ";
  if (status === "reconciliation_required") return "ต้องตรวจผล";
  return status;
}

export function ExportCenter() {
  const [view, setView] = useState<ExportAnalysisView | "">("");
  const [dataset, setDataset] = useState<Dataset>("marketing-analytics");
  const [jobId, setJobId] = useState<string | null>(null);
  const [runtimePath, setRuntimePath] = useState<string | null>(null);
  const [detail, setDetail] = useState<RuntimeDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(window.localStorage.getItem("ccpun-owner-sheet-job") || "null") as { jobId?: unknown; runtimePath?: unknown } | null;
        if (saved && typeof saved.jobId === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(saved.jobId)) {
          setJobId(saved.jobId);
          if (typeof saved.runtimePath === "string" && saved.runtimePath.startsWith("/operations/jobs/")) setRuntimePath(saved.runtimePath);
        }
      } catch {
        // Export remains available when browser storage is blocked.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!jobId || detail?.terminal) return;
    const activeJobId = jobId;
    let stopped = false;
    async function poll() {
      try {
        const response = await fetch("/api/admin/operations/jobs/" + encodeURIComponent(activeJobId) + "/", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) return;
        const next = await response.json() as RuntimeDetail;
        if (!stopped) setDetail(next);
      } catch {
        // Keep the last confirmed status visible; the next poll may recover.
      }
    }
    void poll();
    const timer = window.setInterval(poll, 3000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [jobId, detail?.terminal]);

  async function createGoogleSheet() {
    setBusy(true);
    setMessage(null);
    setJobId(null);
    setDetail(null);
    try {
      const response = await fetch("/api/admin/exports/google-sheet/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset, ...(dataset === "marketing-analytics" && view ? { view } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "export_failed");
      setJobId(String(data.jobId));
      setRuntimePath(String(data.runtimePath));
      try {
        window.localStorage.setItem("ccpun-owner-sheet-job", JSON.stringify({ jobId: String(data.jobId), runtimePath: String(data.runtimePath) }));
      } catch {
        // The server job remains retrievable from Operations even without browser storage.
      }
      setMessage("รับงานแล้ว ระบบกำลังสร้าง Google Sheet ให้");
    } catch {
      setMessage("ยังเริ่มสร้าง Google Sheet ไม่ได้ ใช้ CSV ได้ตามปกติ");
    } finally {
      setBusy(false);
    }
  }

  async function importUbersuggest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = new FormData(form);
    const file = input.get("file");
    if (!(file instanceof File) || !file.size || file.size > 2 * 1024 * 1024) {
      setImportMessage("เลือกไฟล์ CSV ที่มีข้อมูลและขนาดไม่เกิน 2 MB");
      return;
    }
    if (String(input.get("windowStart")) > String(input.get("windowEnd"))) {
      setImportMessage("วันสิ้นสุดต้องเป็นวันเดียวกันหรือหลังวันเริ่มต้น");
      return;
    }
    setImportBusy(true);
    setImportMessage(null);
    try {
      const response = await fetch("/api/admin/analytics/import/", { method: "POST", body: input });
      const data = await response.json();
      if (!response.ok) {
        setImportMessage(response.status === 413 ? "ไฟล์ใหญ่เกิน 2 MB กรุณาแบ่งไฟล์ก่อนนำเข้า" : response.status === 400 ? "ยังนำเข้าไม่ได้ ตรวจรูปแบบ CSV และข้อมูลช่วงวัน พื้นที่ ภาษาอีกครั้ง" : "ยังบันทึกไฟล์ไม่ได้ ลองใหม่ภายหลัง ไฟล์เดิมที่บันทึกไว้ยังใช้งานได้");
        return;
      }
      setImportMessage(data.status === "duplicate" ? "ไฟล์นี้บันทึกไว้แล้ว ไม่เพิ่มข้อมูลซ้ำ เปิด Dashboard หรือส่งออกได้เลย" : `บันทึก ${Number(data.rows).toLocaleString("th-TH")} แถวแล้ว จากต้นทาง ${Number(data.sourceRows).toLocaleString("th-TH")} แถว · ซ้ำ ${Number(data.duplicateRows).toLocaleString("th-TH")} แถว · รูปแบบไม่ถูกต้อง ${Number(data.invalidRowCount).toLocaleString("th-TH")} แถว`);
    } catch {
      setImportMessage("ยังตรวจผลการบันทึกไม่ได้ ลองใหม่ด้วยไฟล์เดิมได้ ระบบจะตรวจข้อมูลซ้ำก่อนบันทึก");
    } finally {
      setImportBusy(false);
    }
  }

  return (
    <div>
      <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 md:p-6">
        <label className="block max-w-xl text-sm text-white/70">
          เลือกข้อมูลที่ต้องการ
          <select
            value={dataset}
            onChange={(event) => {
              setDataset(event.target.value as Dataset);
              setView("");
              setJobId(null);
              setDetail(null);
              setMessage(null);
            }}
            className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-[#251818] px-3 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0c985]"
          >
            {GROUPS.map((group) => (
              <optgroup key={group} label={group}>
                {OPTIONS.filter(([, , optionGroup]) => optionGroup === group).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <p className="mt-2 max-w-2xl text-xs leading-5 text-white/50">{DATASET_HELP[dataset]}</p>

        {dataset === "marketing-analytics" ? <label className="mt-4 block max-w-xl text-sm text-white/70">เลือกชุดวิเคราะห์สำหรับ CSV / Google Sheet<select value={view} onChange={event => setView(event.target.value as ExportAnalysisView | "")} className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-[#251818] px-3 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0c985]">{VIEWS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><span className="mt-2 block text-xs leading-5 text-white/50">แต่ละชุดแยกประเภทข้อมูลเพื่อทำ Pivot ต่อได้ Excel ดาวน์โหลดทั้งสมุดงานเสมอ หากยังไม่มีรายงานแคมเปญหรือกิจกรรม ระบบจะแจ้งว่าไม่มีข้อมูลแทนศูนย์</span></label> : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <a href={dataset === "marketing-analytics" ? "/api/admin/analytics/export/?format=csv" + (view ? "&view=" + encodeURIComponent(view) : "") : "/api/admin/exports/csv/?dataset=" + encodeURIComponent(dataset)} className="inline-flex min-h-11 items-center rounded-xl border border-white/15 px-4 text-sm text-white/80 transition hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0c985]">
            ดาวน์โหลด CSV
          </a>
          {dataset === "marketing-analytics" ? <a href="/api/admin/analytics/export/?format=xlsx" className="inline-flex min-h-11 items-center rounded-xl border border-white/15 px-4 text-sm text-white/80 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0c985]">ดาวน์โหลด Excel หลายชีต</a> : null}
          <button type="button" onClick={createGoogleSheet} disabled={busy} className="min-h-11 rounded-xl bg-[#e0c985] px-4 text-sm font-medium text-[#251818] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e0c985]">
            {busy ? "กำลังส่งงาน…" : "สร้าง Google Sheet"}
          </button>
        </div>

        <p className="mt-4 text-xs leading-5 text-white/50">
          เวลาเก็บและสร้างไฟล์ใช้เวลาไทย (UTC+7) CSV เป็น UTF-8 เปิดใน Excel/Numbers ได้ Excel แยกชีตตามรายงานพร้อมคำอธิบาย Google Sheet มีชีตภาพรวมพร้อมวิธีอ่าน และชีตข้อมูลตามชุดที่เลือก การสร้างไฟล์ไม่ต้องรอรอบอัปเดตรายวัน ค่าว่างหมายถึงไม่มีข้อมูล ไม่ใช่ศูนย์
        </p>
      </section>

      {jobId ? (
        <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5" aria-live="polite">
          <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">Google Sheet ล่าสุดที่คุณสร้าง</p>
          <p className="mt-2 text-lg font-semibold">
            {detail ? statusText(detail.job.status) : "กำลังรับสถานะ…"}
          </p>
          {detail?.job.errorCategory ? <p className="mt-3 text-sm text-rose-200">สร้างไฟล์ไม่สำเร็จ ลองใหม่ได้โดยใช้ข้อมูลเดิม หรือดาวน์โหลด CSV / Excel</p> : null}
          <div className="mt-4 flex flex-wrap gap-3">
            {detail?.job.providerReference?.startsWith("https://docs.google.com/spreadsheets/") ? (
              <a href={detail.job.providerReference} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl bg-[#e0c985] px-4 text-sm font-medium text-[#251818] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0c985]">
                เปิด Google Sheet
              </a>
            ) : null}
            {runtimePath ? (
              <Link href={runtimePath} className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 text-sm text-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0c985]">
                ดูสถานะการสร้างไฟล์
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      <Link href="/operations/jobs/" className="mt-4 inline-flex min-h-11 items-center text-sm text-[#e0c985] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0c985]">เปิดประวัติงานและไฟล์ที่สร้างไว้</Link>
      {message ? <p className="mt-4 text-sm text-white/60" role="status">{message}</p> : null}

      <section className="mt-8 border-t border-white/15 pt-6" aria-labelledby="ubersuggest-import-title">
        <h2 id="ubersuggest-import-title" className="text-lg font-semibold">นำเข้าไฟล์รายงานจากเว็บ Ubersuggest</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">ใช้ไฟล์ CSV ที่คุณดาวน์โหลดจากเว็บ Ubersuggest ระบบเก็บข้อมูลต้นฉบับและจัดคอลัมน์ให้อ่านง่าย การนำเข้าไม่เรียก Ubersuggest API และไม่ทำให้ข้อมูลเก่ากลายเป็นข้อมูลใหม่ โปรดระบุช่วงข้อมูลจริงจากรายงาน หากเป็นข้อมูล ณ วันเดียวให้ใส่วันเริ่มและวันสิ้นสุดเดียวกัน</p>
        <form onSubmit={importUbersuggest} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-white/70 sm:col-span-2">ไฟล์ CSV (ไม่เกิน 2 MB)<input name="file" type="file" accept=".csv,text/csv" required className="mt-2 block min-h-11 w-full rounded-xl border border-white/15 p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0c985]" /></label>
          <label className="text-sm text-white/70">วันที่ข้อมูลเริ่ม<input name="windowStart" type="date" required className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-[#251818] px-3 text-white [color-scheme:dark] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0c985]" /></label>
          <label className="text-sm text-white/70">วันที่ข้อมูลสิ้นสุด<input name="windowEnd" type="date" required className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-[#251818] px-3 text-white [color-scheme:dark] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0c985]" /></label>
          <label className="text-sm text-white/70">วันที่ต้นทางอัปเดตล่าสุด (ถ้ารายงานระบุ)<input name="sourceAsOf" type="date" className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-[#251818] px-3 text-white [color-scheme:dark] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0c985]" /><span className="mt-1 block text-xs leading-5 text-white/60">ใช้วันที่ตามรายงานโดยตรง เว้นว่างหากไม่ทราบ ระบบไม่เติมเวลาและเขตเวลาที่ต้นทางไม่ได้ระบุ</span></label>
          <label className="text-sm text-white/70">พื้นที่ของรายงาน<input name="market" required maxLength={120} placeholder="เช่น Thailand" className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-[#251818] px-3 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0c985]" /></label>
          <label className="text-sm text-white/70">ภาษาของรายงาน<input name="language" required maxLength={80} placeholder="เช่น Thai" className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-[#251818] px-3 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0c985]" /></label>
          <label className="text-sm text-white/70">สกุลเงิน CPC (ถ้ารายงานระบุ)<input name="currency" pattern="[A-Z]{3}" maxLength={3} placeholder="เช่น THB หรือ USD · เว้นว่างหากไม่ทราบ" className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-[#251818] px-3 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0c985]" /></label>
          <button type="submit" disabled={importBusy} className="min-h-11 self-end rounded-xl border border-[#e0c985]/50 px-4 py-2.5 text-sm text-[#e0c985] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0c985]">{importBusy ? "กำลังบันทึกไฟล์…" : "บันทึกไฟล์เข้าคลังข้อมูล"}</button>
        </form>
        {importMessage ? <p className="mt-4 text-sm leading-6 text-white/80" role="status">{importMessage}</p> : null}
        <Link href="/analytics/?report=ubersuggest-web-keywords" className="mt-3 inline-flex min-h-11 items-center text-sm text-[#e0c985] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0c985]">ดูรายงาน Ubersuggest ที่บันทึกไว้</Link>
      </section>
    </div>
  );
}
