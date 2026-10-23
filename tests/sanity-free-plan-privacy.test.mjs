import assert from "node:assert/strict";
import test from "node:test";
import {
  TARGETS,
  buildDocumentUrl,
  buildBoundaryQuery,
  buildQueryUrl,
  checkBoundary,
  checkPrivateDocument,
  checkRetiredDataset,
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


test("unknown or malformed synthetic admission counts cannot exempt public UAT articles", () => {
  const result = { articles: 1, authors: 0, categories: 0, operational: 0, drafts: 0, versions: 0 };
  for (const approvedSyntheticArticles of [undefined, null, "1", -1, 0, 0.5, 12]) {
    assert.throws(() => checkBoundary(activeUat, { result: { ...result, approvedSyntheticArticles } }));
  }
  assert.equal(checkBoundary(activeUat, { result: { ...result, approvedSyntheticArticles: 1 } }).articles, 1);
  for (const target of TARGETS.filter(target => target.key !== "active-uat")) {
    assert.ok(!buildBoundaryQuery(target).includes("approvedSyntheticArticles"));
  }
});

test("only the retired legacy UAT dataset may answer with the exact not-found denial", () => {
  const legacy = TARGETS.find((target) => target.key === "legacy-uat");
  const notFound = { error: "Dataset not found", statusCode: 404, message: 'Dataset "uat" not found for project ID "kyfxgjnq"' };
  assert.deepEqual(checkRetiredDataset(legacy, 404, notFound), { retired: true, status: 404 });
  assert.throws(() => checkRetiredDataset(legacy, 401, notFound));
  assert.throws(() => checkRetiredDataset(legacy, 404, { ...notFound, error: "Unauthorized" }));
  assert.throws(() => checkRetiredDataset(legacy, 404, { ...notFound, message: 'Dataset "uat" not found for project ID "ccb9lnw5"' }));
  for (const target of [production, activeUat, recovery]) assert.throws(() => checkRetiredDataset(target, 404, notFound));
  // If the dataset is ever recreated, the ordinary boundary still applies.
  assert.throws(() => checkBoundary(legacy, { result: { articles: 1, authors: 0, categories: 0, operational: 0, drafts: 0, versions: 0 } }));
});
