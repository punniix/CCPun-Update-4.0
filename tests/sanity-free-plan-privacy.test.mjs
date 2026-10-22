import assert from "node:assert/strict";
import test from "node:test";
import { evaluate, parse } from "groq-js";
import {
  TARGETS,
  buildDocumentUrl,
  buildBoundaryQuery,
  buildQueryUrl,
  checkBoundary,
  checkPrivateDocument,
} from "../qa/sanity-free-plan-privacy.mjs";

const production = TARGETS.find((target) => target.key === "production");
const activeUat = TARGETS.find((target) => target.key === "active-uat");
const recovery = TARGETS.find((target) => target.key === "recovery-placeholder");

test("approved query targets are pinned to CCPun Sanity projects and raw perspective", () => {
  const url = buildQueryUrl(activeUat, "api", "count(*)");
  assert.equal(url.protocol, "https:");
  assert.equal(url.hostname, "ccb9lnw5.api.sanity.io");
  assert.equal(url.pathname, "/v2026-08-20/data/query/uat");
  assert.equal(url.searchParams.get("perspective"), "raw");
  assert.equal(url.searchParams.get("query"), "count(*)");
  assert.throws(() => buildQueryUrl({ projectId: "example", dataset: "uat" }, "api", "count(*)"));
  assert.throws(() => buildQueryUrl(activeUat, "example", "count(*)"));
});

test("production requires a public article control while private classes stay invisible", () => {
  const result = checkBoundary(production, {
    result: { articles: 5, authors: 1, categories: 4, operational: 0, drafts: 0, versions: 0 },
  });
  assert.equal(result.articles, 5);
  assert.throws(() => checkBoundary(production, {
    result: { articles: 0, authors: 1, categories: 4, operational: 0, drafts: 0, versions: 0 },
  }));
});

test("active UAT permits only explicit synthetic articles while private classes stay invisible", () => {
  assert.equal(checkBoundary(activeUat, {
    result: { articles: 0, authors: 2, categories: 6, operational: 0, drafts: 0, versions: 0, approvedSyntheticArticles: 0 },
  }).articles, 0);
  for (const key of ["articles", "operational", "drafts", "versions"]) {
    const result = { articles: 0, authors: 2, categories: 6, operational: 0, drafts: 0, versions: 0, approvedSyntheticArticles: 0, [key]: 1 };
    assert.throws(() => checkBoundary(activeUat, { result }));
  }
});

test("recovery placeholder must expose no editorial or operational content", () => {
  assert.deepEqual(checkBoundary(recovery, {
    result: { articles: 0, authors: 0, categories: 0, operational: 0, drafts: 0, versions: 0 },
  }), { articles: 0, authors: 0, categories: 0, operational: 0, drafts: 0, versions: 0 });
  for (const key of ["articles", "authors", "categories", "operational", "drafts", "versions"]) {
    const result = { articles: 0, authors: 0, categories: 0, operational: 0, drafts: 0, versions: 0, [key]: 1 };
    assert.throws(() => checkBoundary(recovery, { result }));
  }
});

test("counts fail closed on malformed responses", () => {
  assert.throws(() => checkBoundary(activeUat, {}));
  assert.throws(() => checkBoundary(activeUat, {
    result: { articles: "0", authors: 0, categories: 0, operational: 0, drafts: 0, versions: 0 },
  }));
});

test("direct reads reject any returned formerly public operational document", () => {
  assert.equal(checkPrivateDocument(200, { documents: [], omitted: [] }).readable, false);
  assert.throws(() => checkPrivateDocument(200, { documents: [{ _id: "PRE3q7eScK0PyOENLK4lnx" }] }));
  assert.throws(() => checkPrivateDocument(200, {}));
  for (const status of [401, 403, 404]) {
    assert.equal(checkPrivateDocument(status, { error: { type: "denied" } }).readable, false);
  }
});

test("direct document URLs are limited to approved CCPun datasets", () => {
  const url = buildDocumentUrl("ccb9lnw5", "uat", "PRE3q7eScK0PyOENLK4lnx");
  assert.equal(url.hostname, "ccb9lnw5.api.sanity.io");
  assert.equal(url.pathname, "/v2026-08-20/data/doc/uat/PRE3q7eScK0PyOENLK4lnx");
  assert.throws(() => buildDocumentUrl("example", "uat", "x"));
});


test("actual GROQ fixture admission rejects modified identity, author, indexing or markers", async () => {
  const fixtures = Array.from({ length: 11 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return { _id: `ccpun-uat-qa-article-20261023-${number}`, _type: "article",
      slug: { current: `uat-qa-20261023-${number}` }, author: { _ref: "ccpun-uat-qa-author-20261023" },
      seo: { noindex: true }, tags: ["UAT QA", "ข้อมูลสังเคราะห์", `qa-marker-${number}`] };
  });
  const query = parse(buildBoundaryQuery(activeUat));
  const counts = async dataset => (await evaluate(query, { dataset })).get();
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
