import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { evaluate, parse } from "groq-js";
import { TARGETS, buildBoundaryQuery, checkBoundary } from "../qa/sanity-free-plan-privacy.mjs";
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

test("legal copy retains rendered punctuation and accepts browser paths as escaped React text", () => {
  const expected = {
    "privacy.span5": "“เก็บเท่าที่จำเป็น ใช้ตามวัตถุประสงค์ที่แจ้ง และปกป้องด้วยมาตรการที่เหมาะสม”",
    "cookies.p14": "แถบแจ้งเตือนจะปรากฏที่ด้านล่างหน้าจอ คุณกด “ยอมรับ” หรือ “ตั้งค่าคุกกี้” แล้วเลือกแต่ละประเภทก่อนกด “บันทึกการตั้งค่า” การตั้งค่าจะถูกจำไว้เป็นเวลา 1 ปี",
    "cookies.p15": "ผ่านลิงก์ “ตั้งค่าคุกกี้” ที่ด้านล่างของเว็บไซต์",
    "cookies.p16": "คุณสามารถเปลี่ยนการตั้งค่าคุกกี้ได้ตลอดเวลา โดยกดที่ลิงก์ “ตั้งค่าคุกกี้” ที่ด้านล่างของทุกหน้าในเว็บไซต์ เมื่อปิด Meta Pixel เว็บไซต์จะถอนสิทธิ์ หยุดโหลดสคริปต์ และลบ _fbp/_fbc ที่ตั้งบนโดเมน CCPun เท่าที่เบราว์เซอร์อนุญาต",
    "cookies.p18": "คุณลบหรือบล็อกคุกกี้ได้จากการตั้งค่าเบราว์เซอร์ของคุณโดยตรง เช่น Chrome: Settings > Privacy and security > Cookies การบล็อกคุกกี้ทั้งหมดอาจส่งผลให้บางส่วนของเว็บไซต์ทำงานได้ไม่เต็มที่",
  } as const;
  for (const [key, value] of Object.entries(expected)) assert.equal(publicCopyText({})(key as keyof typeof expected), value);
  for (const scope of ["privacy", "cookies"] as const) {
    const entries = publicCopyInitialEntries(scope);
    assert.deepEqual(parsePublicCopy(scope, { _id: publicCopyDocumentId(scope), _type: "publicPageCopy", scope, locale: "th", entries }), Object.fromEntries(entries.map(({ key, text }) => [key, text])));
    const source = readFileSync(new URL(`../features/legal/pages/${scope === "privacy" ? "PrivacyPage" : "CookiePolicyPage"}.tsx`, import.meta.url), "utf8");
    assert.ok(!source.includes("dangerouslySetInnerHTML"));
  }
  const text = "Settings > Privacy & security > Cookies";
  const document = { _id: publicCopyDocumentId("cookies"), _type: "publicPageCopy", scope: "cookies", locale: "th", entries: [{ key: "cookies.p18", text }] };
  const copy = parsePublicCopy("cookies", document);
  assert.equal(publicCopyText(copy)("cookies.p18"), text);
  assert.equal(renderToStaticMarkup(createElement("p", null, publicCopyText(copy)("cookies.p18"))), "<p>Settings &gt; Privacy &amp; security &gt; Cookies</p>");
  for (const invalid of ["<", "<script>bad</script>", ...Array.from({ length: 32 }, (_, index) => index).filter(index => ![9, 10, 13].includes(index)).map(index => String.fromCharCode(index)), "\u007f"]) {
    assert.throws(() => parsePublicCopy("cookies", { ...document, entries: [{ key: "cookies.p18", text: `Settings ${invalid} Privacy` }] }), /PUBLIC_COPY_ENTRY_INVALID/);
  }
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

test("generic public reader always requests published copy independently of draft flags and cookies", async () => {
  const key = "home.hero.eyebrow";
  const document = { ...home, entries: [{ key, text: "PUBLISHED COPY" }] };
  for (const previewAllowed of [false, true]) for (const cookieEnabled of [false, true]) {
    for (const data of [null, document, { ...document, _id: "private.document" }, "unavailable"]) {
      const requests: Array<{ query: string; params: Record<string, string>; perspective: string }> = [];
      let draftReads = 0;
      const reader = loadFixtureModule("lib/content/public-copy.ts", { mocks: new Map<string, unknown>([
        ["react", { cache: (fn: unknown) => fn }],
        ["next/headers", { draftMode: async () => { draftReads++; return { isEnabled: cookieEnabled }; } }],
        ["../deployment-environment", { IS_DRAFT_PREVIEW_ALLOWED: previewAllowed }],
        ["./sanity-fetch", { sanityFetch: async (request: { query: string; params: Record<string, string>; perspective: string }) => {
          requests.push(request);
          if (data === "unavailable") throw new Error("fixture-unavailable");
          return { data };
        } }],
      ]) });
      const copy = await reader.getPublicCopy("home");
      assert.deepEqual(copy, parsePublicCopy("home", data === document ? document : null));
      assert.equal(requests.length, 1);
      assert.equal(requests[0].perspective, "published");
      assert.deepEqual(requests[0].params, { id: "publicPageCopy-home-th" });
      assert.equal(requests[0].query, '*[_id == $id && _type == "publicPageCopy"][0]{_id, _type, scope, locale, entries[]{_key, key, text}}');
      assert.equal(draftReads, 0, `generic reader must not consult draft cookies: ${previewAllowed}/${cookieEnabled}`);
    }
  }
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

test("actual GROQ fixture admission rejects modified identity, author, indexing or markers", async () => {
  const fixtures = Array.from({ length: 11 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return { _id: `ccpun-uat-qa-article-20261023-${number}`, _type: "article",
      slug: { current: `uat-qa-20261023-${number}` }, author: { _ref: "ccpun-uat-qa-author-20261023" },
      seo: { noindex: true }, tags: ["UAT QA", "ข้อมูลสังเคราะห์", `qa-marker-${number}`] };
  });
  const activeUat = TARGETS.find(target => target.key === "active-uat")!;
  const query = parse(buildBoundaryQuery(activeUat));
  const counts = async (dataset: Record<string, unknown>[]) => (await evaluate(query, { dataset })).get();
  assert.equal(checkBoundary(activeUat, { result: await counts(fixtures) }).approvedSyntheticArticles, 11);
  for (const modified of [
    { _id: "another-article" }, { slug: { current: "uat-qa-20261023-02" } },
    { author: { _ref: "real-author" } }, { seo: { noindex: false } }, { seo: {} },
    { tags: ["UAT QA", "ข้อมูลสังเคราะห์", "qa-marker-02"] },
    { tags: ["ข้อมูลสังเคราะห์", "qa-marker-01"] }, { tags: ["UAT QA", "qa-marker-01"] },
  ]) {
    const result = await counts([{ ...fixtures[0], ...modified }, ...fixtures.slice(1)]);
    assert.equal(result.articles, 11);
    assert.equal(result.approvedSyntheticArticles, 10);
    assert.throws(() => checkBoundary(activeUat, { result }), /UNAPPROVED_PUBLIC_UAT_ARTICLE/);
  }
  const approved = await counts(fixtures);
  assert.throws(() => checkBoundary(activeUat, { result: { ...approved, approvedSyntheticArticles: 12 } }));
  const result = await counts([...fixtures, { _id: "private-real-article", _type: "article" }]);
  assert.throws(() => checkBoundary(activeUat, { result }), /UNAPPROVED_PUBLIC_UAT_ARTICLE/);
  for (const target of TARGETS.filter(target => target.key !== "active-uat")) {
    assert.ok(!buildBoundaryQuery(target).includes("approvedSyntheticArticles"));
  }
  const legacy = TARGETS.find(target => target.key === "legacy-uat");
  assert.throws(() => checkBoundary(legacy, { result: { articles: 1, authors: 0, categories: 0, operational: 0, drafts: 0, versions: 0 } }));
});
