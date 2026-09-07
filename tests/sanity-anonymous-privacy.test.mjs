import assert from "node:assert/strict";
import test from "node:test";
import { buildQueryUrl, checkControl, checkPrivateDocument, checkPrivateQuery } from "../qa/sanity-anonymous-privacy.mjs";

test("public control requires real readable content", () => {
  assert.deepEqual(checkControl({ result: 5 }), { publishedArticleCount: 5 });
  for (const result of [0, null, "5", -1]) assert.throws(() => checkControl({ result }));
});
test("all private counts must be numeric zero", () => {
  assert.deepEqual(checkPrivateQuery({ result: { operational: 0, drafts: 0, versions: 0 } }),
    { operational: 0, drafts: 0, versions: 0 });
  for (const key of ["operational", "drafts", "versions"]) {
    assert.throws(() => checkPrivateQuery({ result: { operational: 0, drafts: 0, versions: 0, [key]: 1 } }));
    assert.throws(() => checkPrivateQuery({ result: { operational: 0, drafts: 0, versions: 0, [key]: "0" } }));
  }
  assert.throws(() => checkPrivateQuery({}));
});
test("direct reads reject any returned document", () => {
  assert.equal(checkPrivateDocument(200, { documents: [], omitted: [] }).readable, false);
  assert.throws(() => checkPrivateDocument(200, { documents: [{ _id: "private.example" }] }));
  assert.throws(() => checkPrivateDocument(200, {}));
});
test("structured access denial is distinguished from transport failures", () => {
  for (const status of [401, 403, 404]) {
    assert.equal(checkPrivateDocument(status, { error: { type: "denied" } }).readable, false);
    assert.throws(() => checkPrivateDocument(status, {}));
  }
  assert.throws(() => checkPrivateDocument(500, { error: {} }));
  assert.throws(() => checkPrivateDocument(302, { error: {} }));
});
test("query transport is pinned to the approved project, dataset and raw perspective", () => {
  const url = buildQueryUrl("kyfxgjnq.api.sanity.io", "count(*)");
  assert.equal(url.protocol, "https:");
  assert.equal(url.pathname, "/v2026-08-20/data/query/production");
  assert.equal(url.searchParams.get("perspective"), "raw");
  assert.equal(url.searchParams.get("query"), "count(*)");
  assert.throws(() => buildQueryUrl("example.com", "count(*)"));
});
