import assert from "node:assert/strict";
import test from "node:test";
import {
  TARGETS,
  buildDocumentUrl,
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

test("UAT requires zero anonymously readable articles, operational docs, drafts and versions", () => {
  assert.equal(checkBoundary(activeUat, {
    result: { articles: 0, authors: 2, categories: 6, operational: 0, drafts: 0, versions: 0 },
  }).articles, 0);
  for (const key of ["articles", "operational", "drafts", "versions"]) {
    const result = { articles: 0, authors: 2, categories: 6, operational: 0, drafts: 0, versions: 0, [key]: 1 };
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
