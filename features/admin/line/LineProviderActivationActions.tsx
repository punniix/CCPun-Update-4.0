"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RichMenuState =
  | "not_configured"
  | "not_assigned"
  | "active_v3"
  | "active_other"
  | "provider_unavailable";

export function LineProviderActivationActions({
  richMenuState,
  richMenuReady,
  systemDeliveryReady,
  driveInteractiveReady,
  pendingFileCount,
  controlState,
}: {
  richMenuState: RichMenuState;
  richMenuReady: boolean;
  systemDeliveryReady: boolean;
  driveInteractiveReady: boolean;
  pendingFileCount: number;
  controlState: {
    desiredMode: "hold" | "reconcile" | "rollback";
    state: "hold" | "pending" | "leased" | "mutating" | "verified" | "reconciliation_required" | "failed" | "blocked";
    rowVersion: number;
    rollbackAvailable: boolean;
  } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function activateRichMenu() {
    const wording = richMenuState === "active_other"
      ? "Rich Menu หลักปัจจุบันจะถูกเปลี่ยนเป็นเมนู CCPun Main v3 สำหรับผู้ใช้ทั้งหมด ยืนยันหรือไม่?"
      : "ยืนยันให้เมนู CCPun Main v3 เป็น Rich Menu หลักของ @ccpun สำหรับผู้ใช้ทั้งหมดหรือไม่?";
    if (!window.confirm(wording)) return;

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/line/rich-menu/activate/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmation: "activate-ccpun-rich-menu-v3",
          expectedVersion: controlState?.rowVersion,
          idempotencyKey: `admin:${crypto.randomUUID()}`,
        }),
      });
      const payload = await response.json().catch(() => ({})) as {
        status?: string;
        error?: string;
      };
      if (!response.ok) {
        if (payload.error === "rich-menu-status-unavailable") {
          throw new Error("ตอนนี้ยังตรวจสถานะ Rich Menu จาก LINE ไม่ได้ ลองใหม่อีกครั้ง");
        }
        if (payload.error === "rich-menu-not-ready") {
          throw new Error("LINE credential หรือสิทธิ์เปิด Rich Menu ยังไม่พร้อม");
        }
        if (payload.error === "rich-menu-status-unclear") {
          throw new Error("LINE ตอบกลับไม่ชัดเจน ระบบหยุดไว้ก่อนเพื่อไม่ให้สร้างซ้ำ");
        }
        throw new Error("ยังเปิด Rich Menu ไม่สำเร็จ ลองใหม่อีกครั้ง");
      }
      setMessage("รับคำสั่งแล้ว ระบบจะอ่านกลับจาก LINE และยืนยันสถานะก่อนถือว่าสำเร็จ");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ยังเปิด Rich Menu ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function submitControlCommand(command: "hold" | "rollback") {
    if (!controlState) return;
    const wording = command === "hold"
      ? "หยุดการ reconcile Rich Menu โดยไม่เปลี่ยนหรือย้อนสถานะที่ LINE ใช้อยู่ ยืนยันหรือไม่?"
      : "คืน Rich Menu ไปยัง provider state ก่อนหน้าที่ระบบอ่านกลับและอนุมัติไว้ ยืนยันหรือไม่?";
    if (!window.confirm(wording)) return;
    setBusy(true);
    setMessage(null);
    try {
      const confirmation = command === "hold"
        ? "hold-line-rich-menu-reconciliation"
        : "restore-approved-previous-rich-menu";
      const response = await fetch("/api/admin/control/commands/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource: "line.rich_menu.default",
          command,
          expectedVersion: controlState.rowVersion,
          idempotencyKey: `admin:${crypto.randomUUID()}`,
          confirmation,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        if (payload.error === "provider-operation-in-progress") {
          throw new Error("provider operation กำลังอยู่ในช่วง mutation กรุณารอ readback แล้วลองอีกครั้ง");
        }
        if (payload.error === "stale-version") {
          throw new Error("สถานะเปลี่ยนจากหน้าเดิมแล้ว กรุณาโหลดหน้าใหม่");
        }
        throw new Error("ยังส่งคำสั่งไม่ได้");
      }
      setMessage(command === "hold"
        ? "หยุด reconcile แล้ว โดยไม่ได้ rollback provider"
        : "รับคำสั่ง rollback แล้ว ระบบจะตรวจ readback ก่อนยืนยันผล");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ยังส่งคำสั่งไม่ได้");
    } finally {
      setBusy(false);
    }
  }

  const richMenuActive = richMenuState === "active_v3";
  const richMenuButtonDisabled =
    busy || richMenuActive || !richMenuReady || !controlState || richMenuState === "provider_unavailable";

  return (
    <section className="rounded-3xl border border-[#e0c985]/20 bg-[#e0c985]/[0.05] p-5 md:p-6">
      <h2 className="text-lg font-semibold text-white/90">เปิดใช้งาน LINE ให้ครบ</h2>
      <p className="mt-1 text-sm leading-6 text-white/60">
        ขั้นตอนที่ต้องให้เจ้าของระบบยืนยันเองจะอยู่ตรงนี้ ไม่ต้องไปหา credential หรือเมนูหลายหน้า
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-black/15 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-medium text-white/85">Rich Menu หลัก</h3>
              <p className="mt-1 text-xs leading-5 text-white/50">
                ประกันชีวิต · ประกันรถ · เรื่องลงทุน · คุยกับปั้น
              </p>
              <p className="mt-1 text-xs leading-5 text-white/45">
                การ์ดบทความอัตโนมัติ: {systemDeliveryReady ? "พร้อม" : "ยังไม่เปิด"}
              </p>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-xs ${
              richMenuActive
                ? "border-emerald-200/15 bg-emerald-200/[0.06] text-emerald-100"
                : "border-amber-200/15 bg-amber-200/[0.06] text-amber-100"
            }`}>
              {richMenuActive
                ? "เปิดใช้งานแล้ว"
                : richMenuState === "active_other"
                  ? "มีเมนูอื่นใช้อยู่"
                  : richMenuState === "provider_unavailable"
                    ? "ตรวจ LINE ไม่ได้"
                    : "พร้อมเปิด"}
            </span>
          </div>

          <button
            type="button"
            disabled={richMenuButtonDisabled}
            onClick={() => void activateRichMenu()}
            className="mt-4 min-h-11 rounded-xl bg-[#e0c985] px-4 text-sm font-semibold text-[#251818] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy
              ? "กำลังเปิด…"
              : richMenuActive
                ? "Rich Menu เปิดอยู่แล้ว"
                : richMenuState === "active_other"
                  ? "เปลี่ยนเป็นเมนู CCPun หลัก"
                  : "เปิด Rich Menu หลัก"}
          </button>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !controlState || controlState.desiredMode === "hold"}
              onClick={() => void submitControlCommand("hold")}
              className="min-h-11 rounded-xl border border-white/10 px-4 text-sm text-white/70 disabled:cursor-not-allowed disabled:opacity-40"
            >
              หยุด reconcile
            </button>
            <button
              type="button"
              disabled={busy || !controlState?.rollbackAvailable}
              onClick={() => void submitControlCommand("rollback")}
              className="min-h-11 rounded-xl border border-amber-200/20 px-4 text-sm text-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Rollback ที่อนุมัติไว้
            </button>
          </div>
          <p className="mt-3 text-xs leading-5 text-white/45">
            Control Plane: {controlState
              ? `${controlState.desiredMode} · ${controlState.state} · v${controlState.rowVersion}`
              : "ยังไม่พร้อม"}
          </p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-black/15 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-medium text-white/85">Google Drive สำหรับไฟล์ลูกค้า</h3>
              <p className="mt-1 text-xs leading-5 text-white/50">
                ใช้สิทธิ์ drive.file แบบชั่วคราว และไม่เก็บ refresh token
              </p>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-xs ${
              driveInteractiveReady
                ? "border-emerald-200/15 bg-emerald-200/[0.06] text-emerald-100"
                : "border-amber-200/15 bg-amber-200/[0.06] text-amber-100"
            }`}>
              {driveInteractiveReady ? "ตั้งค่าพร้อม" : "ยังต้องตั้งค่า"}
            </span>
          </div>
          <p className="mt-4 text-sm leading-6 text-white/65">
            {driveInteractiveReady
              ? pendingFileCount > 0
                ? `มีไฟล์รอ ${pendingFileCount.toLocaleString("th-TH")} รายการ · ค่อยอนุญาต Drive ตอนประมวลผลไฟล์`
                : "ตอนนี้ไม่มีไฟล์รอ จึงยังไม่ต้องกดอนุญาต Google Drive"
              : "OAuth/Picker หรือโฟลเดอร์ที่อนุญาตยังตั้งค่าไม่ครบ"}
          </p>
        </article>
      </div>

      {!systemDeliveryReady ? (
        <p className="mt-4 text-sm leading-6 text-amber-100/80">
          Rich Menu v3 จะเปิดได้เมื่อระบบส่ง Article Cards ฝั่ง private provider พร้อม เพื่อไม่ให้ผู้ใช้กดแล้วเจอทางตัน
        </p>
      ) : null}
      {message ? <p role="status" className="mt-4 text-sm text-white/70">{message}</p> : null}
    </section>
  );
}
