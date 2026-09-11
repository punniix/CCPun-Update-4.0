"use client";

import { useEffect, useRef, useState } from "react";
import { useSyncState, useValidationStatus, type DocumentActionComponent } from "sanity";
import { articlePublishBlock, type PublishableArticle } from "./article-publication";
import type { AdminEnvironment } from "../../../lib/admin/environment";
import type { ScheduleView } from "../../../lib/admin/operations/article-schedule-contract";

const labels: Record<ScheduleView["status"], string> = {
  preparing: "ยังไม่ยืนยันการส่งคิว", scheduled: "ตั้งเวลาแล้ว", executing: "กำลังตรวจและดำเนินการ",
  published: "เผยแพร่สำเร็จ", validated: "ทดสอบสำเร็จ · ไม่ได้เผยแพร่", cancelled: "ยกเลิกแล้ว",
  stale: "ฉบับบทความเปลี่ยน · ต้องอนุมัติและตั้งใหม่", failed: "ดำเนินการไม่สำเร็จ", "reconciliation-required": "ต้องตรวจผลจริงก่อนดำเนินการต่อ",
};
const errors: Record<string, string> = {
  "conflict": "บทความหรือคิวเปลี่ยนไปแล้ว กรุณาโหลดสถานะล่าสุดและตรวจอีกครั้ง",
  "article-not-ready": "ตรวจข้อมูลที่จำเป็น สถานะอนุมัติ และเวลาเผยแพร่ให้เรียบร้อยก่อน",
  "invalid-request": "ข้อมูลยืนยันไม่ครบหรือวันเวลาไม่ถูกต้อง กรุณาปิดแล้วเปิดหน้าตั้งเวลาใหม่",
  "dispatch-failed": "ยังยืนยันการส่งคิวไม่ได้ กรุณาโหลดสถานะล่าสุด อย่าถือว่าตั้งเวลาสำเร็จ",
};
function localBangkok(value: string | number) {
  const parts = new Map(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}T${parts.get("hour")}:${parts.get("minute")}`;
}
function displayTime(value: string) {
  return new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function createArticleScheduleAction(environment: AdminEnvironment): DocumentActionComponent {
  const ArticleScheduleAction: DocumentActionComponent = (props) => {
    const draft = props.draft as PublishableArticle | null;
    const published = props.published as PublishableArticle | null;
    const sync = useSyncState(props.id, props.type);
    const validation = useValidationStatus(props.draft?._id || props.id, props.type, true);
    const endpoint = `/api/snt-admin/content/${encodeURIComponent(props.id.replace(/^drafts\./, ""))}/schedule/`;
    const [open, setOpen] = useState(false);
    const [scheduledLocal, setScheduledLocal] = useState(() => localBangkok(Date.now() + 10 * 60_000));
    const [state, setState] = useState<{ ready: boolean; mode: "publish" | "validate-only"; schedule: ScheduleView | null } | null>(null);
    const [confirmation, setConfirmation] = useState<{ articleId: string; draft: string | null; published: string | null } | null>(null);
    const [confirmed, setConfirmed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refresh, setRefresh] = useState(0);
    const inFlight = useRef(false);

    useEffect(() => {
      const abort = new AbortController();
      setLoading(true);
      fetch(endpoint, { credentials: "same-origin", cache: "no-store", signal: abort.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("not-ready");
          const result = await response.json();
          if (typeof result.ready !== "boolean" || !["publish", "validate-only"].includes(result.mode)) throw new Error("not-ready");
          if (!abort.signal.aborted) setState(result);
        })
        .catch(() => {
          if (!abort.signal.aborted) { setState(null); setError("ระบบตั้งเวลายังไม่พร้อมหรืออ่านสถานะไม่ได้ ไม่ได้ยืนยันการสร้างคิวใหม่"); }
        })
        .finally(() => { if (!abort.signal.aborted) setLoading(false); });
      return () => abort.abort();
    }, [endpoint, open, refresh]);

    const schedule = state?.schedule;
    const isTest = environment !== "production-admin";
    const unchanged = confirmation?.articleId === props.id && confirmation?.draft === (draft?._rev ?? null) && confirmation?.published === (published?._rev ?? null);
    const blocked = articlePublishBlock(draft, published);
    const validating = sync.isSyncing || validation.isValidating || validation.validation.some((item) => item.level === "error");
    const locked = schedule?.status === "executing" || schedule?.status === "reconciliation-required" || schedule?.status === "preparing";
    const canSchedule = Boolean(state?.ready && !loading && !busy && !validating && !blocked && unchanged && confirmed && !locked && draft && confirmation && scheduledLocal && !props.version && !props.liveEdit);
    const canCancel = Boolean(schedule && ["preparing", "scheduled"].includes(schedule.status) && !loading && !busy);

    async function mutate(cancel: boolean) {
      if (inFlight.current || (cancel ? !canCancel : !canSchedule)) return;
      inFlight.current = true;
      setBusy(true);
      setError(null);
      try {
        const body = cancel ? { expectedGeneration: schedule!.generation, expectedVersion: schedule!.rowVersion }
          : { scheduledLocal, draftRevision: confirmation!.draft, publishedRevision: confirmation!.published,
            expectedGeneration: schedule?.generation ?? null, expectedVersion: schedule?.rowVersion ?? 0, requestId: crypto.randomUUID() };
        const response = await fetch(endpoint, { method: cancel ? "DELETE" : "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        const result = await response.json();
        if (!response.ok) throw new Error(result?.error || "not-ready");
        setState((previous) => previous ? { ...previous, schedule: result.schedule } : null);
        setConfirmed(false);
        setRefresh((value) => value + 1);
      } catch (caught) {
        const code = caught instanceof Error ? caught.message : "not-ready";
        setError(errors[code] || "ยังยืนยันผลไม่ได้ กรุณาโหลดสถานะล่าสุดก่อนทำรายการอีกครั้ง");
        setConfirmed(false);
        setRefresh((value) => value + 1);
      } finally { inFlight.current = false; setBusy(false); }
    }

    if (props.version || props.liveEdit) return null;
    return {
      label: schedule ? `${isTest ? "ทดสอบ · " : ""}${labels[schedule.status]}` : isTest ? "ทดสอบตั้งเวลา (ไม่เผยแพร่)" : "ตั้งเวลาเผยแพร่",
      title: "จัดการกำหนดเผยแพร่ด้วยเวลาประเทศไทย",
      // Do not disable management when the Draft becomes unapproved or disappears.
      disabled: busy,
      onHandle: () => {
        setConfirmation({ articleId: props.id, draft: draft?._rev ?? null, published: published?._rev ?? null });
        setConfirmed(false); setError(null);
        setScheduledLocal(schedule ? localBangkok(schedule.scheduledAt) : localBangkok(Date.now() + 10 * 60_000));
        setOpen(true);
      },
      dialog: open ? {
        type: "dialog", header: isTest ? "ทดสอบคิวใน UAT · ไม่เผยแพร่บทความ" : "ตั้งเวลาเผยแพร่บทความ",
        onClose: () => { if (!busy) setOpen(false); },
        content: (
          <div style={{ padding: "1rem", display: "grid", gap: "1rem", maxWidth: 540 }}>
            <p>ระบบยึดฉบับที่คุณยืนยัน หากแก้บทความหรือมีการเผยแพร่ฉบับอื่นหลังตั้งเวลา คิวนี้จะหยุดให้ตรวจใหม่</p>
            {loading ? <p role="status">กำลังอ่านสถานะจริง…</p> : null}
            {state && !state.ready ? <p role="status">ยังไม่ได้เปิดใช้งานการตั้งเวลาใหม่ แต่ยังยกเลิกคิวที่รออยู่ได้</p> : null}
            {schedule ? <p role="status">{labels[schedule.status]} · {displayTime(schedule.scheduledAt)} (เวลาไทย)</p> : null}
            {schedule?.status === "executing" || schedule?.status === "reconciliation-required" ? <p>ยังไม่สามารถตั้งซ้ำหรือยืนยันยกเลิกได้ ต้องตรวจสถานะ Live และผลธุรกรรมก่อน</p> : null}
            <label style={{ display: "grid", gap: ".5rem" }}>
              วันและเวลา (Asia/Bangkok) · ล่วงหน้า 30 วินาทีถึง 90 วัน
              <input type="datetime-local" value={scheduledLocal} onChange={(event) => { setScheduledLocal(event.currentTarget.value); setConfirmed(false); }} disabled={busy} style={{ font: "inherit", padding: ".7rem" }} />
            </label>
            {blocked || validating || !unchanged ? <p>{!unchanged ? "ฉบับบทความเปลี่ยน กรุณาปิดแล้วเปิดหน้าตั้งเวลาใหม่" : blocked || "รอการบันทึกและตรวจฟอร์มให้เสร็จก่อนตั้งเวลา"}</p> : null}
            <label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.currentTarget.checked)} disabled={busy} /> {isTest ? "ยืนยันทดสอบฉบับนี้ โดยไม่มีการเผยแพร่" : "ฉันตรวจตัวอย่างและอนุมัติให้เผยแพร่ฉบับนี้ตามเวลาที่เลือกแล้ว"}</label>
            {error ? <p role="alert">{error}</p> : null}
            <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
              <button type="button" onClick={() => void mutate(false)} disabled={!canSchedule} style={{ minHeight: 44 }}>{busy ? "กำลังดำเนินการ…" : isTest ? "ยืนยันตั้งเวลาทดสอบ" : "ยืนยันตั้งเวลา"}</button>
              {schedule && ["preparing", "scheduled"].includes(schedule.status) ? <button type="button" onClick={() => void mutate(true)} disabled={!canCancel} style={{ minHeight: 44 }}>ยกเลิกคิวนี้</button> : null}
              <button type="button" disabled={busy || loading} onClick={() => { setError(null); setRefresh((value) => value + 1); }} style={{ minHeight: 44 }}>โหลดสถานะล่าสุด</button>
            </div>
          </div>
        ),
      } : null,
    };
  };
  ArticleScheduleAction.displayName = "CCPunArticleScheduleAction";
  return ArticleScheduleAction;
}

export function appendArticleScheduleAction(actions: DocumentActionComponent[], environment: AdminEnvironment, schemaType?: string) {
  if (!["production-admin", "admin-uat", "local-uat"].includes(environment) || schemaType !== "article") return actions;
  return [...actions, createArticleScheduleAction(environment)];
}
