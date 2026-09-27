import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { baseArticleSchema, bodyItemSchema } from "../../lib/content/sanity-schema";

const baseArticle = {
  _id: "article-live",
  _originalId: null,
  slug: "article-live",
  title: "บทความ Live",
  excerpt: "คำโปรยบทความ",
  category: "การเงินส่วนบุคคล",
  categorySlug: "personal-finance",
  tags: [],
  authorName: "CCPun",
  publishedAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
  seo: {
    title: "บทความ Live",
    description: "คำอธิบาย SEO",
    noindex: false,
  },
  ogImage: null,
  featuredImage: null,
};

test("invalid LINE-only copy is isolated instead of dropping a published article from public lists", () => {
  const parsed = baseArticleSchema.parse({
    ...baseArticle,
    lineTitle: "หัวข้อสำหรับ LINE ที่ยาวเกินขอบเขต ".repeat(5),
    lineDescription: "คำโปรยสำหรับ LINE ที่ยาวเกินขอบเขตและไม่ควรทำให้บทความ Live หายจากหน้า Blog ".repeat(4),
  });

  assert.equal(parsed.lineTitle, undefined);
  assert.equal(parsed.lineDescription, undefined);
  assert.equal(parsed.slug, "article-live");
});

test("legacy null Portable Text markDefs render while malformed mark definitions stay invalid", () => {
  const block = { _type: "block", children: [{ text: "อ่านต่อ", marks: null }], markDefs: null };
  assert.equal(bodyItemSchema.safeParse(block).success, true);
  assert.equal(bodyItemSchema.safeParse({ ...block, markDefs: [{ _key: "link", _type: "link", href: "javascript:alert(1)" }] }).success, false);
});


test("legacy drafts with no author normalize at the content boundary instead of failing schema parsing", () => {
  const parsed = baseArticleSchema.parse({
    ...baseArticle,
    _id: "drafts.article-no-author",
    _originalId: "drafts.article-no-author",
    authorName: null,
  });

  assert.equal(parsed.authorName, undefined);
});


test("published content still keeps author as a hard boundary", () => {
  const source = readFileSync(new URL("../../lib/content/sanity.ts", import.meta.url), "utf8");
  assert.match(source, /status === "published" && !authorName/);
  assert.match(source, /Published article is missing required author/);
});
