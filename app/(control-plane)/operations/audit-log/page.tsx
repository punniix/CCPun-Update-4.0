import type { Metadata } from "next";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { listAuditLogs } from "@/lib/admin/sanity-audit";

export const metadata: Metadata = { title: "ประวัติการทำงาน" };

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

export default async function AdminAuditPage() {
  await requireAdminPermission("audit:read");
  const result = await listAuditLogs();

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">ตรวจสอบย้อนหลังได้</p>
      <h1 className="mt-2 text-3xl font-semibold">ประวัติการทำงาน</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
        ทุกการบันทึกผ่าน Control Plane ระบุผู้ทำ รายการที่ทำ สิ่งที่เกี่ยวข้อง เวลา และรหัสอ้างอิง เพื่อให้ตรวจสอบย้อนหลังได้
      </p>

      {result.error ? (
        <section className="mt-6 rounded-3xl border border-amber-200/20 bg-amber-200/10 p-5 text-sm leading-6 text-amber-50">
          <h2 className="font-semibold">ยังอ่านประวัติจากฐานข้อมูล Control Plane ไม่ได้</h2>
          <p className="mt-2 text-amber-50/80">ระบบหยุดไว้เพื่อความปลอดภัยเมื่อ private operational database ไม่ตรง lane หรือยังไม่พร้อม และจะไม่ย้อนกลับไปใช้ Sanity operational records เก่าแทนโดยอัตโนมัติ</p>
        </section>
      ) : null}

      {!result.error && result.rows.length === 0 ? (
        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-7 text-center">
          <h2 className="text-lg font-semibold">ยังไม่มีรายการในประวัติ</h2>
          <p className="mt-2 text-sm text-white/65">เมื่อสร้างข้อเสนอ อนุมัติ ตรวจ SEO หรือนำข้อเสนอไปใช้กับฉบับร่าง ระบบจะแสดงรายการที่นี่</p>
        </section>
      ) : null}

      {result.rows.length > 0 ? (
        <section className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025]">
          <p className="px-5 pt-4 text-sm text-white/60 xl:hidden">เลื่อนตารางไปทางซ้ายหรือขวาเพื่อดูข้อมูลทั้งหมด</p>
          <div role="region" aria-label="ตารางประวัติการทำงาน" tabIndex={0} className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-white/60">
                <tr>
                  <th className="px-5 py-4 font-medium">เวลา</th>
                  <th className="px-4 py-4 font-medium">ผู้ทำ</th>
                  <th className="px-4 py-4 font-medium">รายการ</th>
                  <th className="px-4 py-4 font-medium">ข้อมูลที่เกี่ยวข้อง</th>
                  <th className="px-4 py-4 font-medium">พื้นที่</th>
                  <th className="px-5 py-4 font-medium">รหัสอ้างอิงสำหรับตรวจสอบ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {result.rows.map((row) => (
                  <tr key={row.id} className="transition hover:bg-white/[0.025]">
                    <td className="px-5 py-4 text-white/50">{formatTimestamp(row.timestamp)}</td>
                    <td className="px-4 py-4">
                      <div className="text-white/70">{row.actor || "—"}</div>
                      <div className="mt-1 text-xs text-white/60">{row.actorType || "—"}</div>
                    </td>
                    <td className="px-4 py-4 font-medium text-white/75">{row.action || "—"}</td>
                    <td className="px-4 py-4 text-white/55">{row.objectType || "—"} · {row.objectId || "—"}</td>
                    <td className="px-4 py-4 text-white/55">{row.environment || "—"}</td>
                    <td className="px-5 py-4 font-mono text-xs text-white/60">{row.requestId || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
