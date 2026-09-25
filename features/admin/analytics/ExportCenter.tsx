"use client";

import { useEffect, useState } from "react";

const OPTIONS = [
  ["social-performance", "Social Performance", "Social"],
  ["seo-intelligence", "SEO Search Intelligence", "SEO"],
  ["crm-overview", "ภาพรวม CRM", "CRM & Operations"],
  ["crm-leads", "รายชื่อลูกค้า CRM", "CRM & Operations"],
  ["crm-follow-ups", "งานติดตามลูกค้า", "CRM & Operations"],
  ["growth-funnel", "Growth Funnel", "CRM & Operations"],
  ["customer-insights", "Customer Insights", "CRM & Operations"],
  ["automation-runs", "Automation Runs", "CRM & Operations"],
] as const;

const GROUPS = ["Social", "SEO", "CRM & Operations"] as const;
type Dataset = (typeof OPTIONS)[number][0];

const DATASET_HELP: Record<Dataset, string> = {
  "social-performance": "1 แถวต่อโพสต์จาก clean marketing mart พร้อม metrics, coverage และสถานะคุณภาพข้อมูล",
  "seo-intelligence": "รวม Keyword Research และ AISV Prompt ที่บันทึกไว้แล้ว โดยไม่ยิง provider สดตอน export",
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
  const [dataset, setDataset] = useState<Dataset>("social-performance");
  const [jobId, setJobId] = useState<string | null>(null);
  const [runtimePath, setRuntimePath] = useState<string | null>(null);
  const [detail, setDetail] = useState<RuntimeDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
        body: JSON.stringify({ dataset }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "export_failed");
      setJobId(String(data.jobId));
      setRuntimePath(String(data.runtimePath));
      setMessage("รับงานแล้ว ระบบกำลังสร้าง Google Sheet ให้");
    } catch {
      setMessage("ยังเริ่มสร้าง Google Sheet ไม่ได้ ใช้ CSV ได้ตามปกติ");
    } finally {
      setBusy(false);
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
              setJobId(null);
              setDetail(null);
              setMessage(null);
            }}
            className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white"
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

        <div className="mt-5 flex flex-wrap gap-3">
          <a href={"/api/admin/exports/csv/?dataset=" + encodeURIComponent(dataset)} className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 text-sm text-white/80 transition hover:bg-white/5">
            ดาวน์โหลด CSV
          </a>
          <button type="button" onClick={createGoogleSheet} disabled={busy} className="min-h-11 rounded-xl bg-[#e0c985] px-4 text-sm font-medium text-[#251818] disabled:opacity-50">
            {busy ? "กำลังส่งงาน…" : "สร้าง Google Sheet"}
          </button>
        </div>

        <p className="mt-4 text-xs leading-5 text-white/50">
          ชื่อไฟล์และวันเวลาใช้ Asia/Bangkok (UTC+7) ทั้งหมด CSV เป็น UTF-8 เปิดใน Excel/Numbers ได้ และ Google Sheet มีแท็บภาพรวมกับข้อมูลพร้อมใช้งาน
        </p>
      </section>

      {jobId ? (
        <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">GOOGLE SHEET JOB</p>
          <p className="mt-2 text-lg font-semibold">
            {detail ? statusText(detail.job.status) : "กำลังรับสถานะ…"}
          </p>
          {detail ? <p className="mt-1 text-sm text-white/55">ขั้นตอน: {detail.job.stage}</p> : null}
          {detail?.job.errorCategory ? <p className="mt-3 text-sm text-rose-200">{detail.job.errorCategory}</p> : null}
          <div className="mt-4 flex flex-wrap gap-3">
            {detail?.job.providerReference?.startsWith("https://docs.google.com/spreadsheets/") ? (
              <a href={detail.job.providerReference} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-xl bg-[#e0c985] px-4 text-sm font-medium text-[#251818]">
                เปิด Google Sheet
              </a>
            ) : null}
            {runtimePath ? (
              <a href={runtimePath} className="inline-flex min-h-10 items-center rounded-xl border border-white/10 px-4 text-sm text-white/70">
                ดูรายละเอียด Runtime
              </a>
            ) : null}
          </div>
        </section>
      ) : null}

      {message ? <p className="mt-4 text-sm text-white/60">{message}</p> : null}
    </div>
  );
}
