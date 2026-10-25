"use client";

import { useMemo, useState } from "react";

type ArticleRef = { documentId: string; title: string; canonicalUrl: string };
type DigestStatus = "draft" | "reviewed" | "scheduled" | "sent" | "cancelled";
type JobStatus = "queued" | "claimed" | "succeeded" | "failed" | "needs_attention" | "cancelled";

export type EmailDigestView = {
  id: string;
  month: string;
  subject: string;
  preheader: string;
  intro: string;
  closing: string | null;
  articles: ArticleRef[];
  status: DigestStatus;
  version: number;
  contentVersion: number;
  reviewedContentVersion: number | null;
  reviewedAt: string | null;
  scheduledAt: string | null;
  jobId: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkerJobView = {
  id: string;
  channel: string;
  objectId: string;
  scheduledAt: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  lastErrorCode: string | null;
  version: number;
  updatedAt: string;
};

export type EmailDigestWorkspaceData = {
  store: string;
  sendEnabled: boolean;
  digests: EmailDigestView[];
  jobs: WorkerJobView[];
};

const CONFIRMATION = "ยืนยันการส่ง";
const dateTime = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const DIGEST_LABELS: Record<DigestStatus, string> = { draft: "ฉบับร่าง", reviewed: "ตรวจแล้ว", scheduled: "ตั้งเวลาแล้ว", sent: "ส่งแล้ว", cancelled: "ยกเลิกแล้ว" };
const JOB_LABELS: Record<JobStatus, string> = { queued: "รอส่ง", claimed: "n8n กำลังส่ง", succeeded: "ส่งสำเร็จ", failed: "ไม่สำเร็จ", needs_attention: "สถานะยังไม่ชัด ต้องตรวจ", cancelled: "ยกเลิกแล้ว" };
const ERROR_LABELS: Record<string, string> = {
  "send-disabled": "ระบบยังปิดการส่งอีเมลอยู่",
  "confirmation-required": `ต้องพิมพ์ "${CONFIRMATION}" ก่อน`,
  "version-conflict": "มีการแก้ไขฉบับนี้จากที่อื่น กรุณาโหลดหน้าใหม่",
  "invalid-transition": "สถานะปัจจุบันยังทำขั้นตอนนี้ไม่ได้",
  "digest-incomplete": "ต้องมีหัวเรื่อง ข้อความเปิด และบทความอย่างน้อย 1 เรื่อง",
  "month-taken": "เดือนนี้มีอีเมลรายเดือนอยู่แล้ว",
  "schedule-time-invalid": "เวลาที่ตั้งต้องห่างจากตอนนี้อย่างน้อย 5 นาที และไม่เกิน 60 วัน",
  "job-in-flight": "n8n กำลังส่งอยู่ ยกเลิกตอนนี้ไม่ได้",
  "ambiguous-ack-required": "ต้องยืนยันว่าตรวจแล้วว่ายังไม่ได้ส่งจริง",
  "migration-pending": "ยังไม่ได้ติดตั้งตารางของอีเมลรายเดือน",
  "content-not-configured": "ยังไม่ได้ตั้งค่าการอ่านบทความ",
  "content-unavailable": "ตอนนี้อ่านรายการบทความไม่ได้",
  "invalid-request": "ข้อมูลไม่ครบหรือไม่ถูกต้อง",
};

type Draft = { month: string; subject: string; preheader: string; intro: string; closing: string; articles: ArticleRef[] };
const emptyDraft = (month: string): Draft => ({ month, subject: "", preheader: "", intro: "", closing: "", articles: [] });
const fromDigest = (digest: EmailDigestView): Draft => ({ month: digest.month, subject: digest.subject, preheader: digest.preheader, intro: digest.intro, closing: digest.closing ?? "", articles: digest.articles });
const key = (action: string) => `email-digest-${action}:${crypto.randomUUID()}`;

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(path, {
    method: init?.method ?? "GET",
    credentials: "same-origin",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const payload = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok || !payload) throw new Error(payload?.error ?? "request-failed");
  return payload;
}

const button = "inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#e0c985] disabled:cursor-not-allowed disabled:opacity-40";
const primary = `${button} bg-[#e0c985] font-semibold text-[#17191d] hover:brightness-105`;
const secondary = `${button} border border-white/10 text-white/75 hover:bg-white/5`;
const selectField = "w-fit rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#e0c985]";
const field = "mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-[#e0c985]";

export default function EmailDigestWorkspace({ initial, defaultMonth }: { initial: EmailDigestWorkspaceData; defaultMonth: string }) {
  const [data, setData] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(initial.digests.find((digest) => digest.status !== "cancelled")?.id ?? null);
  const selected = data.digests.find((digest) => digest.id === selectedId) ?? null;
  const [draft, setDraft] = useState<Draft>(selected ? fromDigest(selected) : emptyDraft(defaultMonth));
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ackAmbiguous, setAckAmbiguous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const storeReady = data.store === "ready";
  const job = useMemo(() => (selected?.jobId ? data.jobs.find((item) => item.id === selected.jobId) ?? null : null), [data.jobs, selected]);
  const editable = !selected || selected.status === "draft" || selected.status === "reviewed";

  function select(id: string | null) {
    setSelectedId(id);
    const digest = data.digests.find((item) => item.id === id);
    setDraft(digest ? fromDigest(digest) : emptyDraft(defaultMonth));
    setPreviewHtml(null);
    setMessage(null);
  }

  async function run(action: () => Promise<string>) {
    setBusy(true);
    setMessage(null);
    try {
      setMessage({ tone: "ok", text: await action() });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setMessage({ tone: "error", text: ERROR_LABELS[code] ?? "ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง" });
    } finally {
      setBusy(false);
    }
  }

  async function refresh(nextSelected?: string) {
    const workspace = await call<EmailDigestWorkspaceData>("/api/admin/social/email-digests/");
    setData(workspace);
    if (nextSelected) {
      setSelectedId(nextSelected);
      const digest = workspace.digests.find((item) => item.id === nextSelected);
      if (digest) setDraft(fromDigest(digest));
    }
  }

  const content = () => ({ month: draft.month, subject: draft.subject, preheader: draft.preheader, intro: draft.intro, closing: draft.closing.trim() ? draft.closing : null, articles: draft.articles });

  async function mutate(body: Record<string, unknown>, done: string) {
    const response = await call<{ result: { digest: EmailDigestView; notification: { accepted: boolean } | null } }>("/api/admin/social/email-digests/", { method: "POST", body });
    await refresh(response.result.digest.id);
    if (response.result.notification && !response.result.notification.accepted) return `${done} (ยังแจ้ง n8n ไม่สำเร็จ กดแจ้งอีกครั้งได้ในรายการงานส่ง)`;
    return done;
  }

  const moveArticle = (index: number, delta: number) => setDraft((current) => {
    const articles = [...current.articles];
    const target = index + delta;
    if (target < 0 || target >= articles.length) return current;
    [articles[index], articles[target]] = [articles[target]!, articles[index]!];
    return { ...current, articles };
  });

  return (
    <div className="mt-7 grid items-start gap-6 xl:grid-cols-2">
      <section aria-label="ฉบับอีเมลรายเดือน" className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-white/70" htmlFor="digest-select">ฉบับ</label>
          <select id="digest-select" className={selectField} value={selectedId ?? ""} onChange={(event) => select(event.target.value || null)}>
            <option value="">+ ฉบับใหม่</option>
            {data.digests.map((digest) => <option key={digest.id} value={digest.id}>{digest.month} · {DIGEST_LABELS[digest.status]}</option>)}
          </select>
          {selected ? <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70">{DIGEST_LABELS[selected.status]}</span> : null}
        </div>

        <div className="mt-5 grid gap-4">
          <label className="text-sm text-white/70">เดือน (เวลาไทย)
            <input type="month" className={field} value={draft.month} disabled={!editable} onChange={(event) => setDraft({ ...draft, month: event.target.value })} />
          </label>
          <label className="text-sm text-white/70">หัวเรื่องอีเมล
            <input className={field} maxLength={150} value={draft.subject} disabled={!editable} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} />
          </label>
          <label className="text-sm text-white/70">ข้อความตัวอย่างในกล่องจดหมาย (preheader)
            <input className={field} maxLength={200} value={draft.preheader} disabled={!editable} onChange={(event) => setDraft({ ...draft, preheader: event.target.value })} />
          </label>
          <label className="text-sm text-white/70">ข้อความเปิด (ปั้นเขียนเอง)
            <textarea className={`${field} min-h-36`} maxLength={4000} value={draft.intro} disabled={!editable} onChange={(event) => setDraft({ ...draft, intro: event.target.value })} />
          </label>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white/85">บทความในฉบับนี้ ({draft.articles.length})</h2>
              <button type="button" className={secondary} disabled={busy || !editable} onClick={() => run(async () => {
                const result = await call<{ articles: ArticleRef[] }>(`/api/admin/social/email-digests/assemble/?month=${encodeURIComponent(draft.month)}`);
                if (draft.articles.length > 0 && !window.confirm("แทนที่รายการบทความเดิมด้วยบทความของเดือนนี้?")) return "คงรายการเดิมไว้";
                setDraft((current) => ({ ...current, articles: result.articles }));
                return result.articles.length ? `ดึงบทความของเดือนนี้ ${result.articles.length} เรื่อง จัดลำดับหรือเอาออกได้` : "เดือนนี้ยังไม่มีบทความที่เผยแพร่";
              })}>ดึงบทความของเดือนนี้</button>
            </div>
            <ol className="mt-3 grid gap-2">
              {draft.articles.map((article, index) => (
                <li key={article.documentId} className="flex items-start gap-2 rounded-2xl border border-white/10 bg-black/10 p-3">
                  <span className="mt-0.5 text-xs text-white/45">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white/85">{article.title}</p>
                    <p className="break-all text-xs text-white/45">{article.canonicalUrl}</p>
                  </div>
                  {editable ? (
                    <div className="flex shrink-0 gap-1">
                      <button type="button" aria-label={`เลื่อน ${article.title} ขึ้น`} className={`${secondary} min-h-9 px-2.5 py-1`} disabled={index === 0} onClick={() => moveArticle(index, -1)}>↑</button>
                      <button type="button" aria-label={`เลื่อน ${article.title} ลง`} className={`${secondary} min-h-9 px-2.5 py-1`} disabled={index === draft.articles.length - 1} onClick={() => moveArticle(index, 1)}>↓</button>
                      <button type="button" aria-label={`เอา ${article.title} ออก`} className={`${secondary} min-h-9 px-2.5 py-1`} onClick={() => setDraft({ ...draft, articles: draft.articles.filter((item) => item.documentId !== article.documentId) })}>ลบ</button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>

          <label className="text-sm text-white/70">ข้อความปิดท้าย (ไม่บังคับ)
            <textarea className={`${field} min-h-20`} maxLength={1000} value={draft.closing} disabled={!editable} onChange={(event) => setDraft({ ...draft, closing: event.target.value })} />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className={secondary} disabled={busy} onClick={() => run(async () => {
            const result = await call<{ html: string }>("/api/admin/social/email-digests/preview/", { method: "POST", body: { content: content() } });
            setPreviewHtml(result.html);
            return "สร้างตัวอย่างอีเมลแล้ว";
          })}>ดูตัวอย่างอีเมล</button>
          {editable ? (
            <button type="button" className={primary} disabled={busy || !storeReady} onClick={() => run(() => selected
              ? mutate({ action: "update", digestId: selected.id, expectedVersion: selected.version, idempotencyKey: key("update"), content: content() }, "บันทึกแล้ว ฉบับนี้กลับเป็นฉบับร่างเพื่อให้ตรวจใหม่")
              : mutate({ action: "create", idempotencyKey: key("create"), content: content() }, "สร้างฉบับร่างแล้ว"))}>บันทึกฉบับร่าง</button>
          ) : null}
          {selected?.status === "draft" ? (
            <button type="button" className={secondary} disabled={busy || !storeReady} onClick={() => run(() => mutate({ action: "review", digestId: selected.id, expectedVersion: selected.version, idempotencyKey: key("review") }, "ทำเครื่องหมายว่าตรวจแล้ว"))}>ตรวจแล้ว พร้อมตั้งเวลา</button>
          ) : null}
          {selected && (selected.status === "draft" || selected.status === "reviewed") ? (
            <button type="button" className={secondary} disabled={busy || !storeReady} onClick={() => run(async () => {
              if (!window.confirm("ยกเลิกฉบับนี้? (ข้อมูลยังเก็บไว้ ไม่ถูกลบ)")) return "ยังไม่ยกเลิก";
              return mutate({ action: "cancel", digestId: selected.id, expectedVersion: selected.version, idempotencyKey: key("cancel") }, "ยกเลิกฉบับนี้แล้ว");
            })}>ยกเลิกฉบับนี้</button>
          ) : null}
        </div>

        {selected?.status === "reviewed" ? (
          <div className="mt-5 rounded-2xl border border-[#e0c985]/25 bg-[#e0c985]/[0.05] p-4">
            <h2 className="text-sm font-semibold text-[#f4df9b]">ตั้งเวลาส่ง (การกระทำที่มีผลกับผู้รับจริง)</h2>
            {!data.sendEnabled ? <p className="mt-2 text-sm text-white/65">ระบบยังปิดการส่งอีเมลอยู่ จึงยังตั้งเวลาไม่ได้</p> : null}
            <label className="mt-3 block text-sm text-white/70">เวลาส่ง (เวลาไทย, เว้นว่าง = ส่งทันทีที่ n8n รับงาน)
              <input type="datetime-local" className={field} value={scheduleAt} disabled={!data.sendEnabled} onChange={(event) => setScheduleAt(event.target.value)} />
            </label>
            <label className="mt-3 block text-sm text-white/70">พิมพ์ &quot;{CONFIRMATION}&quot; เพื่อยืนยัน
              <input className={field} value={confirmation} disabled={!data.sendEnabled} onChange={(event) => setConfirmation(event.target.value)} />
            </label>
            <button type="button" className={`${primary} mt-3`} disabled={busy || !data.sendEnabled || !storeReady || confirmation !== CONFIRMATION} onClick={() => run(() => mutate({
              action: "schedule",
              digestId: selected.id,
              expectedVersion: selected.version,
              idempotencyKey: key("schedule"),
              scheduledAt: scheduleAt ? new Date(`${scheduleAt}:00+07:00`).toISOString() : null,
              confirmation,
            }, "ตั้งเวลาส่งแล้ว").finally(() => setConfirmation(""))) }>ตั้งเวลาส่ง</button>
          </div>
        ) : null}

        {selected?.status === "scheduled" ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
            <p>ตั้งเวลาส่งไว้ {selected.scheduledAt ? dateTime.format(new Date(selected.scheduledAt)) : "—"} · งานส่ง: {job ? JOB_LABELS[job.status] : "—"}</p>
            {job?.status === "needs_attention" ? (
              <label className="mt-3 flex items-start gap-2"><input type="checkbox" checked={ackAmbiguous} onChange={(event) => setAckAmbiguous(event.target.checked)} /> ตรวจแล้วว่าอีเมลยังไม่ได้ถูกส่งจริง</label>
            ) : null}
            <button type="button" className={`${secondary} mt-3`} disabled={busy || !storeReady || job?.status === "claimed"} onClick={() => run(() => mutate({ action: "unschedule", digestId: selected.id, expectedVersion: selected.version, idempotencyKey: key("unschedule"), acknowledgeAmbiguous: ackAmbiguous }, "ยกเลิกการตั้งเวลาแล้ว ฉบับนี้กลับเป็นตรวจแล้ว"))}>ยกเลิกการตั้งเวลา</button>
          </div>
        ) : null}

        {message ? <p role="status" className={`mt-4 text-sm ${message.tone === "ok" ? "text-emerald-200/80" : "text-amber-100/80"}`}>{message.text}</p> : null}
      </section>

      <div className="grid gap-6">
        <section aria-label="ตัวอย่างอีเมล" className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">
          <h2 className="text-sm font-semibold text-white/85">ตัวอย่างอีเมล</h2>
          <p className="mt-1 text-xs leading-5 text-white/50">แสดงแบบที่ผู้รับจะเห็น ลิงก์ยกเลิกการรับอีเมลเป็นตัวแทน n8n จะใส่ลิงก์จริงของแต่ละคนตอนส่ง ไม่มีพิกเซลติดตาม</p>
          {previewHtml ? (
            <iframe title="ตัวอย่างอีเมลรายเดือน" sandbox="" srcDoc={previewHtml} className="mt-3 min-h-[70vh] w-full rounded-2xl border border-white/10 bg-white" />
          ) : (
            <p className="mt-3 rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-white/45">กด &quot;ดูตัวอย่างอีเมล&quot; เพื่อดูหน้าตาอีเมล</p>
          )}
        </section>

        <section aria-label="งานส่งของ n8n" className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">
          <h2 className="text-sm font-semibold text-white/85">งานส่งที่รอ n8n</h2>
          {data.jobs.length === 0 ? <p className="mt-3 text-sm text-white/50">ยังไม่มีงานส่ง</p> : (
            <ul className="mt-3 grid gap-2">
              {data.jobs.map((item) => (
                <li key={item.id} className="rounded-2xl border border-white/10 bg-black/10 p-3 text-sm text-white/75">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>{JOB_LABELS[item.status]} · {dateTime.format(new Date(item.scheduledAt))}</span>
                    <span className="text-xs text-white/45">ครั้งที่ {item.attempts}/{item.maxAttempts}{item.lastErrorCode ? ` · ${item.lastErrorCode}` : ""}</span>
                  </div>
                  {["queued", "failed", "needs_attention"].includes(item.status) ? (
                    <button type="button" className={`${secondary} mt-2`} disabled={busy || !data.sendEnabled || !storeReady} onClick={() => run(async () => {
                      const typed = window.prompt(`${item.status === "queued" ? "แจ้ง n8n อีกครั้ง" : "ส่งงานนี้เข้าคิวใหม่"} พิมพ์ "${CONFIRMATION}" เพื่อยืนยัน`);
                      if (typed !== CONFIRMATION) return "ยังไม่ได้ทำรายการ";
                      const ambiguous = item.status === "needs_attention";
                      if (ambiguous && !window.confirm("สถานะเดิมยังไม่ชัด อาจถูกส่งไปแล้ว ตรวจแล้วว่ายังไม่ได้ส่งใช่ไหม?")) return "ยังไม่ได้ทำรายการ";
                      await call("/api/admin/social/worker-jobs/retry/", { method: "POST", body: { jobId: item.id, expectedVersion: item.version, idempotencyKey: key("retry"), confirmation: typed, acknowledgeAmbiguous: ambiguous } });
                      await refresh(selectedId ?? undefined);
                      return item.status === "queued" ? "แจ้ง n8n อีกครั้งแล้ว" : "ส่งเข้าคิวใหม่แล้ว";
                    })}>{item.status === "queued" ? "แจ้ง n8n อีกครั้ง" : "ลองใหม่"}</button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
