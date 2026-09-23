import type { Metadata } from "next";
import { LineCampaignManager } from "@/features/admin/line/LineCampaignManager";
import { lineCampaignProviderEnabled, listLineCampaigns } from "@/lib/admin/line/campaigns";
import { requireAdminPermission } from "@/lib/admin/require-permission";

export const metadata: Metadata = { title: "ข้อความแจ้งลูกค้า" };

export default async function LineCampaignsPage() {
  await requireAdminPermission("campaign:read");

  let campaigns: Awaited<ReturnType<typeof listLineCampaigns>> = [];
  let unavailable = false;
  try {
    campaigns = await listLineCampaigns();
  } catch {
    unavailable = true;
  }

  const providerSendEnabled = lineCampaignProviderEnabled();

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">LINE OA</p>
      <h1 className="mt-2 text-3xl font-semibold">ข้อความแจ้งลูกค้า</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">
        เตรียมข้อความสำหรับลูกค้าหลายคนเป็นครั้งคราว ระบบจะไม่ส่งทันทีจนกว่าคุณจะตรวจและยืนยันเอง
      </p>

      {unavailable ? (
        <section
          role="alert"
          className="mt-6 rounded-2xl border border-amber-200/20 bg-amber-200/10 p-5 text-sm text-amber-50"
        >
          ตอนนี้ยังเปิดรายการข้อความแจ้งลูกค้าไม่ได้ ลองใหม่อีกครั้งภายหลัง
        </section>
      ) : (
        <div className="mt-6">
          <LineCampaignManager campaigns={campaigns} providerSendEnabled={providerSendEnabled} />
        </div>
      )}
    </div>
  );
}
