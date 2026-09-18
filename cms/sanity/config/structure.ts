import { structureTool, type StructureBuilder } from "sanity/structure";
import { filterStudioStructureItems } from "../policy/studio-policy";
import type { AdminEnvironment } from "../../../lib/admin/environment";

const ARTICLE_DRAFT_FILTER = `_type == "article" && _originalId in path("drafts.**")`;
const CATEGORY_DRAFT_FILTER = `_type == "category" && _originalId in path("drafts.**")`;

function documentList(
  S: StructureBuilder,
  schemaType: "article" | "category",
  title: string,
  filter: string,
) {
  return S.documentList()
    .id(`${schemaType}-${title}`.replace(/[^a-z0-9-]+/gi, "-").toLowerCase())
    .title(title)
    .schemaType(schemaType)
    .filter(filter)
    .defaultOrdering([{ field: "_updatedAt", direction: "desc" }]);
}

function articleWorkspace(S: StructureBuilder) {
  const reviewLists = [
    ["กำลังเขียน", "drafting"],
    ["กำลังตรวจเนื้อหา", "content-review"],
    ["กำลังตรวจข้อเท็จจริง", "fact-check"],
    ["กำลังตรวจข้อกำหนดและกฎหมาย", "compliance-review"],
    ["พร้อมให้คุณอนุมัติ", "ready-for-coo"],
    ["อนุมัติเนื้อหาแล้ว", "approved"],
  ] as const;

  return S.listItem()
    .id("article-workspace")
    .title("บทความ")
    .child(
      S.list()
        .id("article-status-workspace")
        .title("บทความ · แยกตามสถานะ")
        .items([
          S.listItem()
            .id("articles-production")
            .title("Production · ฉบับ Live")
            .child(documentList(S, "article", "Production · ฉบับ Live", `_type == "article" && !defined(_originalId) && defined(publishedAt)`)),
          S.listItem()
            .id("articles-optimize")
            .title("Optimize · มี Draft รอ Publish")
            .child(documentList(S, "article", "Optimize · มี Draft รอ Publish", `${ARTICLE_DRAFT_FILTER} && defined(publishedAt)`)),
          S.listItem()
            .id("articles-never-published")
            .title("Draft · ยังไม่เคย Publish")
            .child(documentList(S, "article", "Draft · ยังไม่เคย Publish", `${ARTICLE_DRAFT_FILTER} && !defined(publishedAt)`)),
          S.divider(),
          S.listItem()
            .id("articles-all")
            .title("บทความทั้งหมด")
            .child(documentList(S, "article", "บทความทั้งหมด", `_type == "article"`)),
          S.listItem()
            .id("articles-review-stage")
            .title("ขั้นตรวจเนื้อหา")
            .child(
              S.list()
                .id("article-review-stage")
                .title("ขั้นตรวจเนื้อหา · ฉบับที่กำลังแก้")
                .items(
                  reviewLists.map(([title, status]) =>
                    S.listItem()
                      .id(`article-review-${status}`)
                      .title(title)
                      .child(documentList(S, "article", title, `${ARTICLE_DRAFT_FILTER} && review.status == $reviewStatus`).params({ reviewStatus: status })),
                  ),
                ),
            ),
        ]),
    );
}

function categoryWorkspace(S: StructureBuilder) {
  return S.listItem()
    .id("category-workspace")
    .title("หมวดหมู่")
    .child(
      S.list()
        .id("category-status-workspace")
        .title("หมวดหมู่ · แยกตามสถานะ")
        .items([
          S.listItem()
            .id("categories-production")
            .title("Production · Published")
            .child(documentList(S, "category", "Production · Published", `_type == "category" && !defined(_originalId)`)),
          S.listItem()
            .id("categories-optimize")
            .title("Optimize · Active Draft")
            .child(documentList(S, "category", "Optimize · Active Draft", `${CATEGORY_DRAFT_FILTER} && status == "active"`)),
          S.listItem()
            .id("categories-never-published")
            .title("Draft · ยังไม่เคย Publish")
            .child(documentList(S, "category", "Draft · ยังไม่เคย Publish", `${CATEGORY_DRAFT_FILTER} && (status == "draft" || !defined(status))`)),
          S.divider(),
          S.listItem()
            .id("categories-all")
            .title("หมวดหมู่ทั้งหมด")
            .child(documentList(S, "category", "หมวดหมู่ทั้งหมด", `_type == "category"`)),
        ]),
    );
}

export function createStudioStructurePlugin(environment: AdminEnvironment) {
  return structureTool({
    structure: (S) => {
      const allowedItems = filterStudioStructureItems(S.documentTypeListItems(), environment);
      const hasArticle = allowedItems.some((item) => item.getId() === "article");
      const hasCategory = allowedItems.some((item) => item.getId() === "category");
      const remainingItems = allowedItems.filter((item) => item.getId() !== "article" && item.getId() !== "category");

      return S.list()
        .id("content")
        .title("เนื้อหา")
        .items([
          ...(hasArticle ? [articleWorkspace(S)] : []),
          ...(hasCategory ? [categoryWorkspace(S)] : []),
          ...remainingItems,
        ]);
    },
  });
}
