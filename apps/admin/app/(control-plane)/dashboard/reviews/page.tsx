import { AdminReviewsPage as AdminReviewsPageOwner } from "@/features/admin/components/SeoReviewInboxPage";
export { metadata } from "@/features/admin/components/SeoReviewInboxPage";
import { datasetLabel } from "@/lib/admin/presentation";

export default async function AdminReviewsPage() {
  return AdminReviewsPageOwner({
    dataset: datasetLabel,
    readFailure: "ระบบหยุดการอ่านและบันทึกไว้เพื่อความปลอดภัย และจะไม่สลับโครงการหรือชุดข้อมูลให้เอง",
  });
}
