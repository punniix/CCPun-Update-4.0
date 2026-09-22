"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { adminDataLaneLabel } from "@/lib/admin/presentation";

type PreviewRow = {
  keyword: string;
  intent?: string;
  volume?: number;
  difficulty?: number;
  cpc?: number;
  paidDifficulty?: number;
  sourceRow: number;
  status: "new" | "changed" | "existing";
};

type PreviewPayload = {
  fileName: string;
  counts: {
    sourceRows: number;
    validRows: number;
    newRows: number;
    changedRows: number;
    existingRows: number;
    duplicateRows: number;
    invalidRows: number;
  };
  invalidRows: Array<{ row: number; reason: string }>;
  rows: PreviewRow[];
};

const errorMessages: Record<string, string> = {
  "csv-too-large": "ไฟล์ใหญ่เกิน 2 MB กรุณาแบ่งไฟล์แล้วลองใหม่",
  "csv-too-many-rows": "รองรับไม่เกิน 200 แถวต่อครั้ง กรุณาแบ่งไฟล์แล้วนำเข้าเป็นรอบ",
  "csv-header-unsupported": "ยังอ่านหัวตารางของไฟล์นี้ไม่ได้ กรุณา Export จากหน้า Keyword Ideas ของ Ubersuggest",
  "csv-no-valid-rows": "ไม่พบแถวคำค้นที่นำเข้าได้ในไฟล์นี้",
  "csv-invalid": "ไฟล์ CSV มีรูปแบบไม่ถูกต้องหรืออ่านไม่ได้",
  "research-read-unavailable": "ยังอ่านประวัติข้อมูลเดิมไม่ได้ จึงหยุดไว้ก่อนเพื่อป้องกันข้อมูลซ้ำ",
  "research-write-not-configured": "ระบบนี้ยังไม่ได้รับสิทธิ์บันทึกข้อมูลประกอบ",
  "research-import-failed": "นำเข้าข้อมูลไม่สำเร็จ ระบบหยุดไว้โดยไม่แก้บทความหรือเผยแพร่อะไร",
};

function statusLabel(status: PreviewRow["status"]) {
  if (status === "new") return "ใหม่";
  if (status === "changed") return "ข้อมูลเปลี่ยน";
  return "มีอยู่แล้ว";
}

function statusClass(status: PreviewRow["status"]) {
  if (status === "new") return "bg-emerald-300/10 text-emerald-200";
  if (status === "changed") return "bg-amber-300/10 text-amber-100";
  return "bg-white/5 text-white/55";
}

export default function UbersuggestCsvImport() {
  const router = useRouter();
  const laneLabel = adminDataLaneLabel();
  const [state, setState] = useState<"idle" | "previewing" | "ready" | "importing" | "done" | "error">("idle");
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [message, setMessage] = useState("");
  const [formElement, setFormElement] = useState<HTMLFormElement | null>(null);

  async function send(action: "preview" | "import", form: HTMLFormElement) {
    const data = new FormData(form);
    data.set("action", action);
    const response = await fetch("/api/admin/research/ubersuggest/import/", { method: "POST", body: data }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    return { response, payload };
  }

  async function previewFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setFormElement(form);
    setState("previewing");
    setMessage("");
    setPreview(null);

    const { response, payload } = await send("preview", form);
    if (!response?.ok) {
      setMessage(errorMessages[payload?.error] ?? "ยังตรวจไฟล์ไม่ได้ กรุณาลองใหม่");
      setState("error");
      return;
    }
    setPreview(payload as PreviewPayload);
    setState("ready");
  }

  async function importFile() {
    if (!formElement || !preview) return;
    const importable = preview.counts.newRows + preview.counts.changedRows;
    if (!importable) return;
    if (!window.confirm(`นำเข้า ${importable} คำจาก Ubersuggest เข้า ${laneLabel} หรือไม่? ระบบจะเพิ่มเฉพาะข้อมูลค้นคว้าและจะไม่แก้หรือเผยแพร่บทความเอง`)) return;

    setState("importing");
    setMessage("");
    const { response, payload } = await send("import", formElement);
    if (!response || (response.status !== 207 && !response.ok)) {
      setMessage(errorMessages[payload?.error] ?? "นำเข้าข้อมูลไม่สำเร็จ กรุณาลองใหม่");
      setState("error");
      return;
    }

    const parts = [
      `เพิ่มใหม่ ${payload?.imported ?? 0}`,
      payload?.reused ? `ใช้รายการเดิม ${payload.reused}` : null,
      payload?.skippedExisting ? `ข้ามข้อมูลเดิม ${payload.skippedExisting}` : null,
      payload?.failed ? `ไม่สำเร็จ ${payload.failed}` : null,
    ].filter(Boolean);
    setMessage(parts.join(" · "));
    setState(payload?.failed ? "error" : "done");
    router.refresh();
  }

  return (
    <section className="rounded-3xl border border-sky-200/15 bg-sky-200/[0.035] p-5 md:p-6">
      <div>
        <p className="text-xs font-semibold tracking-[0.12em] text-sky-200">นำเข้าจากเว็บไซต์ Ubersuggest</p>
        <h2 className="mt-2 text-lg font-semibold">นำเข้า Keyword Ideas จากไฟล์ CSV</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
          ใช้เมื่อคุณค้นหรือกรองข้อมูลบนเว็บไซต์ Ubersuggest แล้ว Export เป็น CSV ระบบจะตรวจคำซ้ำและข้อมูลเดิมก่อนบันทึก
          โดยยังไม่ Track keyword หรือสร้างบทความให้อัตโนมัติ
        </p>
      </div>

      <form ref={setFormElement} onSubmit={previewFile} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_180px_180px_auto] xl:items-end">
        <label className="text-sm text-white/70">
          ไฟล์ CSV
          <input
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            onChange={() => { setPreview(null); setMessage(""); setState("idle"); }}
            className="mt-2 block min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-white"
          />
        </label>
        <label className="text-sm text-white/70">
          ตลาด
          <input name="location" defaultValue="Thailand" maxLength={120} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white" />
        </label>
        <label className="text-sm text-white/70">
          ภาษา
          <input name="language" defaultValue="Thai" maxLength={80} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white" />
        </label>
        <button type="submit" disabled={state === "previewing" || state === "importing"} className="min-h-11 rounded-xl border border-sky-200/20 bg-sky-200/10 px-4 py-2.5 text-sm font-semibold text-sky-50 disabled:opacity-40">
          {state === "previewing" ? "กำลังตรวจไฟล์…" : "ตรวจไฟล์ก่อนนำเข้า"}
        </button>
      </form>

      <p className="mt-3 text-xs leading-5 text-white/45">
        รองรับ Keyword, Intent, Volume, CPC, Paid Difficulty และ SEO Difficulty จาก Ubersuggest Keyword Ideas
        โดย Research History จะแสดง Keyword, Intent, Volume และ SEO Difficulty; CPC/PD ถูกเก็บเป็นข้อมูลอ้างอิงในประวัติการนำเข้า
      </p>

      {preview ? (
        <div className="mt-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <article className="rounded-xl border border-white/10 bg-black/10 p-3"><div className="text-xs text-white/45">แถวในไฟล์</div><div className="mt-1 text-lg font-semibold">{preview.counts.sourceRows}</div></article>
            <article className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.05] p-3"><div className="text-xs text-emerald-100/65">คำใหม่</div><div className="mt-1 text-lg font-semibold text-emerald-100">{preview.counts.newRows}</div></article>
            <article className="rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-3"><div className="text-xs text-amber-100/65">ข้อมูลเปลี่ยน</div><div className="mt-1 text-lg font-semibold text-amber-100">{preview.counts.changedRows}</div></article>
            <article className="rounded-xl border border-white/10 bg-black/10 p-3"><div className="text-xs text-white/45">มีอยู่แล้ว</div><div className="mt-1 text-lg font-semibold">{preview.counts.existingRows}</div></article>
            <article className="rounded-xl border border-white/10 bg-black/10 p-3"><div className="text-xs text-white/45">ซ้ำในไฟล์</div><div className="mt-1 text-lg font-semibold">{preview.counts.duplicateRows}</div></article>
            <article className="rounded-xl border border-white/10 bg-black/10 p-3"><div className="text-xs text-white/45">อ่านไม่ได้</div><div className="mt-1 text-lg font-semibold">{preview.counts.invalidRows}</div></article>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/10">
            <div className="border-b border-white/10 px-4 py-3">
              <div className="font-medium">{preview.fileName}</div>
              <div className="mt-1 text-xs text-white/45">แสดงตัวอย่างข้อมูลที่ผ่านการตรวจแล้วก่อนบันทึก</div>
            </div>
            <div role="region" aria-label="ตัวอย่างข้อมูล Ubersuggest CSV" tabIndex={0} className="max-h-[460px] overflow-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="sticky top-0 bg-[#252025] text-xs text-white/55">
                  <tr>
                    <th className="px-4 py-3">คำค้น</th>
                    <th className="px-4 py-3">สถานะ</th>
                    <th className="px-4 py-3">Intent</th>
                    <th className="px-4 py-3">Volume</th>
                    <th className="px-4 py-3">SEO Difficulty</th>
                    <th className="px-4 py-3">CPC</th>
                    <th className="px-4 py-3">Paid Difficulty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {preview.rows.map((row) => (
                    <tr key={`${row.sourceRow}:${row.keyword}`}>
                      <td className="px-4 py-3 font-medium text-white/80">{row.keyword}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs ${statusClass(row.status)}`}>{statusLabel(row.status)}</span></td>
                      <td className="px-4 py-3 text-white/60">{row.intent ?? "—"}</td>
                      <td className="px-4 py-3 text-white/60">{row.volume ?? "—"}</td>
                      <td className="px-4 py-3 text-white/60">{row.difficulty ?? "—"}</td>
                      <td className="px-4 py-3 text-white/60">{row.cpc ?? "—"}</td>
                      <td className="px-4 py-3 text-white/60">{row.paidDifficulty ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {preview.invalidRows.length ? (
            <div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-3 text-sm text-amber-50/80">
              มีบางแถวที่ไม่นำเข้า: {preview.invalidRows.slice(0, 5).map((item) => `แถว ${item.row} — ${item.reason}`).join(" · ")}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={importFile}
              disabled={state === "importing" || preview.counts.newRows + preview.counts.changedRows === 0}
              className="min-h-11 rounded-xl bg-[#e0c985] px-4 py-2.5 text-sm font-semibold text-[#17191d] disabled:opacity-40"
            >
              {state === "importing" ? "กำลังนำเข้า…" : `นำเข้า ${preview.counts.newRows + preview.counts.changedRows} รายการ`}
            </button>
            {preview.counts.newRows + preview.counts.changedRows === 0 ? <span className="text-sm text-white/55">ไฟล์นี้ไม่มีข้อมูลใหม่ที่ต้องบันทึก</span> : null}
          </div>
        </div>
      ) : null}

      {message ? <p role={state === "error" ? "alert" : "status"} className={`mt-4 text-sm leading-6 ${state === "error" ? "text-red-200" : "text-emerald-200"}`}>{message}</p> : null}
    </section>
  );
}
