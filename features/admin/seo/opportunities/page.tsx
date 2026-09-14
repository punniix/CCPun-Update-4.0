import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { getSeoIntelligenceRuntimeStatus } from "@/lib/admin/seo-intelligence/foundation";
import GscManualSync from "./GscManualSync";
import Ga4ManualSync from "./Ga4ManualSync";

export const metadata: Metadata = { title: "Organic Search Performance" };

function bangkokDate(daysAgo: number) {
  const date = new Date(Date.now() - daysAgo * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export default async function SeoOpportunitiesPage() {
  await requireAdminPermission("seo:read");
  const runtime = getSeoIntelligenceRuntimeStatus();
  if (!runtime.enabled) notFound();
  const laneLabel = runtime.environment === "production-admin" ? "Production" : "UAT";

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">WEBSITE 4.2 · MANUAL READ-ONLY {laneLabel.toUpperCase()}</p>
          <h1 className="mt-2 text-3xl font-semibold">Organic Search Performance</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">ดูตัวเลขจริงจาก Google Search Console และ GA4 เทียบช่วงก่อนหน้าที่ยาวเท่ากัน ทุกครั้งเกิดจากการกด Sync โดยมนุษย์ ระบบอ่านอย่างเดียว ไม่สร้างข้อเสนอ และไม่แก้บทความ</p>
        </div>
        <Link href="/seo/" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5">กลับ SEO Control Center</Link>
      </div>

      <GscManualSync defaultStartDate={bangkokDate(27)} defaultEndDate={bangkokDate(0)} laneLabel={laneLabel} />
      <Ga4ManualSync defaultStartDate={bangkokDate(27)} defaultEndDate={bangkokDate(0)} laneLabel={laneLabel} />
    </div>
  );
}
