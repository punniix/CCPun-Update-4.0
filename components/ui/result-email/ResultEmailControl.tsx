"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { trackEvent } from "@/lib/analytics";
import { normalizeResultEmail, type ResultEmailFigures, type ResultEmailTool } from "@/lib/email/result-summary";
import { useResultEmailEnabled } from "./ResultEmailAvailability";
import styles from "./ResultEmailControl.module.css";

type Status = "idle" | "sending" | "sent" | "sent-digest" | "invalid" | "rate-limited" | "failed";

const MESSAGES: Record<Exclude<Status, "idle">, string> = {
  sending: "กำลังส่ง",
  sent: "ส่งแล้ว ตรวจกล่องอีเมลของคุณได้เลย",
  "sent-digest": "ส่งแล้ว ถ้าต้องการรับสรุปรายเดือน กดยืนยันในอีเมลที่ได้รับ",
  invalid: "กรุณากรอกอีเมลให้ถูกต้อง",
  "rate-limited": "ส่งถี่เกินไป ลองใหม่ภายหลัง",
  failed: "ส่งไม่สำเร็จ ลองใหม่อีกครั้ง",
};

function cleanFigures(figures: ResultEmailFigures): ResultEmailFigures {
  return Object.fromEntries(Object.entries(figures).filter(([, value]) => typeof value === "number" && Number.isFinite(value) && value >= 0)) as ResultEmailFigures;
}

/**
 * "ส่งผลนี้ไปที่อีเมล" (Email phase 1, behind CCPUN_RESULT_EMAIL_ENABLED). A secondary control:
 * the result email is transactional; the monthly digest needs its own unticked checkbox and a
 * double opt-in. Figures go only to /api/result-email/ for the visitor's own email; analytics
 * receives one event with the tool id only.
 */
export default function ResultEmailControl({ tool, figures }: { tool: ResultEmailTool; figures: ResultEmailFigures }) {
  const enabled = useResultEmailEnabled();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) emailRef.current?.focus(); }, [open]);
  if (!enabled) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;
    const form = new FormData(event.currentTarget);
    const email = normalizeResultEmail(form.get("email"));
    if (!email) { setStatus("invalid"); emailRef.current?.focus(); return; }
    const digestConsent = form.get("digest") === "on";
    setStatus("sending");
    try {
      const response = await fetch("/api/result-email/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Only finite, non-negative numbers leave the browser; the server re-validates every figure.
        body: JSON.stringify({ email, tool, figures: cleanFigures(figures), digestConsent, website: String(form.get("website") ?? "") }),
        credentials: "same-origin",
        cache: "no-store",
      });
      if (response.ok) {
        trackEvent("result_email_requested", { result_tool: tool });
        setStatus(digestConsent ? "sent-digest" : "sent");
        return;
      }
      setStatus(response.status === 429 ? "rate-limited" : response.status === 400 ? "invalid" : "failed");
    } catch {
      setStatus("failed");
    }
  }

  if (!open) {
    return (
      <div className={styles.wrap}>
        <button type="button" className={styles.toggle} aria-expanded="false" onClick={() => setOpen(true)}>
          ส่งผลนี้ไปที่อีเมล
        </button>
      </div>
    );
  }

  const done = status === "sent" || status === "sent-digest";
  return (
    <div className={styles.wrap}>
      <form id={`${id}-form`} className={styles.form} onSubmit={submit} noValidate>
        <label className={styles.label} htmlFor={`${id}-email`}>อีเมลของคุณ</label>
        <div className={styles.row}>
          <input ref={emailRef} id={`${id}-email`} className={styles.input} name="email" type="email" inputMode="email" autoComplete="email"
            maxLength={254} required disabled={done} aria-invalid={status === "invalid"} aria-describedby={`${id}-status ${id}-notice`} />
          <button type="submit" className={styles.submit} disabled={status === "sending" || done}>ส่งผล</button>
        </div>
        <label className={styles.check}>
          <input type="checkbox" name="digest" disabled={done} />
          <span>รับสรุปบทความรายเดือนทางอีเมลด้วย ยกเลิกได้ทุกเมื่อ</span>
        </label>
        {/* Honeypot: hidden from people and assistive technology; a filled value is dropped silently. */}
        <div className={styles.trap} aria-hidden="true">
          <label>เว็บไซต์<input name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" /></label>
        </div>
        <p id={`${id}-notice`} className={styles.notice}>
          ผมใช้อีเมลนี้ส่งผลฉบับนี้ให้คุณเท่านั้น ถ้าเลือกรับสรุปรายเดือน จะมีอีเมลให้กดยืนยันก่อน อ่านเพิ่มที่ <a href="/privacy/">นโยบายความเป็นส่วนตัว</a>
        </p>
        <p id={`${id}-status`} className={styles.status} role="status" data-state={status}>{status === "idle" ? "" : MESSAGES[status]}</p>
      </form>
    </div>
  );
}
