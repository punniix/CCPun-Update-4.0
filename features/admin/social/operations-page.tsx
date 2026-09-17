import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SocialQueueClient from "@/features/admin/social/SocialQueueClient";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { getSocialOperationsRuntimeStatus } from "@/lib/admin/social/operations";
import { listSocialOperationalItems } from "@/lib/admin/social/operations-service";

export const metadata: Metadata = { title: "Social Queue" };

export default async function SocialQueuePage() {
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
      <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">SOCIAL · EXECUTION</p>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Queue</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
            ดู publication job จริง พร้อม attempt budget, lease, provider error และ action ที่เปิดเฉพาะเมื่อ state ปลอดภัย การ Execute ยังคงใช้ revision-bound Human Approval, CAS และ provider-write gate เดิม
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/social/calendar/" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985]">Calendar</Link>
          <Link href="/social/posts/" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985]">Posts</Link>
        </div>
      </div>

      <section role="note" className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm leading-6 text-white/65">
        Jobs ที่ provider mutation อาจเกิดแล้วแต่ checkpoint ไม่ครบจะถูกแสดงเป็น <span className="text-amber-50/85">Needs reconciliation</span> และไม่เปิด blind retry
      </section>

      {unavailable ? (
        <section role="status" className="mt-6 rounded-2xl border border-amber-200/20 bg-amber-200/[0.05] px-4 py-3 text-sm leading-6 text-amber-50/85">
          Operational store ยังอ่านไม่ได้ใน request นี้ จึงไม่แสดง queue จากข้อมูลสำรองหรือเดา state
        </section>
      ) : <SocialQueueClient initialItems={items} />}
    </div>
  );
}
