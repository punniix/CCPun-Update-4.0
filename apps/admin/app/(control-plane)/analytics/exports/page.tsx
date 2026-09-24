import type { Metadata } from "next";

import { ExportCenter } from "@/features/admin/analytics/ExportCenter";
import { requireAdminPermission } from "@/lib/admin/require-permission";

export const metadata: Metadata = { title: "ส่งออกข้อมูล" };

export default async function ExportsPage() {
  await requireAdminPermission("settings:read");

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">OWNER EXPORT CENTER</p>
      <h1 className="mt-2 text-3xl font-semibold">ส่งออกข้อมูล</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">
        เลือกชุดข้อมูลแล้วส่งออกเป็น CSV หรือ Google Sheet ที่อ่านได้ทันที โดยไม่รวม raw conversation ในการส่งออกทั่วไป
      </p>
      <div className="mt-6">
        <ExportCenter />
      </div>
    </div>
  );
}
