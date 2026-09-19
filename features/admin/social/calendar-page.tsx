import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SocialOperationalCalendar from "@/features/admin/social/SocialOperationalCalendar";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { getSocialOperationsRuntimeStatus } from "@/lib/admin/social/operations";
import { listSocialOperationalItems } from "@/lib/admin/social/operations-service";

export const metadata: Metadata = { title: "ปฏิทินโพสต์" };

export default async function SocialCalendarPage() {
  await requireAdminPermission("social:read");
  if (!getSocialOperationsRuntimeStatus().enabled) notFound();

  let items: Awaited<ReturnType<typeof listSocialOperationalItems>> = [];
  let unavailable = false;
  try {
    items = await listSocialOperationalItems();
  } catch {
    unavailable = true;
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">โซเชียล</p>
          <h1 className="mt-2 text-3xl font-semibold">ปฏิทินโพสต์</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
            จัดตารางจากคิวส่งโพสต์จริงและใช้เวลาไทย การลากเปลี่ยนวันหรือแก้เวลาใช้ขั้นตอนเดียวกัน และยังต้องผ่านการอนุมัติตามเดิม
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/social/queue/" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985]">เปิดคิวส่งโพสต์</Link>
          <Link href="/social/posts/" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985]">เปิดรายการโพสต์</Link>
        </div>
      </div>

      {unavailable ? (
        <section role="status" className="mt-6 rounded-2xl border border-amber-200/20 bg-amber-200/[0.05] px-4 py-3 text-sm leading-6 text-amber-50/85">
          ตอนนี้ยังอ่านปฏิทินจากคิวจริงไม่ได้ ระบบจึงไม่ใช้ข้อมูลจาก Sanity มาเดาสถานะแทน
        </section>
      ) : <SocialOperationalCalendar initialItems={items} />}
    </div>
  );
}
