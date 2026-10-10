import type { Metadata } from "next";

import { ExportCenter } from "@/features/admin/analytics/ExportCenter";
import UatOwnerExportCanary from "@/features/admin/components/UatOwnerExportCanary";
import {getAdminEnvironment} from "@/lib/admin/environment";
import {getAdminIdentity} from "@/lib/admin/identity";
import {resolveUatFabricConfig} from "@/lib/admin/n8n/uat-fabric-policy";
import { requireAdminPermission } from "@/lib/admin/require-permission";

export const metadata: Metadata = { title: "ส่งออกข้อมูล" };

export default async function ExportsPage() {
  await requireAdminPermission("settings:read");
  const identity = await getAdminIdentity();

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">ไฟล์ข้อมูลสำหรับคุณ</p>
      <h1 className="mt-2 text-3xl font-semibold">ส่งออกข้อมูล</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">
        ดาวน์โหลดข้อมูลที่บันทึกไว้เป็น CSV, Excel หรือ Google Sheet ได้ทุกเวลา แม้รอบอัปเดตรายวันกำลังทำงานหรือไม่สำเร็จ ไฟล์ระบุช่วงข้อมูล เวลาอัปเดต และคำอธิบายคอลัมน์ โดยไม่รวมข้อความสนทนากับลูกค้า
      </p>
      {getAdminEnvironment() === "admin-uat" && identity?.role === "owner" ? <UatOwnerExportCanary enabled={resolveUatFabricConfig(process.env).ready} /> : null}
      <div className="mt-6">
        <ExportCenter />
      </div>
    </div>
  );
}
