import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { getSocialOperationsRuntimeStatus } from "@/lib/admin/social/operations";
import { SocialCalendarDashboard } from "@/features/admin/social/SocialWorkspaceSummary";

export const metadata: Metadata = { title: "Content Calendar" };

export default async function ContentCalendarUatPage() {
  await requireAdminPermission("social:read");
  if (!getSocialOperationsRuntimeStatus().enabled) notFound();

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">SOCIAL · PUBLICATION RECORDS</p>
          <h1 className="mt-2 text-3xl font-semibold">Content Calendar</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">ดู Sanity Draft และ publication record ปัจจุบัน รายการใหม่ที่เพิ่มภายหลังจะปรากฏจาก API โดยไม่ต้องแก้หน้าเว็บ และหน้านี้ไม่มีคำสั่งส่งโพสต์</p>
        </div>
        <Link href="/social/posts/" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5">กลับ Social Operations</Link>
      </div>

      <SocialCalendarDashboard />
    </div>
  );
}
