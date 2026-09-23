import type { Metadata } from "next";
import AdminCapabilityState from "@/features/admin/components/AdminCapabilityState";
import { getMediaLibraryRuntimeStatus } from "@/lib/admin/media/foundation";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { getSocialFoundationRuntimeStatus } from "@/lib/admin/social/foundation";
import { getSocialOperationsRuntimeStatus } from "@/lib/admin/social/operations";
import SocialFoundationUatPage from "./page";
import SocialOverviewPage from "./overview-page";

export const metadata: Metadata = { title: "Social" };

export default async function SocialControlPlanePage() {
  await requireAdminPermission("social:read");

  if (getSocialOperationsRuntimeStatus().enabled) {
    return <SocialOverviewPage />;
  }

  if (getSocialFoundationRuntimeStatus().enabled || getMediaLibraryRuntimeStatus().enabled) {
    return <SocialFoundationUatPage />;
  }

  return (
    <AdminCapabilityState
      status="not-configured"
      title="ยังไม่ได้ตั้งค่างานโซเชียล"
      description="ตั้งค่าระบบโพสต์และคลังสื่อก่อนเริ่มเตรียมโพสต์ ปฏิทิน และการกระจายเนื้อหา"
      source="ระบบโพสต์และคลังสื่อ"
      action={{ href: "/settings/integrations/", label: "เปิดการเชื่อมต่อ" }}
    />
  );
}
