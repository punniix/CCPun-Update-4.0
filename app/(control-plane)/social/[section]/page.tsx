import { notFound } from "next/navigation";
import AdminCapabilityState from "@/features/admin/components/AdminCapabilityState";
import SocialOperationsPage from "@/features/admin/social/operations-page";
import { requireAdminPermission } from "@/lib/admin/require-permission";

export default async function SocialSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (section === "queue") return <SocialOperationsPage />;
  await requireAdminPermission("social:read");
  if (section !== "campaigns") notFound();
  return <AdminCapabilityState
    title="Social Campaigns"
    status="not-configured"
    source="Sanity social variants + existing publication records"
    description="ยังไม่มี campaign entity ที่เป็น source of truth จึงไม่สร้างฐานข้อมูลหรือ grouping ใหม่จาก UI"
    action={{ href: "/social/posts/", label: "ดู Social posts" }}
  />;
}
