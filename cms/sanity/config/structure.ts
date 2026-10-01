import { map } from "rxjs";
import { structureTool, type StructureBuilder, type StructureResolverContext } from "sanity/structure";
import { filterStudioStructureItems } from "../policy/studio-policy";
import type { AdminEnvironment } from "../../../lib/admin/environment";

const ARTICLE_DRAFT_FILTER = `_type == "article" && coalesce(_originalId, _id) in path("drafts.**")`;
const CATEGORY_DRAFT_FILTER = `_type == "category" && coalesce(_originalId, _id) in path("drafts.**")`;

function documentList(
  S: StructureBuilder,
  schemaType: "article" | "category",
  id: string,
  title: string,
  filter: string,
) {
  return S.documentList()
    .id(id)
    .title(title)
    .schemaType(schemaType)
    .filter(filter)
    .defaultOrdering([{ field: "_updatedAt", direction: "desc" }]);
}

function articleWorkspace(S: StructureBuilder, context: StructureResolverContext) {
  const reviewLists = [
    ["กำลังตรวจเนื้อหา", "content-review"],
    ["พร้อมให้คุณอนุมัติ", "ready-for-coo"],
    ["อนุมัติเนื้อหาแล้ว", "approved"],
  ] as const;

  return S.listItem()
    .id("article-workspace")
    .title("บทความ")
    .child(
      S.list()
        .id("article-status-workspace")
        .title("บทความ · มุมเผยแพร่และร่าง")
        .items([
          S.listItem()
            .id("articles-production")
            .title("เผยแพร่แล้ว")
            .child(() => context.documentStore.listenQuery({
              // Resolve published membership independently of the working-copy perspective.
              fetch: `*[_type == "article" && defined(publishedAt)] | order(publishedAt desc, _id asc) { _id, title }`,
              // Observe canonical changes only; Draft saves do not change Published membership.
              listen: `*[_type == "article" && !(_id in path("drafts.**")) && !(_id in path("versions.**"))]`,
            }, {}, { perspective: "published", tag: "studio-published-articles" }).pipe(
              map((articles: { _id: string; title?: string }[]) => S.list()
                .id("articles-production")
                .title("เผยแพร่แล้ว · รวมบทความที่มีร่างแก้ไข")
                .items(articles.map((article) => S.documentListItem()
                  .id(article._id)
                  .title(article.title || "บทความไม่มีชื่อ")
                  .schemaType("article")))),
            )),
          S.listItem()
            .id("articles-optimize")
            .title("แก้ไขรอเผยแพร่")
            .child(documentList(S, "article", "articles-optimize", "แก้ไขรอเผยแพร่ · ร่างที่มีวันเผยแพร่", `${ARTICLE_DRAFT_FILTER} && defined(publishedAt)`)),
          S.listItem()
            .id("articles-never-published")
            .title("ร่างใหม่")
            .child(documentList(S, "article", "articles-never-published", "ร่างใหม่ · ยังไม่มีวันเผยแพร่", `${ARTICLE_DRAFT_FILTER} && !defined(publishedAt)`)),
          S.divider(),
          S.listItem()
            .id("articles-all")
            .title("บทความทั้งหมด")
            .child(documentList(S, "article", "articles-all", "บทความทั้งหมด", `_type == "article"`)),
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
                      .child(documentList(S, "article", `article-review-${status}`, title, `${ARTICLE_DRAFT_FILTER} && review.status == $reviewStatus`).params({ reviewStatus: status })),
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
            .title("เผยแพร่แล้ว")
            .child(documentList(S, "category", "categories-production", "เผยแพร่แล้ว", `_type == "category" && !(coalesce(_originalId, _id) in path("drafts.**")) && !(coalesce(_originalId, _id) in path("versions.**"))`)),
          S.listItem()
            .id("categories-optimize")
            .title("ร่างที่ใช้งานอยู่")
            .child(documentList(S, "category", "categories-optimize", "ร่างที่ใช้งานอยู่", `${CATEGORY_DRAFT_FILTER} && status == "active"`)),
          S.listItem()
            .id("categories-never-published")
            .title("ร่างใหม่")
            .child(documentList(S, "category", "categories-never-published", "ร่างใหม่", `${CATEGORY_DRAFT_FILTER} && (status == "draft" || !defined(status))`)),
          S.divider(),
          S.listItem()
            .id("categories-all")
            .title("หมวดหมู่ทั้งหมด")
            .child(documentList(S, "category", "categories-all", "หมวดหมู่ทั้งหมด", `_type == "category"`)),
        ]),
    );
}

function blogSettingsWorkspace(S: StructureBuilder) {
  return S.listItem()
    .id("blog-settings")
    .title("หน้า Blog · บทความแนะนำ")
    .child(
      S.document()
        .schemaType("blogSettings")
        .documentId("blog-settings")
        .title("หน้า Blog · บทความแนะนำ"),
    );
}

export function createStudioStructurePlugin(environment: AdminEnvironment) {
  return structureTool({
    structure: (S, context) => {
      const allowedItems = filterStudioStructureItems(S.documentTypeListItems(), environment);
      const hasArticle = allowedItems.some((item) => item.getId() === "article");
      const hasCategory = allowedItems.some((item) => item.getId() === "category");
      const hasBlogSettings = allowedItems.some((item) => item.getId() === "blogSettings");
      const authors = allowedItems.filter((item) => item.getId() === "author").map((item) => item.title("ผู้เขียน"));
      const otherChannels = allowedItems.filter((item) => item.getId() === "masterContent" || item.getId() === "socialVariant");
      const remainingItems = allowedItems.filter((item) =>
        !["article", "category", "blogSettings", "author", "masterContent", "socialVariant"].includes(item.getId() ?? "")
      );
      const supportItems = [
        ...(hasCategory ? [categoryWorkspace(S)] : []),
        ...authors,
        ...(hasBlogSettings ? [blogSettingsWorkspace(S)] : []),
      ];

      return S.list()
        .id("content")
        .title("เนื้อหา")
        .items([
          ...(hasArticle ? [articleWorkspace(S, context)] : []),
          ...(supportItems.length ? [S.listItem().id("support-data").title("ข้อมูลประกอบ")
            .child(S.list().id("support-data-list").title("ข้อมูลประกอบ").items(supportItems))] : []),
          ...(otherChannels.length ? [S.listItem().id("other-channels").title("ช่องทางอื่น")
            .child(S.list().id("other-channels-list").title("ช่องทางอื่น").items(otherChannels))] : []),
          ...remainingItems,
        ]);
    },
  });
}
