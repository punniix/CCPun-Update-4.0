import type { Metadata } from "next";
import Link from "next/link";
import EmailDigestWorkspace, { type EmailDigestWorkspaceData } from "@/features/admin/social/EmailDigestWorkspace";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { bangkokMonthOf, EMAIL_DIGEST_RECIPIENTS_PLACEHOLDER, isEmailDigestSendEnabled } from "@/lib/admin/social/email-digest-model";
import { createNeonEmailDigestStore, getEmailDigestStoreReadiness } from "@/lib/admin/social/email-digest-neon-store";
import { getEmailDigestWorkspace } from "@/lib/admin/social/email-digest-service";

export const metadata: Metadata = { title: "อีเมลรายเดือน" };

const STORE_MESSAGES: Record<string, string> = {
  "not-configured": "ยังไม่ได้ตั้งค่าฐานข้อมูลงานโซเชียล จึงยังบันทึกฉบับร่างไม่ได้ แต่ยังดึงบทความและดูตัวอย่างอีเมลได้",
  "database-not-ready": "ฐานข้อมูลงานโซเชียลยังไม่พร้อม จึงยังบันทึกฉบับร่างไม่ได้",
  "migration-pending": "ยังไม่ได้ติดตั้งตารางของอีเมลรายเดือน (รอ migration) จึงยังบันทึกฉบับร่างไม่ได้ แต่ยังดึงบทความและดูตัวอย่างได้",
  unavailable: "ตอนนี้ยังอ่านฐานข้อมูลอีเมลรายเดือนไม่ได้",
};

export default async function EmailDigestPage() {
  await requireAdminPermission("social:read");
  const readiness = await getEmailDigestStoreReadiness();
  let data: EmailDigestWorkspaceData = { store: readiness.ready ? "ready" : readiness.reason, sendEnabled: isEmailDigestSendEnabled(), digests: [], jobs: [] };
  if (readiness.ready) {
    try {
      data = { ...data, ...(await getEmailDigestWorkspace({ store: await createNeonEmailDigestStore() })), store: "ready" };
    } catch {
      data = { ...data, store: "unavailable" };
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">โซเชียล · ช่องทางอีเมล</p>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">อีเมลสรุปบทความรายเดือน</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
            เตรียม ตรวจ และตั้งเวลาอีเมลสรุปบทความของแต่ละเดือนได้ที่นี่ เหมือนกับโพสต์ Facebook และ Instagram ส่วนการส่งจริงเป็นงานของ n8n
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/social/" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985]">ภาพรวมโซเชียล</Link>
          <Link href="/social/queue/" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985]">คิวส่งโพสต์</Link>
        </div>
      </div>

      <section aria-label="สถานะช่องทางอีเมล" className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-xs text-white/45">ผู้รับ</div>
          <p className="mt-2 text-sm text-white/80">{EMAIL_DIGEST_RECIPIENTS_PLACEHOLDER}</p>
          <p className="mt-2 text-xs leading-5 text-white/50">รายชื่อผู้รับดูแลโดยระบบอีเมลของเว็บไซต์ หน้านี้จะไม่เห็นอีเมลของใคร</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-xs text-white/45">การส่ง</div>
          <p className="mt-2 text-sm text-white/80">{data.sendEnabled ? "เปิดให้ตั้งเวลาส่งแล้ว" : "ปิดอยู่ (ค่าเริ่มต้น)"}</p>
          <p className="mt-2 text-xs leading-5 text-white/50">{data.sendEnabled ? "ทุกครั้งที่ตั้งเวลาต้องพิมพ์คำยืนยันก่อน" : "เตรียมและตรวจฉบับร่างได้ แต่ระบบยังไม่ให้ตั้งเวลาหรือส่ง"}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-xs text-white/45">เดือนปัจจุบัน (เวลาไทย)</div>
          <p className="mt-2 text-sm text-white/80">{bangkokMonthOf(new Date())}</p>
          <p className="mt-2 text-xs leading-5 text-white/50">ปุ่มดึงบทความจะเลือกเฉพาะบทความที่เผยแพร่ในเดือนที่เลือก</p>
        </div>
      </section>

      {data.store !== "ready" ? (
        <section role="status" className="mt-6 rounded-2xl border border-amber-200/20 bg-amber-200/[0.05] px-4 py-3 text-sm leading-6 text-amber-50/85">
          {STORE_MESSAGES[data.store] ?? STORE_MESSAGES.unavailable}
        </section>
      ) : null}

      <EmailDigestWorkspace initial={data} defaultMonth={bangkokMonthOf(new Date())} />
    </div>
  );
}
