import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parsePublicCopy, publicCopyDocumentId, publicCopyInitialEntries, publicCopyText, getHomeCopyFaqs } from "../lib/content/public-copy-registry";
import { filterStudioDocumentActions, filterStudioStructureItems, filterStudioNewDocumentOptions } from "../cms/sanity/policy/studio-policy";

const home = { _id: publicCopyDocumentId("home"), _type: "publicPageCopy", scope: "home", locale: "th", entries: publicCopyInitialEntries("home") };

test("CMS text changes exact owned key, preserves fallback, and FAQ output shares the visible copy", () => {
  const copy = parsePublicCopy("home", { ...home, entries: [{ key: "home.hero.eyebrow", text: "ข้อความสำหรับ UAT" }, { key: "home.faq1.question", text: "คำถามจาก Sanity" }] });
  assert.equal(publicCopyText(copy)("home.hero.eyebrow"), "ข้อความสำหรับ UAT");
  assert.equal(getHomeCopyFaqs(copy)[0].question, "คำถามจาก Sanity");
  assert.equal(publicCopyText(copy)("home.hero.description"), publicCopyText({})("home.hero.description"));
  assert.ok(publicCopyInitialEntries("site").length > 40);
});

test("copy documents reject cross-page identity, arbitrary keys, HTML, duplicate and empty values", () => {
  for (const doc of [
    { ...home, _id: "publicPageCopy.site.th" }, { ...home, scope: "site" }, { ...home, locale: "en" },
    { ...home, entries: [{ key: "site.nav.home", text: "wrong scope" }] },
    { ...home, entries: [{ key: "home.hero.eyebrow", text: "<script>bad</script>" }] },
    { ...home, entries: [{ key: "home.hero.eyebrow", text: "" }] },
    { ...home, entries: [home.entries[0], home.entries[0]] },
  ]) assert.throws(() => parsePublicCopy("home", doc));
  assert.equal(parsePublicCopy("home", null)["home.hero.eyebrow"], publicCopyText({})("home.hero.eyebrow"));
});

test("page copy and SEO stay hidden and actionless in Production Studio", () => {
  const items = [{ getId: () => "publicPageCopy" }, { getId: () => "pageSeo" }, { getId: () => "article" }];
  assert.deepEqual(filterStudioStructureItems(items, "production-admin"), [items[2]]);
  assert.deepEqual(filterStudioStructureItems(items, "local-uat"), items);
  for (const type of ["publicPageCopy", "pageSeo"]) {
    assert.deepEqual(filterStudioDocumentActions([{ action: "publish" }], "production", "production-admin", type, "kyfxgjnq"), []);
    assert.deepEqual(filterStudioNewDocumentOptions([{ templateId: type }], "uat", "local-uat", "ccb9lnw5"), []);
  }
});

test("server reader preserves lane checks, published default and authenticated draft boundary", () => {
  const source = readFileSync(new URL("../lib/content/public-copy.ts", import.meta.url), "utf8");
  assert.ok(source.includes('from "./sanity-fetch"'));
  assert.ok(source.includes('IS_DRAFT_PREVIEW_ALLOWED && (await draftMode()).isEnabled'));
  assert.ok(source.includes('perspective: preview ? "drafts" : "published"'));
  const route = readFileSync(new URL("../apps/web/app/page.tsx", import.meta.url), "utf8");
  assert.ok(route.includes("getHomeCopyFaqs(copy)"));
  assert.ok(route.includes("faqs={homeFaqs}"));
});
