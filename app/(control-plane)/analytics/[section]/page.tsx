import { notFound } from "next/navigation";
import AdminCapabilityState from "@/features/admin/components/AdminCapabilityState";
import { requireAdminPermission } from "@/lib/admin/require-permission";

const SECTIONS = {
  website: { title: "Website Analytics", source: "GA4", description: "GA4 observations มี consumer ใน SEO แต่ยังไม่มี website metric read model ที่ระบุ date range, freshness และ timezone ครบ" },
  conversions: { title: "Conversion Analytics", source: "Approved conversion event contract", description: "ยังไม่มี conversion dataset ที่ผ่าน privacy contract สำหรับ Control Plane จึงไม่แสดงค่าศูนย์แทนข้อมูลที่ขาด" },
} as const;

export default async function AnalyticsSectionPage({ params }: { params: Promise<{ section: string }> }) {
  await requireAdminPermission("dashboard:read");
  const item = SECTIONS[(await params).section as keyof typeof SECTIONS];
  if (!item) notFound();
  return <AdminCapabilityState {...item} status="not-configured" action={{ href: "/analytics/search/", label: "ดู Search performance" }} />;
}
