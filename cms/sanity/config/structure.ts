import { structureTool, type StructureBuilder } from "sanity/structure";
import { filterStudioStructureItems } from "../policy/studio-policy";
import type { AdminEnvironment } from "../../../lib/admin/environment";

const ARTICLE_DRAFT_FILTER = `_type == "article" && _originalId in path("drafts.**")`;

function articleDocumentList(
  S: StructureBuilder,
  title: string,
  filter: string,
) {
  return S.documentList()
    .id(`article-${title}`.replace(/[^a-z0-9-]+/gi, "-").toLowerCase())
    .title(title)
    .schemaType("article")
    .filter(filter)
    .defaultOrdering([{ field: "_updatedAt", direction: "desc" }]);
}

function articleWorkspace(
  S: StructureBuilder,
) {
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
            .id("articles-all")
            .title("บทความทั้งหมด")
            .child(articleDocumentList(S, "บทความทั้งหมด", `_type == "article"`)),
          S.divider(),
          S.listItem()
            .id("articles-new-drafts")
            .title("ฉบับร่างใหม่ · ยังไม่เคยเผยแพร่")
            .child(articleDocumentList(S, "ฉบับร่างใหม่", `${ARTICLE_DRAFT_FILTER} && !defined(publishedAt)`)),
          S.listItem()
            .id("articles-published-with-draft")
            .title("เผยแพร่แล้ว · มีฉบับร่างแก้ไข")
            .child(articleDocumentList(S, "เผยแพร่แล้ว · มีฉบับร่างแก้ไข", `${ARTICLE_DRAFT_FILTER} && defined(publishedAt)`)),
          S.listItem()
            .id("articles-published")
            .title("เผยแพร่แล้ว · ฉบับ Live")
            .child(articleDocumentList(S, "เผยแพร่แล้ว · ฉบับ Live", `_type == "article" && !defined(_originalId) && defined(publishedAt)`)),
          S.divider(),
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
                      .child(articleDocumentList(S, title, `${ARTICLE_DRAFT_FILTER} && review.status == $reviewStatus`).params({ reviewStatus: status })),
                  ),
                ),
            ),
        ]),
    );
}

export function createStudioStructurePlugin(environment: AdminEnvironment) {
  return structureTool({
    structure: (S) => {
      const allowedItems = filterStudioStructureItems(S.documentTypeListItems(), environment);
      const hasArticle = allowedItems.some((item) => item.getId() === "article");
      const nonArticleItems = allowedItems.filter((item) => item.getId() !== "article");

      return S.list().id("content").title("เนื้อหา").items(hasArticle ? [articleWorkspace(S), ...nonArticleItems] : nonArticleItems);
    },
  });
}
