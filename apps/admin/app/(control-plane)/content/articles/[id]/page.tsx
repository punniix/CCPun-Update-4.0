import { ArticleDetailPage as ArticleDetailPageOwner } from "@/features/admin/components/ArticleDetailPage";
import { contentReviewStatusLabel, datasetLabel } from "@/lib/admin/presentation";

export default async function ArticleDetailPage(props: { params: Promise<{ id: string }> }) {
  return ArticleDetailPageOwner(props, {
    errorTitle: "รายละเอียดบทความ",
    back: "กลับหน้าบทความ",
    eyebrow: "เนื้อหา · บทความ",
    reviewHeading: "ขั้นตรวจเนื้อหา",
    publishHeading: "การเผยแพร่",
    seoHeading: "คะแนน SEO",
    keywordHeading: "คำค้นหลัก",
    categoryHeading: "หมวด",
    updatedHeading: "อัปเดตล่าสุด",
    studioLink: "แก้ใน Sanity Studio",
    auditLink: "ดูผลตรวจ SEO",
    source: (dataset) => `เนื้อหา · ${datasetLabel(dataset)}`,
    reviewStatus: contentReviewStatusLabel,
    publishedDraft: "เผยแพร่แล้ว · มีฉบับร่างแก้ไข",
    draft: "ฉบับร่าง",
    noAudit: "ยังไม่มีผลตรวจ",
  });
}
