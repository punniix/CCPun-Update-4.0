import { notFound } from "next/navigation";
import AdminCapabilityState from "@/features/admin/components/AdminCapabilityState";
import { requireAdminPermission } from "@/lib/admin/require-permission";

const SECTIONS = {
  integrations: { title: "Integrations", source: "System Health + provider readiness", description: "สถานะ integration ใช้ health/readiness เดิมเป็น source of truth และไม่แสดง credential ใน UI", action: { href: "/operations/health/", label: "เปิด System Health" } },
  access: { title: "Access", source: "Google Login + server-side RBAC", description: "สิทธิ์ยังมาจาก allowlist และ RBAC เดิม หน้านี้ไม่สร้าง user database หรือขยาย cookie domain", action: { href: "/dashboard/", label: "กลับ Dashboard" } },
  system: { title: "System", source: "Environment and data-plane guards", description: "การตั้งค่า environment ยังคง fail-closed และแก้ได้ผ่าน deployment configuration ที่ได้รับอนุญาตเท่านั้น", action: { href: "/operations/health/", label: "ตรวจ System Health" } },
} as const;

export default async function SettingsSectionPage({ params }: { params: Promise<{ section: string }> }) {
  await requireAdminPermission("settings:read");
  const item = SECTIONS[(await params).section as keyof typeof SECTIONS];
  if (!item) notFound();
  return <AdminCapabilityState {...item} status="partial" />;
}
