import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { loadFixtureModule } from "../qa/phase1-fixture-loader.mjs";
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
    { ...home, _id: "publicPageCopy-site-th" }, { ...home, _id: "publicPageCopy.home.th" }, { ...home, scope: "site" }, { ...home, locale: "en" },
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

test("published copy singleton IDs stay public without exposing a Web read token", () => {
  assert.equal(publicCopyDocumentId("home"), "publicPageCopy-home-th");
  assert.equal(publicCopyDocumentId("site"), "publicPageCopy-site-th");
  assert.ok(!publicCopyDocumentId("home").includes("."));
});

test("native publish is limited to the two exact UAT page types after the Studio data-plane guard", () => {
  const actions = ["publish", "delete", "unpublish", "unpublishVersion", "discardChanges"].map(action => ({ action }));
  for (const allowed of [true, false]) {
    const { filterStudioDocumentActions: filter }: { filterStudioDocumentActions: typeof filterStudioDocumentActions } = loadFixtureModule("cms/sanity/policy/studio-policy.ts", {
      mocks: new Map([["../../../lib/admin/environment", { isStudioDataPlaneAllowed: () => allowed }]]),
    });
    for (const type of ["publicPageCopy", "pageSeo"]) {
      for (const environment of ["development", "local-uat", "admin-uat"] as const) {
        const result = filter(actions, "uat", environment, type, "ccb9lnw5");
        assert.equal(result.some(({ action }) => action === "publish"), allowed);
        assert.ok(!result.some(({ action }) => ["delete", "unpublish", "unpublishVersion"].includes(action)));
      }
      for (const [dataset, environment, project] of [
        ["production", "local-uat", "ccb9lnw5"], ["uat", "local-uat", "kyfxgjnq"],
        ["production", "production-admin", "kyfxgjnq"], ["production", "local-production", "kyfxgjnq"],
        ["uat", "web-uat", "ccb9lnw5"], ["uat", "unknown", "ccb9lnw5"],
      ] as const) assert.ok(!filter(actions, dataset, environment, type, project).some(({ action }) => action === "publish"));
    }
    for (const type of ["article", "author", "category", "masterContent", "auditLog"]) {
      assert.ok(!filter(actions, "uat", "local-uat", type, "ccb9lnw5").some(({ action }) => action === "publish"));
    }
  }
});
