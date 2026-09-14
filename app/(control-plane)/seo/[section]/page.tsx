import { notFound } from "next/navigation";
import AdminCapabilityState, { type AdminCapabilityStatus } from "@/features/admin/components/AdminCapabilityState";
import { requireAdminPermission } from "@/lib/admin/require-permission";

const SECTIONS: Record<string, { title: string; status: AdminCapabilityStatus; source: string; description: string }> = {
  keywords: { title: "SEO Keywords", status: "partial", source: "GSC observations + Research snapshots", description: "ข้อมูลคำค้นมีอยู่ใน Opportunities และ Research แต่ยังไม่มี keyword workspace ที่รวม history เป็น source เดียว" },
  "internal-links": { title: "Internal Link Auditor", status: "not-configured", source: "Site crawl + internal link graph", description: "ยังไม่มี crawl snapshot และ link graph ที่ผ่าน freshness check จึงไม่สร้างคำแนะนำลิงก์จำลอง" },
  competitors: { title: "SERP & Competitors", status: "partial", source: "Research provider snapshots", description: "ข้อมูล provider บางส่วนมีใน Research แต่ยังไม่มี normalized competitor view สำหรับหน้านี้" },
  reports: { title: "SEO Reports", status: "not-configured", source: "SEO audit and performance snapshots", description: "ยังไม่มี report snapshot ที่ตรวจสอบ window และ freshness ร่วมกัน จึงยังไม่สรุปตัวเลขข้ามแหล่ง" },
};

export default async function SeoSectionPage({ params }: { params: Promise<{ section: string }> }) {
  await requireAdminPermission("seo:read");
  const item = SECTIONS[(await params).section];
  if (!item) notFound();
  return <AdminCapabilityState {...item} action={{ href: "/seo/opportunities/", label: "ดูข้อมูล SEO ที่มีอยู่" }} />;
}
