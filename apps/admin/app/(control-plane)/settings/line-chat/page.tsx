import type { Metadata } from "next";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { readLineChatAdminModel } from "@/lib/admin/line/chat-config";
import LineChatManager from "@/features/admin/line/LineChatManager";
import { BLOG_TOPIC_HUBS } from "@/lib/content/taxonomy";

export const metadata: Metadata = { title: "ปุ่มแชท LINE" };
export const dynamic = "force-dynamic";

// Owner-approved 2026-10-25: Settings > ปุ่มแชท LINE, next to LINE Discovery (Settings > การเชื่อมต่อ).
export default async function LineChatSettingsPage() {
  const access = await requireAdminPermission("settings:read");
  const model = await readLineChatAdminModel();
  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">ตั้งค่า</p>
      <h1 className="mt-2 text-3xl font-semibold">ปุ่มแชท LINE</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
        แก้หัวข้อและข้อความของปุ่มแชทบนเว็บ ทั้งค่าเริ่มต้นทั้งเว็บ ตามหมวด และรายหน้า ปุ่มพาไปได้แค่ LINE @ccpun เสมอ ถ้าค่าที่นี่อ่านไม่ได้ เว็บจะกลับไปใช้ค่าเริ่มต้นเอง
      </p>
      <LineChatManager initialModel={model} canEdit={access.role === "owner"} categories={BLOG_TOPIC_HUBS.map((hub) => ({ slug: hub.slug, title: hub.title }))} />
    </div>
  );
}
