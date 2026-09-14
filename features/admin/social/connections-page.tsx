import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { getSocialOperationsRuntimeStatus } from "@/lib/admin/social/operations";

export const metadata: Metadata = { title: "Social Connections" };

const connections = [
  {
    href: "/social/accounts/meta/",
    title: "Meta",
    platforms: "Facebook · Instagram",
    description: "ตรวจ Page, Instagram account และสิทธิ์แบบอ่านอย่างเดียว พร้อมเริ่ม Manual Sync เมื่อเปิดใช้งาน",
  },
  {
    href: "/social/accounts/youtube/",
    title: "YouTube",
    platforms: "YouTube · Shorts · Live",
    description: "ตรวจ Channel และข้อมูลย้อนหลังที่ได้รับอนุญาต โดยไม่อัปโหลดหรือเผยแพร่วิดีโอ",
  },
  {
    href: "/social/accounts/tiktok/",
    title: "TikTok",
    platforms: "TikTok",
    description: "ตรวจ Profile และรายการวิดีโอแบบอ่านอย่างเดียว ไม่มีการสร้าง Draft หรือส่งวิดีโอ",
  },
] as const;

export default async function SocialConnectionsPage() {
  await requireAdminPermission("social:read");
  const runtime = getSocialOperationsRuntimeStatus();
  if (!runtime.enabled) notFound();
  const visibleConnections = runtime.environment === "admin-uat" ? connections : connections.slice(0, 1);

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">WEBSITE 4.2 · CONNECTIONS</p>
      <h1 className="mt-2 text-3xl font-semibold">Social Connections</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">เลือกแพลตฟอร์มเพื่อตรวจสถานะบัญชีและสั่ง Manual Sync ตามสิทธิ์ที่กำหนด</p>

      <section aria-label="รายการ Social Connections" className="mt-7 grid gap-4 lg:grid-cols-3">
        {visibleConnections.map((connection) => (
          <article key={connection.href} className="flex min-h-full flex-col rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <div className="text-xs font-semibold tracking-wide text-[#e0c985]">{connection.platforms}</div>
            <h2 className="mt-2 text-xl font-semibold">{connection.title}</h2>
            <p className="mt-3 flex-1 text-sm leading-6 text-white/70">{connection.description}</p>
            <Link href={connection.href} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/85 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985]">เปิด Connection</Link>
          </article>
        ))}
      </section>

      {runtime.environment === "production-admin" ? <section role="status" className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-white/65">
        YouTube และ TikTok ยังไม่ได้เชื่อมบัญชี จึงซ่อนไว้จาก Production จนกว่าจะผ่าน Full Sync และ UAT
      </section> : null}

      <section role="note" className="mt-6 rounded-2xl border border-amber-200/20 bg-amber-200/[0.05] px-4 py-3 text-sm leading-6 text-amber-50/85">
        การ Login หรืออนุมัติ OAuth ต้องทำโดยเจ้าของบัญชีเอง ระบบจะหยุดรอที่ขั้นตอนยืนยันตัวตน
      </section>
    </div>
  );
}
