import type { Metadata } from "next";
import { LineCampaignManager } from "@/features/admin/line/LineCampaignManager";
import { lineCampaignProviderEnabled, listLineCampaigns } from "@/lib/admin/line/campaigns";
import { requireAdminPermission } from "@/lib/admin/require-permission";

export const metadata: Metadata = { title: "LINE Campaigns" };

export default async function LineCampaignsPage() {
  await requireAdminPermission("campaign:read");
  let campaigns: Awaited<ReturnType<typeof listLineCampaigns>> = [];
  let unavailable = false;
  try { campaigns = await listLineCampaigns(); } catch { unavailable = true; }
  const providerSendEnabled = lineCampaignProviderEnabled();

  return <div>
    <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">LINE · RETURN LAYER</p>
    <h1 className="mt-2 text-3xl font-semibold">LINE Campaigns</h1>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">
      Campaign เป็น business object ที่ต้อง Human Approve ก่อนสร้าง private recipient queue เสมอ AI/Content tools ไม่มีสิทธิ์เห็น recipient list
    </p>
    {unavailable ? <section role="alert" className="mt-6 rounded-2xl border border-amber-200/20 bg-amber-200/10 p-5 text-sm text-amber-50">Campaign runtime ยังไม่พร้อม ระบบ fail-closed และไม่ fallback ไปอ่าน private tables</section> : <div className="mt-6"><LineCampaignManager campaigns={campaigns} providerSendEnabled={providerSendEnabled} /></div>}
  </div>;
}
