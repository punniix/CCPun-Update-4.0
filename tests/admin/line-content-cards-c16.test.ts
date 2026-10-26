import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as cards from "../../lib/line/content-cards";
import test from "node:test";
import {
  buildLineArticleFlexMessage,
  buildLineArticleImageUrl,
  LINE_DISCOVERY_CONFIG,
  selectLineDiscoveryArticles,
  trimCardText,
  type LineArticleCardSource,
} from "../../lib/line/content-cards";

const require = createRequire(import.meta.url);
const { loadFixtureModule } = require("../../qa/phase1-fixture-loader.mjs");
const now = Date.parse("2026-10-26T00:00:00Z");
const empty = { maxCards: 3, items: [] };
const motor = "motor_quote_review";
function article(slug = "car-insurance-types", patch: Partial<LineArticleCardSource> = {}): LineArticleCardSource {
  return {
    slug, title: "Standard title", excerpt: "Standard excerpt", category: "ประกันรถยนต์",
    categorySlug: "motor-insurance", status: "published", noindex: false,
    publishedAt: "2026-10-20T00:00:00Z", ...patch,
  };
}
function bubble(row: LineArticleCardSource) {
  const message = buildLineArticleFlexMessage(motor, [row], { maxCards: 1, items: [{ slug: row.slug, enabled: true }] });
  assert.ok(message);
  return message.contents.contents[0] as { body: { contents: { text: string }[] }; hero?: { url: string } };
}

test("C16 dedicated LINE copy wins independently; blank fields preserve title/excerpt fallbacks", () => {
  const row = article(undefined, { lineTitle: " LINE title ", lineDescription: " LINE description " });
  assert.deepEqual(bubble(row).body.contents.map(item => item.text), [row.category, "LINE title", "LINE description"]);
  assert.deepEqual(bubble({ ...row, lineTitle: " ", lineDescription: "\n" }).body.contents.map(item => item.text), [row.category, row.title, row.excerpt]);
  assert.equal(bubble({ ...row, lineTitle: undefined }).body.contents[2].text, "LINE description");
  assert.equal(bubble({ ...row, lineDescription: undefined }).body.contents[1].text, "LINE title");
  assert.equal(bubble({ ...row, lineDescription: "", excerpt: " \n " }).body.contents[2].text, row.title);
});

test("C16 chip is the actual article category even for curated cross-category bridge cards", () => {
  const row = article("financial-pyramid", { category: "การเงินส่วนบุคคล", categorySlug: "personal-finance" });
  assert.equal(bubble(row).body.contents[0].text, row.category);
  assert.notEqual(bubble(row).body.contents[0].text, LINE_DISCOVERY_CONFIG[motor].label);
});

test("C16 Sanity image URL requests JPEG at 1040 over https, retaining exact asset path and crop", () => {
  for (const suffix of ["jpg", "png", "webp"]) {
    const src = `http://cdn.sanity.io/images/fixture/uat/asset-1200x630.${suffix}?auto=format&fm=webp&w=320&rect=0%2C0%2C1200%2C630#fragment`;
    const url = new URL(buildLineArticleImageUrl(src)!);
    assert.equal(url.protocol, "https:");
    assert.equal(url.pathname, new URL(src).pathname, "never rename the original asset extension/path");
    assert.equal(url.searchParams.get("fm"), "jpg");
    assert.equal(url.searchParams.get("w"), "1040");
    assert.equal(url.searchParams.get("rect"), "0,0,1200,630");
    assert.equal(url.searchParams.has("auto"), false);
    assert.equal(url.hash, "");
    assert.equal(bubble(article(undefined, { featuredImage: { src, alt: "fixture", width: 1200, height: 630 } })).hero?.url, url.href);
  }
});

test("C16 missing/relative/non-Sanity/unsafe images omit hero while preserving valid text cards", () => {
  for (const src of [undefined, "", "/images/asset.webp", "//cdn.sanity.io/images/a.png", "invalid", "https://other.example/a.jpg", "https://cdn.sanity.io.evil.example/a.jpg", "https://user:pass@cdn.sanity.io/a.jpg", "ftp://cdn.sanity.io/a.jpg"]) {
    assert.equal(buildLineArticleImageUrl(src), null);
    assert.equal(bubble(article(undefined, { featuredImage: src ? { src, alt: "fixture", width: 1, height: 1 } : undefined })).hero, undefined);
  }
});

test("C16 trimming cuts English and Thai at complete words without appended ellipsis", () => {
  assert.equal(trimCardText("  alpha   beta gamma ", 12), "alpha beta");
  assert.equal(trimCardText("alpha beta", 10), "alpha beta");
  const thai = "วางแผนประกันสุขภาพสำหรับครอบครัว";
  const words = [...new Intl.Segmenter("th", { granularity: "word" }).segment(thai)].filter(item => item.isWordLike);
  const firstTwo = words.slice(0, 2).map(item => item.segment).join("");
  const max = [...new Intl.Segmenter("th", { granularity: "grapheme" }).segment(firstTwo)].length + 1;
  assert.equal(trimCardText(thai, max), firstTwo);
  for (const input of [thai, "alpha beta gamma", "supercalifragilisticexpialidocious", "ที่นี่".repeat(30)]) {
    const result = trimCardText(input, 8);
    assert.ok(result.trim().length > 0);
    assert.ok([...new Intl.Segmenter("th", { granularity: "grapheme" }).segment(result)].length <= 8);
    assert.doesNotMatch(result, /…|\.\.\./);
  }
});

test("C16 empty curation selects newest matching published/indexable articles without mutating inputs", () => {
  const rows = [article("older", { publishedAt: "2026-10-01T00:00:00Z" }), article("newer"), article("unrelated", { category: "ประกันสุขภาพ", categorySlug: "health-insurance" })];
  const snapshot = structuredClone(rows);
  assert.deepEqual(selectLineDiscoveryArticles(motor, rows, { ...empty, maxCards: 1 }, now).map(row => row.slug), ["newer"]);
  assert.deepEqual(rows, snapshot);
});

test("C16 empty curation rejects drafts, future, invalid/missing dates, noindex and canonical mismatch", () => {
  const rows = [article("draft", { status: "draft" }), article("draft-id", { id: "drafts.article" }), article("future", { publishedAt: "2027-01-01T00:00:00Z" }), article("noindex", { noindex: true }), article("undated", { publishedAt: undefined }), article("bad-date", { publishedAt: "invalid" }), article("canonical-mismatch", { canonical: "https://example.com/blog/other/" }), article("unsupported", { category: "Unknown", categorySlug: "unknown" }), article("live")];
  assert.deepEqual(selectLineDiscoveryArticles(motor, rows, empty, now).map(row => row.slug), ["live"]);
  assert.equal(buildLineArticleFlexMessage(motor, rows.slice(0, -1), empty), null);
});

test("C16 category mappings use physical URL owners and preserve configured Investment bridge only for curated/default mode", () => {
  const rows = [article("life", { category: "ประกันชีวิต", categorySlug: "life-insurance" }), article("health", { category: "ประกันสุขภาพ", categorySlug: "health-insurance" }), article("critical-illness-insurance", { category: "ประกันชีวิต", categorySlug: "life-insurance" }), article("investment", { category: "การลงทุน", categorySlug: "investment" }), article("financial-pyramid", { category: "การเงินส่วนบุคคล", categorySlug: "personal-finance" })];
  assert.deepEqual(selectLineDiscoveryArticles("life_health_policy_review", rows, empty, now).map(row => row.slug), ["life", "health", "critical-illness-insurance"]);
  assert.deepEqual(selectLineDiscoveryArticles("investment_before_you_act", rows, empty, now).map(row => row.slug), ["investment"]);
  assert.deepEqual(selectLineDiscoveryArticles("investment_before_you_act", rows, undefined, now).map(row => row.slug), ["financial-pyramid"]);
  assert.deepEqual(selectLineDiscoveryArticles(motor, [article("legacy", { categorySlug: undefined })], empty, now).map(row => row.slug), ["legacy"]);
});

test("C16 nonempty curation wins: no fill for partial, disabled or missing references", () => {
  const rows = [article("newest"), article("curated", { publishedAt: "2026-01-01T00:00:00Z" })];
  const select = (items: { slug: string; enabled: boolean }[]) => selectLineDiscoveryArticles(motor, rows, { maxCards: 3, items }, now).map(row => row.slug);
  assert.deepEqual(select([{ slug: "missing", enabled: true }, { slug: "curated", enabled: true }]), ["curated"]);
  assert.deepEqual(select([{ slug: "missing", enabled: true }]), []);
  assert.deepEqual(select([{ slug: "newest", enabled: false }]), []);
  assert.deepEqual(select([{ slug: "", enabled: true }]), []);
  assert.deepEqual(selectLineDiscoveryArticles(motor, [article("future", { publishedAt: "2027-01-01T00:00:00Z" })], { maxCards: 1, items: [{ slug: "future", enabled: true }] }, now), []);
});

function configFixture(stored: unknown = null) {
  const calls: string[] = [];
  const fakeClient = { withConfig: () => fakeClient, fetch: async (query: string) => { calls.push(query); return stored; } };
  const source = readFileSync(new URL("../../lib/admin/line/discovery-config.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const config = {} as typeof import("../../lib/admin/line/discovery-config");
  new Function("require", "exports", "process", compiled)((id: string) => {
    if (id === "server-only") return {};
    if (id === "next-sanity") return { createClient: () => fakeClient, defineQuery: (query: string) => query };
    if (id === "../environment") return { isAdminReadDataPlaneAllowed: () => true, isAdminDataPlaneAllowed: () => false };
    if (id === "../sanity-credentials") return { getAdminSanityReadToken: () => "synthetic-fixture-only", getAdminSanityWriteToken: () => null };
    if (id === "../../line/content-cards") return cards;
    if (["zod", "node:crypto"].includes(id)) return require(id);
    throw new Error(`Unexpected fixture dependency: ${id}`);
  }, config, { env: { NEXT_PUBLIC_SANITY_PROJECT_ID: "fixture", NEXT_PUBLIC_SANITY_DATASET: "uat" } });
  return { config, calls };
}

test("C16 stored empty curation reaches runtime auto-fill; dangling references never trigger it", async () => {
  for (const items of [[], [{ slug: null, enabled: true }], [{ slug: "missing", enabled: true }]]) {
    const { config } = configFixture({ _rev: "fixture-revision", motor: { maxCards: 2, items } });
    const result = await config.readLineDiscoveryCuration();
    assert.equal(result.source, "stored");
    assert.equal(result.journeys.motor_quote_review.maxCards, 2);
    assert.deepEqual(selectLineDiscoveryArticles(motor, [article("newest")], result.journeys.motor_quote_review, now).map(row => row.slug), items.length ? [] : ["newest"]);
  }
});

test("C16 mutation allows explicit empty list while retaining bounds, enabled and duplicate guards", () => {
  const { config } = configFixture();
  const input = { revision: null, journeys: Object.fromEntries(Object.keys(LINE_DISCOVERY_CONFIG).map(journey => [journey, { maxCards: 3, items: [] }])) };
  assert.equal(config.lineDiscoveryMutationSchema.safeParse(input).success, true);
  for (const patch of [{ maxCards: 0, items: [] }, { maxCards: 6, items: [] }, { maxCards: 3, items: [{ slug: "a", enabled: false }] }, { maxCards: 3, items: [{ slug: "a", enabled: true }, { slug: "a", enabled: true }] }]) {
    assert.equal(config.lineDiscoveryMutationSchema.safeParse({ ...input, journeys: { ...input.journeys, [motor]: patch } }).success, false);
  }
});

test("C16 absent/bad curation retains existing configured defaults without new provider fallthrough", async () => {
  for (const stored of [null, { invalid: true }]) {
    const { config, calls } = configFixture(stored);
    const result = await config.readLineDiscoveryCuration();
    assert.equal(result.source, "default");
    assert.deepEqual(result.journeys.motor_quote_review.items.map((item: { slug: string }) => item.slug), [...LINE_DISCOVERY_CONFIG[motor].articleSlugs]);
    assert.equal(calls.length, 1);
  }
});

test("C16 published runtime consumes mocked published summaries and curation without any real provider", async () => {
  let reads = 0;
  const runtime = loadFixtureModule("lib/admin/line/content-cards.ts", { mocks: new Map<string, unknown>([
    ["../../content/sanity", { sanityContentProvider: { listArticles: async (options: unknown) => { assert.deepEqual(options, { includeDrafts: false }); reads++; return [article("auto", { publishedAt: "2020-01-01T00:00:00Z" })]; } } }],
    ["./discovery-config", { readLineDiscoveryCuration: async () => ({ journeys: { [motor]: empty } }) }],
    ["../../line/content-cards", cards],
  ]), globals: { Date: class extends Date { static now() { return now; } } } });
  assert.deepEqual((await runtime.readPublishedLineDiscoveryArticles(motor)).map((row: LineArticleCardSource) => row.slug), ["auto"]);
  assert.equal((await runtime.buildPublishedLineArticleFlexMessage(motor)).contents.contents.length, 1);
  assert.equal(reads, 2);
});


test("C16 Admin save allows empty auto-selection and valid curation, while keeping disabled/unavailable/read-only guards", async () => {
  const { JSDOM } = require("jsdom");
  const React = require("react");
  const { createRoot } = require("react-dom/client");
  const Manager = loadFixtureModule("features/admin/line/LineDiscoveryManager.tsx").default;
  for (const scenario of [
    { name: "empty auto-selection", items: [], writeReady: true, allowed: true },
    { name: "valid curated", items: [{ slug: "fixture", enabled: true }], writeReady: true, allowed: true },
    { name: "nonempty all-disabled", items: [{ slug: "fixture", enabled: false }], writeReady: true, allowed: false },
    { name: "unavailable curated reference", items: [{ slug: "missing", enabled: true }], writeReady: true, allowed: false },
    { name: "read-only empty selection", items: [], writeReady: false, allowed: false },
  ]) {
    const dom = new JSDOM('<div id="root"></div>', { url: "https://admin-fixture.invalid/settings/" });
    const keys = ["window", "document", "navigator", "IS_REACT_ACT_ENVIRONMENT", "fetch"];
    const previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    const calls: Array<{ url: string; options?: RequestInit }> = [];
    const fixtureFetch = async (url: string, options?: RequestInit) => {
      calls.push({ url, options });
      return Response.json({ status: "saved", revision: "fixture-next" });
    };
    for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true, fetch: fixtureFetch })) {
      Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
    }
    const journeys = Object.fromEntries(Object.keys(LINE_DISCOVERY_CONFIG).map(journey => [journey, { maxCards: 3, items: scenario.items }]));
    const initialModel = {
      revision: "fixture-revision", source: "stored", writeReady: scenario.writeReady, journeys,
      articles: [{ slug: "fixture", title: "Fixture article", excerpt: "Fixture excerpt", category: "Fixture category", featuredImage: null }],
    };
    const root = createRoot(dom.window.document.getElementById("root"));
    try {
      await React.act(async () => root.render(React.createElement(Manager, { initialModel })));
      const save = [...dom.window.document.querySelectorAll("button")].find(button => button.textContent === "บันทึกลำดับ");
      assert.ok(save, scenario.name);
      assert.equal(save.disabled, !scenario.allowed, scenario.name);
      await React.act(async () => save.click());
      assert.equal(calls.length, scenario.allowed ? 1 : 0, scenario.name);
      if (scenario.allowed) {
        assert.equal(calls[0].url, "/api/admin/line/discovery/");
        assert.equal(calls[0].options?.method, "PUT");
        assert.deepEqual(JSON.parse(String(calls[0].options?.body)), { revision: "fixture-revision", journeys });
        assert.match(dom.window.document.querySelector('[role="status"]').textContent, /บันทึกแล้ว/);
      }
    } finally {
      await React.act(async () => root.unmount());
      dom.window.close();
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    }
  }
});
