import { AdminReviewsPage as AdminReviewsPageOwner } from "@/features/admin/components/SeoReviewInboxPage";
export { metadata } from "@/features/admin/components/SeoReviewInboxPage";

export default async function AdminReviewsPage() {
  return AdminReviewsPageOwner({
    dataset: (value) => value ?? "—",
    readFailure: "ระบบหยุดการอ่านและบันทึกไว้เพื่อความปลอดภัย และจะไม่สลับ project หรือชุดข้อมูลให้เอง",
  });
}
