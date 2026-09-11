"use client";

import { useEffect, useMemo, useState } from "react";
import type { DocumentActionComponent } from "sanity";
import type { PublishableArticle } from "./article-publication";
import type { AdminEnvironment } from "../../../lib/admin/environment";

type ScheduleState = {
  status?: "scheduled" | "published" | "stale" | "cancelled" | "failed";
  scheduledAt?: string;
  timezone?: string;
  errorCode?: string;
};

function defaultBangkokLocal() {
  const now = new Date(Date.now() + 10 * 60_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}T${byType.get("hour")}:${byType.get("minute")}`;
}

function formatBangkok(value?: string) {
  if (!value) return null;
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function createArticleScheduleAction(): DocumentActionComponent {
  const ArticleScheduleAction: DocumentActionComponent = (props) => {
    const logicalId = props.id.replace(/^drafts\./, "");
    const draft = props.draft as PublishableArticle | null;
    const [open, setOpen] = useState(false);
    const [scheduledLocal, setScheduledLocal] = useState(defaultBangkokLocal);
    const [schedule, setSchedule] = useState<ScheduleState | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const endpoint = useMemo(
      () => `/api/snt-admin/content/${encodeURIComponent(logicalId)}/schedule`,
      [logicalId],
    );

    useEffect(() => {
      let cancelled = false;
      fetch(endpoint, { credentials: "same-origin", cache: "no-store" })
        .then(async (response) => response.ok ? response.json() : null)
        .then((payload) => {
          if (cancelled) return;
          const next = (payload?.schedule ?? null) as ScheduleState | null;
          setSchedule(next);
          if (next?.scheduledAt) {
            const parts = new Intl.DateTimeFormat("en-CA", {
              timeZone: "Asia/Bangkok",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hourCycle: "h23",
            }).formatToParts(new Date(next.scheduledAt));
            const byType = new Map(parts.map((part) => [part.type, part.value]));
            setScheduledLocal(`${byType.get("year")}-${byType.get("month")}-${byType.get("day")}T${byType.get("hour")}:${byType.get("minute")}`);
          }
        })
        .catch(() => undefined);
      return () => { cancelled = true; };
    }, [endpoint]);

    async function saveSchedule() {
      setBusy(true);
      setError(null);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scheduledLocal }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "ตั้งเวลาไม่สำเร็จ");
        setSchedule((payload.schedule ?? null) as ScheduleState | null);
        setOpen(false);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "ตั้งเวลาไม่สำเร็จ");
      } finally {
        setBusy(false);
      }
    }

    async function cancelSchedule() {
      setBusy(true);
      setError(null);
      try {
        const response = await fetch(endpoint, { method: "DELETE", credentials: "same-origin" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "ยกเลิกไม่สำเร็จ");
        setSchedule((payload.schedule ?? null) as ScheduleState | null);
        setOpen(false);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "ยกเลิกไม่สำเร็จ");
      } finally {
        setBusy(false);
      }
    }

    const scheduledLabel = schedule?.status === "scheduled" && schedule.scheduledAt
      ? `ตั้งเวลาแล้ว · ${formatBangkok(schedule.scheduledAt)}`
      : "ตั้งเวลาเผยแพร่";

    return {
      label: scheduledLabel,
      title: "ตั้งเวลาเผยแพร่บทความด้วยเวลาประเทศไทย (Asia/Bangkok)",
      disabled: busy || !draft || draft.review?.status !== "approved",
      onHandle: () => setOpen(true),
      dialog: open ? {
        type: "dialog",
        header: schedule?.status === "scheduled" ? "แก้เวลาหรือยกเลิกการเผยแพร่" : "ตั้งเวลาเผยแพร่",
        onClose: () => { if (!busy) setOpen(false); },
        content: (
          <div style={{ padding: "1rem", display: "grid", gap: "1rem", maxWidth: 520 }}>
            <p style={{ margin: 0 }}>
              ระบบจะล็อก revision ที่อนุมัติแล้ว หากมีการแก้บทความหลังตั้งเวลา ระบบจะหยุดเผยแพร่และให้อนุมัติใหม่แทนการเผยแพร่ฉบับที่เปลี่ยนไปโดยอัตโนมัติ
            </p>
            <label style={{ display: "grid", gap: ".4rem", fontWeight: 600 }}>
              วันและเวลา (Asia/Bangkok)
              <input
                type="datetime-local"
                value={scheduledLocal}
                onChange={(event) => setScheduledLocal(event.currentTarget.value)}
                disabled={busy}
                style={{ font: "inherit", padding: ".65rem", borderRadius: 6, border: "1px solid #999" }}
              />
            </label>
            {schedule?.status === "scheduled" ? (
              <p style={{ margin: 0 }}>ปัจจุบัน: {formatBangkok(schedule.scheduledAt)} น. · ตั้งเวลาแล้ว</p>
            ) : null}
            {schedule?.status && schedule.status !== "scheduled" ? (
              <p style={{ margin: 0 }}>สถานะล่าสุด: {schedule.status}{schedule.errorCode ? ` · ${schedule.errorCode}` : ""}</p>
            ) : null}
            {error ? <p role="alert" style={{ margin: 0, color: "#b42318" }}>{error}</p> : null}
            <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
              <button type="button" onClick={saveSchedule} disabled={busy || !scheduledLocal}>
                {busy ? "กำลังบันทึก…" : schedule?.status === "scheduled" ? "บันทึกเวลาใหม่" : "ยืนยันตั้งเวลา"}
              </button>
              {schedule?.status === "scheduled" ? (
                <button type="button" onClick={cancelSchedule} disabled={busy}>ยกเลิกกำหนดเผยแพร่</button>
              ) : null}
            </div>
          </div>
        ),
      } : null,
    };
  };
  ArticleScheduleAction.displayName = "CCPunArticleScheduleAction";
  return ArticleScheduleAction;
}

export function appendArticleScheduleAction(
  actions: DocumentActionComponent[],
  environment: AdminEnvironment,
  schemaType?: string,
) {
  if (environment !== "production-admin" || schemaType !== "article") return actions;
  return [...actions, createArticleScheduleAction()];
}
