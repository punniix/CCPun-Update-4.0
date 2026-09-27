import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("Studio article workspace separates publication lifecycle states", () => {
  const source = read("cms/sanity/config/structure.ts");
  assert.match(source, /บทความ · แยกตามสถานะ/);
  assert.match(source, /Production · ฉบับ Live/);
  assert.match(source, /Optimize · มี Draft รอ Publish/);
  assert.match(source, /Draft · ยังไม่เคย Publish/);
  assert.match(source, /const ARTICLE_DRAFT_FILTER = `_type == "article" && _originalId in path\("drafts\.\*\*"\)`/);
  assert.match(source, /\$\{ARTICLE_DRAFT_FILTER\} && !defined\(publishedAt\)/);
  assert.match(source, /\$\{ARTICLE_DRAFT_FILTER\} && defined\(publishedAt\)/);
  assert.match(source, /!defined\(_originalId\) && defined\(publishedAt\)/);
});

test("Studio category workspace separates Production, Optimize and never-published Drafts", () => {
  const source = read("cms/sanity/config/structure.ts");
  assert.match(source, /หมวดหมู่ · แยกตามสถานะ/);
  assert.match(source, /Production · Published/);
  assert.match(source, /Optimize · Active Draft/);
  assert.match(source, /Draft · ยังไม่เคย Publish/);
  assert.match(source, /const CATEGORY_DRAFT_FILTER = `_type == "category" && _originalId in path\("drafts\.\*\*"\)`/);
  assert.match(source, /\$\{CATEGORY_DRAFT_FILTER\} && status == "active"/);
  assert.match(source, /\$\{CATEGORY_DRAFT_FILTER\} && \(status == "draft" \|\| !defined\(status\)\)/);
});

test("Studio article workspace exposes the existing review workflow as filtered draft lists", () => {
  const source = read("cms/sanity/config/structure.ts");
  for (const status of ["content-review", "ready-for-coo", "approved"]) {
    assert.match(source, new RegExp(status));
  }
  assert.match(source, /review\.status == \$reviewStatus/);
  assert.doesNotMatch(source, /\["กำลังเขียน", "drafting"\]/);
  assert.doesNotMatch(source, /\["กำลังตรวจข้อเท็จจริง", "fact-check"\]/);
  assert.doesNotMatch(source, /\["กำลังตรวจข้อกำหนดและกฎหมาย", "compliance-review"\]/);
  assert.match(source, /filterStudioStructureItems/);
});

test("Article list preview displays publication state together with review stage", () => {
  const source = read("cms/sanity/schema/documents/article.ts");
  assert.match(source, /id: "_id"/);
  assert.match(source, /originalId: "_originalId"/);
  assert.match(source, /publishedAt: "publishedAt"/);
  assert.match(source, /เผยแพร่แล้ว · มีฉบับร่างแก้ไข/);
  assert.match(source, /ฉบับร่างใหม่/);
  assert.match(source, /เผยแพร่แล้ว · ฉบับ Live/);
  assert.match(source, /reviewLabels\[reviewStatus\]/);
});
