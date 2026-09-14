import AdminCapabilityState from "@/features/admin/components/AdminCapabilityState";
import { requireAdminPermission } from "@/lib/admin/require-permission";

export default async function SocialPostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPermission("social:read");
  const { id } = await params;
  return <AdminCapabilityState
    title={`Social post ${id}`}
    status="partial"
    source="Sanity social variant + publication record"
    description="รายการและ queue ใช้ source เดิมร่วมกันแล้ว แต่ยังไม่มี read adapter ราย ID ที่ยืนยัน revision และ provider state จึงไม่แสดงรายละเอียดจำลอง"
    action={{ href: "/social/posts/", label: "กลับ Social posts" }}
  />;
}
