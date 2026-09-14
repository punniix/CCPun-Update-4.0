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
      title="Social ยังไม่ได้ตั้งค่า"
      description="เชื่อม Social operations หรือ Media Library ใน Settings ก่อนเริ่มเตรียมโพสต์ ปฏิทิน และการกระจายเนื้อหา"
      source="Social operations และ Media Library"
      action={{ href: "/settings/integrations/", label: "เปิด Integrations" }}
    />
  );
}
