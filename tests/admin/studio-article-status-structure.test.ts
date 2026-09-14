import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("Studio article workspace separates publication lifecycle states", () => {
  const source = read("cms/sanity/config/structure.ts");
  assert.match(source, /บทความ · แยกตามสถานะ/);
  assert.match(source, /ฉบับร่างใหม่ · ยังไม่เคยเผยแพร่/);
  assert.match(source, /เผยแพร่แล้ว · มีฉบับร่างแก้ไข/);
  assert.match(source, /เผยแพร่แล้ว · ฉบับ Live/);
  assert.match(source, /const ARTICLE_DRAFT_FILTER = `_type == "article" && _originalId in path\("drafts\.\*\*"\)`/);
  assert.match(source, /\$\{ARTICLE_DRAFT_FILTER\} && !defined\(publishedAt\)/);
  assert.match(source, /\$\{ARTICLE_DRAFT_FILTER\} && defined\(publishedAt\)/);
  assert.match(source, /!defined\(_originalId\) && defined\(publishedAt\)/);
});

test("Studio article workspace exposes the existing review workflow as filtered draft lists", () => {
  const source = read("cms/sanity/config/structure.ts");
  for (const status of ["drafting", "content-review", "fact-check", "compliance-review", "ready-for-coo", "approved"]) {
    assert.match(source, new RegExp(status));
  }
  assert.match(source, /review\.status == \$reviewStatus/);
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
