import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultContentSortOrder,
  filterContentRows,
  getContentFilterOptions,
  getContentTags,
  normalizeContentFilterParam,
  resolveContentFilters,
  resolveContentSort,
  sortContentRows,
} from "../../lib/admin/content-filters";

const rows = [
  { id: "one", category: " ประกันชีวิต ", tags: [" ประกันสุขภาพ ", "ประกันสุขภาพ", ""] },
  { id: "two", category: "การเงินส่วนบุคคล", tags: ["Retirement", " วางแผนเกษียณ "] },
  { id: "three", category: "ประกันชีวิต", tags: ["ประกันโรคร้ายแรง", "retirement"] },
  { id: "four", category: null, tags: null },
] as const;

test("query parameters accept one trimmed string and reject ambiguous repeated values", () => {
  assert.equal(normalizeContentFilterParam("  ประกันชีวิต  "), "ประกันชีวิต");
  assert.equal(normalizeContentFilterParam(["ประกันชีวิต", "การลงทุน"]), "");
  assert.equal(normalizeContentFilterParam(undefined), "");
});

test("article tags drop missing values and case variants while preserving the first display form", () => {
  const source = [" Topic ", "Topic", "", "topic"];
  assert.deepEqual(getContentTags(source), ["Topic"]);
  assert.deepEqual(source, [" Topic ", "Topic", "", "topic"]);
  assert.deepEqual(getContentTags(null), []);
});

test("filter options come only from returned rows and keep first-seen tag display order", () => {
  const options = getContentFilterOptions(rows);
  assert.deepEqual(new Set(options.categories), new Set(["การเงินส่วนบุคคล", "ประกันชีวิต"]));
  assert.deepEqual(options.tags, ["ประกันสุขภาพ", "Retirement", "วางแผนเกษียณ", "ประกันโรคร้ายแรง"]);
});

test("category and tag filters use exact normalized keys rather than partial matches", () => {
  assert.deepEqual(
    filterContentRows(rows, { category: " ประกันชีวิต ", tag: " ประกันสุขภาพ " }).map((row) => row.id),
    ["one"],
  );
  assert.deepEqual(filterContentRows(rows, { tag: "ประกัน" }), []);
  assert.deepEqual(filterContentRows(rows, { tag: "RETIREMENT" }).map((row) => row.id), ["two", "three"]);
});

test("unknown or repeated query filters fail safely to the unfiltered view", () => {
  const unknown = resolveContentFilters(rows, { category: "unknown", tag: ["Retirement", "retirement"] });
  assert.equal(unknown.category, "");
  assert.equal(unknown.tag, "");
  assert.deepEqual(unknown.rows.map((row) => row.id), ["one", "two", "three", "four"]);
});

test("valid category and tag options can combine into a clear empty result", () => {
  const filtered = resolveContentFilters(rows, { category: "การเงินส่วนบุคคล", tag: "ประกันโรคร้ายแรง" });
  assert.equal(filtered.category, "การเงินส่วนบุคคล");
  assert.equal(filtered.tag, "ประกันโรคร้ายแรง");
  assert.deepEqual(filtered.rows, []);
});

test("a case-variant query resolves to the first canonical display option", () => {
  const filtered = resolveContentFilters(rows, { tag: "RETIREMENT" });
  assert.equal(filtered.tag, "Retirement");
  assert.deepEqual(filtered.rows.map((row) => row.id), ["two", "three"]);
});


const sortableRows = [
  { id: "draft", title: "ข. ฉบับร่าง", category: "ประกันชีวิต", tags: [], reviewStatus: "content-review", seoScore: 32, publishedAt: null, updatedAt: "2026-08-29T14:21:00.000Z", isDraft: true, hasPublished: false },
  { id: "published-draft", title: "ก. เผยแพร่มีฉบับร่าง", category: "ประกันชีวิต", tags: [], reviewStatus: "ready-for-coo", seoScore: 69, publishedAt: "2026-08-03T22:29:00.000Z", updatedAt: "2026-08-29T14:22:00.000Z", isDraft: true, hasPublished: true },
  { id: "published", title: "ค. เผยแพร่แล้ว", category: "การเงินส่วนบุคคล", tags: [], reviewStatus: "approved", seoScore: 70, publishedAt: "2026-08-01T09:00:00.000Z", updatedAt: "2026-08-27T15:30:00.000Z", isDraft: false, hasPublished: true },
  { id: "missing-score", title: "ง. ไม่มีคะแนน", category: null, tags: [], reviewStatus: null, seoScore: null, publishedAt: null, updatedAt: "2026-08-20T09:00:00.000Z", isDraft: true, hasPublished: false },
] as const;

test("content sorting defaults to latest updated and rejects ambiguous query values", () => {
  assert.deepEqual(resolveContentSort({}), { sort: "updated-at", order: "desc" });
  assert.deepEqual(resolveContentSort({ sort: ["title", "seo-score"], order: "asc" }), { sort: "updated-at", order: "asc" });
  assert.deepEqual(resolveContentSort({ sort: "unknown", order: "sideways" }), { sort: "updated-at", order: "desc" });
  assert.equal(defaultContentSortOrder("title"), "asc");
  assert.equal(defaultContentSortOrder("seo-score"), "desc");
});

test("content sorting supports title, status, review, SEO, published and updated columns", () => {
  assert.deepEqual(sortContentRows(sortableRows, "title", "asc").map((row) => row.id), ["published-draft", "draft", "published", "missing-score"]);
  assert.deepEqual(sortContentRows(sortableRows, "document-status", "asc").map((row) => row.id), ["draft", "missing-score", "published-draft", "published"]);
  assert.deepEqual(sortContentRows(sortableRows, "review-status", "asc").map((row) => row.id), ["draft", "published-draft", "published", "missing-score"]);
  assert.deepEqual(sortContentRows(sortableRows, "review-status", "desc").map((row) => row.id), ["published", "published-draft", "draft", "missing-score"]);
  assert.deepEqual(sortContentRows(sortableRows, "seo-score", "desc").map((row) => row.id), ["published", "published-draft", "draft", "missing-score"]);
  assert.deepEqual(sortContentRows(sortableRows, "published-at", "desc").map((row) => row.id), ["published-draft", "published", "draft", "missing-score"]);
  assert.deepEqual(sortContentRows(sortableRows, "updated-at", "desc").map((row) => row.id), ["published-draft", "draft", "published", "missing-score"]);
});

test("filters and sorting resolve together without mutating the source rows", () => {
  const source = [...sortableRows];
  const resolved = resolveContentFilters(sortableRows, { category: "ประกันชีวิต", sort: "seo-score", order: "desc" });
  assert.equal(resolved.sort, "seo-score");
  assert.equal(resolved.order, "desc");
  assert.deepEqual(resolved.rows.map((row) => row.id), ["published-draft", "draft"]);
  assert.deepEqual(sortableRows, source);
});
