import { ArticleDetailPage as ArticleDetailPageOwner } from "@/features/admin/components/ArticleDetailPage";

export default async function ArticleDetailPage(props: { params: Promise<{ id: string }> }) {
  return ArticleDetailPageOwner(props, {
    errorTitle: "Article detail",
    back: "กลับ Articles",
    eyebrow: "CONTENT · ARTICLE",
    reviewHeading: "Editorial status",
    publishHeading: "Publish state",
    seoHeading: "SEO score",
    keywordHeading: "Primary keyword",
    categoryHeading: "Category",
    updatedHeading: "Updated",
    studioLink: "Edit in Studio",
    auditLink: "ดู SEO audit",
    source: (dataset) => `Sanity ${dataset ?? "unconfigured"}`,
    reviewStatus: (status) => status ?? "ยังไม่ได้ระบุ",
    publishedDraft: "เผยแพร่แล้ว · มี Draft",
    draft: "Draft",
    noAudit: "ยังไม่มี audit",
  });
}
