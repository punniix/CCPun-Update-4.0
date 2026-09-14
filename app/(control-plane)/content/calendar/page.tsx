import AdminCapabilityState from "@/features/admin/components/AdminCapabilityState";
import { requireAdminPermission } from "@/lib/admin/require-permission";

export default async function ContentCalendarPage() {
  await requireAdminPermission("content:read");
  return <AdminCapabilityState
    title="Content Calendar"
    status="partial"
    source="Article scheduling records"
    description="ระบบ Article Scheduler และสถานะ schedule ยังถูกเก็บรักษาไว้ แต่ยังไม่มี read model ที่รวมเป็นปฏิทิน จึงไม่สร้างตารางเวลาแยกหรือแสดงศูนย์ปลอม"
    action={{ href: "/content/articles/", label: "ดูสถานะใน Articles" }}
  />;
}
