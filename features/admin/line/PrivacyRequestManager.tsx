"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const COUNT_LABELS: Record<string, string> = {
  conversations: "บทสนทนา",
  messages: "ข้อความ",
  documents: "เอกสาร",
  leads: "เคส",
  advisorCases: "รายการดูแล",
  businessEvents: "กิจกรรมธุรกิจ",
  implementations: "รายการดำเนินการ",
  revenueRecords: "รายการรายได้",
};

export function PrivacyRequestManager() {
  const router = useRouter();
  const [requestType, setRequestType] = useState<"export" | "delete">("export");
  const [scopeType, setScopeType] = useState<"lead" | "customer">("lead");
  const [scopeId, setScopeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function createRequest() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/line/privacy/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType,
          ...(scopeType === "lead" ? { leadId: scopeId.trim() } : { customerId: scopeId.trim() }),
        }),
      });
      if (!response.ok) throw new Error("request_failed");
      setScopeId("");
      setMessage(
        requestType === "export"
          ? "สร้างคำขอสำเนาข้อมูลแล้ว"
          : "สร้างคำขอเตรียมลบข้อมูลแล้ว · ยังไม่มีข้อมูลถูกลบ",
      );
      router.refresh();
    } catch {
      setMessage("ยังสร้างคำขอไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
      <h2 className="text-lg font-semibold">สร้างคำขอเกี่ยวกับข้อมูลลูกค้า</h2>
      <p className="mt-1 text-xs leading-5 text-white/50">
        ใช้เมื่อต้องการเตรียมสำเนาข้อมูล หรือตรวจว่าถ้าจะลบลูกค้ารายนี้จะกระทบข้อมูลอะไรบ้าง
        การลบจริงต้องยืนยันแยกอีกครั้ง
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-[220px_220px_minmax(260px,1fr)_auto]">
        <label className="text-xs text-white/55">
          ต้องการทำอะไร
          <select
            value={requestType}
            onChange={(event) => setRequestType(event.target.value as "export" | "delete")}
            className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white"
          >
            <option value="export">เตรียมสำเนาข้อมูล</option>
            <option value="delete">เตรียมคำขอลบข้อมูล</option>
          </select>
        </label>

        <label className="text-xs text-white/55">
          ใช้รหัสแบบไหน
          <select
            value={scopeType}
            onChange={(event) => setScopeType(event.target.value as "lead" | "customer")}
            className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white"
          >
            <option value="lead">รหัสเคส</option>
            <option value="customer">รหัสลูกค้าภายใน</option>
          </select>
        </label>

        <label className="text-xs text-white/55">
          {scopeType === "lead" ? "รหัสเคส" : "รหัสลูกค้าภายใน"}
          <input
            value={scopeId}
            onChange={(event) => setScopeId(event.target.value)}
            placeholder="วางรหัสจากรายละเอียดระบบ"
            className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/30"
          />
        </label>

        <button
          type="button"
          onClick={() => void createRequest()}
          disabled={busy || !scopeId.trim()}
          className="min-h-11 self-end rounded-xl bg-white px-4 text-sm font-medium text-black disabled:opacity-40"
        >
          {busy ? "กำลังสร้าง…" : "สร้างคำขอ"}
        </button>
      </div>

      {message ? <p role="status" className="mt-3 text-sm text-white/60">{message}</p> : null}
    </section>
  );
}

export function RetentionPolicyEditor({
  conversationReviewAfterDays,
  documentReviewAfterDays,
  auditReviewAfterDays,
}: {
  conversationReviewAfterDays: number | null;
  documentReviewAfterDays: number | null;
  auditReviewAfterDays: number | null;
}) {
  const router = useRouter();
  const [conversation, setConversation] = useState(conversationReviewAfterDays?.toString() ?? "");
  const [documentDays, setDocumentDays] = useState(documentReviewAfterDays?.toString() ?? "");
  const [audit, setAudit] = useState(auditReviewAfterDays?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function value(input: string) {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 36500 ? parsed : Number.NaN;
  }

  async function save() {
    const values = [value(conversation), value(documentDays), value(audit)];
    if (values.some((item) => Number.isNaN(item))) {
      setMessage("กรอกจำนวนวันเป็นเลขเต็ม หรือเว้นว่างไว้");
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/line/privacy/retention/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationReviewAfterDays: values[0],
          documentReviewAfterDays: values[1],
          auditReviewAfterDays: values[2],
        }),
      });
      if (!response.ok) throw new Error("save_failed");
      setMessage("บันทึกแล้ว · ระบบยังไม่ลบข้อมูลอัตโนมัติ");
      router.refresh();
    } catch {
      setMessage("ยังบันทึกไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">เตือนให้กลับมาตรวจข้อมูล</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-white/50">
            กำหนดจำนวนวันที่อยากให้กลับมาตรวจแต่ละประเภทอีกครั้ง ค่านี้เป็นแค่การเตือน
            ไม่ใช่คำสั่งลบข้อมูล และไม่ใช่ระยะเวลาทางกฎหมาย
          </p>
        </div>
        <span className="rounded-full border border-emerald-200/15 bg-emerald-200/[0.06] px-3 py-1.5 text-xs text-emerald-50/80">
          ไม่มีการลบอัตโนมัติ
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="text-xs text-white/55">
          ประวัติการคุย · กลับมาตรวจหลัง
          <input
            inputMode="numeric"
            value={conversation}
            onChange={(event) => setConversation(event.target.value)}
            placeholder="ไม่กำหนด"
            className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/30"
          />
        </label>
        <label className="text-xs text-white/55">
          เอกสาร · กลับมาตรวจหลัง
          <input
            inputMode="numeric"
            value={documentDays}
            onChange={(event) => setDocumentDays(event.target.value)}
            placeholder="ไม่กำหนด"
            className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/30"
          />
        </label>
        <label className="text-xs text-white/55">
          ประวัติการทำงาน · กลับมาตรวจหลัง
          <input
            inputMode="numeric"
            value={audit}
            onChange={(event) => setAudit(event.target.value)}
            placeholder="ไม่กำหนด"
            className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/30"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="min-h-10 rounded-xl bg-white px-4 text-sm font-medium text-black disabled:opacity-40"
        >
          {busy ? "กำลังบันทึก…" : "บันทึกการเตือน"}
        </button>
        <p className="text-xs text-white/45">
          ถ้าลูกค้ายกเลิกไฟล์: ระบบถอนการเข้าถึงก่อน แล้วจึงลบไฟล์
        </p>
      </div>

      {message ? <p role="status" className="mt-3 text-sm text-white/60">{message}</p> : null}
    </section>
  );
}

export function PrivacyRequestActions({
  requestId,
  status,
}: {
  requestId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);

  async function transition(next: string) {
    setBusy(true);
    setPlan(null);
    try {
      const response = await fetch(
        "/api/admin/line/privacy/" + requestId + "/transition/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        },
      );
      if (!response.ok) throw new Error("transition_failed");
      router.refresh();
    } catch {
      setPlan("ยังอัปเดตคำขอไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  async function prepare() {
    setBusy(true);
    setPlan(null);
    try {
      const response = await fetch(
        "/api/admin/line/privacy/" + requestId + "/prepare/",
        { method: "POST" },
      );
      const payload = await response.json() as {
        counts?: Record<string, number>;
        preparationKind?: "export_manifest" | "delete_tombstone";
        attachmentCleanupRequired?: number;
      };
      if (!response.ok || !payload.counts) throw new Error("prepare_failed");

      const countText = Object.entries(payload.counts)
        .filter(([, count]) => count > 0)
        .map(([key, count]) => (COUNT_LABELS[key] ?? "ข้อมูล") + " " + count.toLocaleString("th-TH"))
        .join(" · ");

      const safetyText = payload.preparationKind === "export_manifest"
        ? "เตรียมรายการสำหรับสำเนาข้อมูลแล้ว"
        : "เตรียมรายการที่จะต้องจัดการแล้ว · ยังไม่มีข้อมูลถูกลบ";

      setPlan((countText ? countText + " · " : "") + safetyText);
    } catch {
      setPlan("ตอนนี้ยังตรวจรายการที่จะได้รับผลกระทบไม่ได้");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {status === "requested" ? (
        <button
          disabled={busy}
          onClick={() => void transition("verified")}
          className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/70 disabled:opacity-40"
        >
          ตรวจข้อมูลแล้ว
        </button>
      ) : null}

      {status === "verified" || status === "prepared" || status === "approved" ? (
        <button
          disabled={busy}
          onClick={() => void prepare()}
          className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/70 disabled:opacity-40"
        >
          ดูว่าจะกระทบข้อมูลอะไรบ้าง
        </button>
      ) : null}

      {status === "prepared" ? (
        <button
          disabled={busy}
          onClick={() => void transition("approved")}
          className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/70 disabled:opacity-40"
        >
          อนุมัติการเตรียมการ
        </button>
      ) : null}

      {!["executed", "cancelled", "failed"].includes(status) ? (
        <button
          disabled={busy}
          onClick={() => void transition("cancelled")}
          className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/45 disabled:opacity-40"
        >
          ยกเลิกคำขอ
        </button>
      ) : null}

      {plan ? <p className="basis-full text-xs leading-5 text-white/50">{plan}</p> : null}
    </div>
  );
}
