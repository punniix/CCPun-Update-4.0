import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { getSocialOperationsRuntimeStatus } from "@/lib/admin/social/operations";
import { isSocialPublicationApprovalEnabled } from "@/lib/admin/social/publishing";
import SocialMediaMetadataPanel from "@/features/admin/social/SocialMediaMetadataPanel";
import SocialPostsWorkspace from "@/features/admin/social/SocialPostsWorkspace";

export const metadata: Metadata = { title: "โพสต์และฉบับร่าง" };

export default async function SocialPostsPage() {
  await requireAdminPermission("social:read");
  const runtime = getSocialOperationsRuntimeStatus();
  if (!runtime.enabled) notFound();
  const showDeferredConnections = runtime.environment === "admin-uat";

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">โซเชียล</p>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">โพสต์และฉบับร่าง</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
            สร้างและแก้ฉบับร่าง พร้อมดูสถานะการส่งในหน้าเดียว การบันทึกฉบับร่างไม่ถือเป็นการอนุมัติและไม่ส่งโพสต์ออกไป
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/social/calendar/" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985]">ปฏิทิน</Link>
          <Link href="/social/queue/" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985]">คิวส่งโพสต์</Link>
        </div>
      </div>

      <section role="note" className="mt-6 rounded-2xl border border-amber-200/20 bg-amber-200/[0.05] px-4 py-3 text-sm leading-6 text-amber-50/85">
        ระบบจะส่งโพสต์จริงหลังผู้มีสิทธิ์ตรวจและอนุมัติแล้วเท่านั้น หาก Instagram ต้องเลือกเพลงหรือทำขั้นตอนในแอป ระบบจะส่งต่องานให้ทำบนมือถือแทน
      </section>

      <SocialPostsWorkspace approvalEnabled={isSocialPublicationApprovalEnabled()} />
      <SocialMediaMetadataPanel />

      <nav aria-label="ลิงก์โซเชียลเพิ่มเติม" className="mt-8 flex flex-wrap gap-2 border-t border-white/10 pt-5">
        <Link href="/analytics/social/" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5">ผลลัพธ์โซเชียล</Link>
        {showDeferredConnections ? <Link href="/analytics/social/post-live/" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5">สถิติย้อนหลังหลังไลฟ์</Link> : null}
        <Link href="/social/accounts/meta/" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5">การเชื่อมต่อ Meta</Link>
        {showDeferredConnections ? <Link href="/social/accounts/youtube/" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5">การเชื่อมต่อ YouTube</Link> : null}
        {showDeferredConnections ? <Link href="/social/accounts/tiktok/" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5">การเชื่อมต่อ TikTok</Link> : null}
      </nav>
    </div>
  );
}
