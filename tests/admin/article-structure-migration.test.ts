import assert from "node:assert/strict";
import test from "node:test";
import { guardApply, normalizeArticle, planMigration, validateTarget } from "../../scripts/normalize-article-structures";

test("normalization is deterministic, schema scoped and idempotent without losing legacy data", () => {
  const original = {
    _id: "drafts.example", _rev: "revision", _type: "article",
    body: [{ _type: "simpleTable", headers: ["Name"], rows: [["Bronze"], { _type: "tableRow", _key: "keep", cells: ["Silver"] }] },
      { _type: "block", children: [{ _type: "span", text: "Question?", marks: ["link1"] }], markDefs: [{ _key: "link1", _type: "link", href: "/safe" }] },
      { _type: "migratedImage", src: "https://example.com/image.jpg", alt: "legacy" },
      { _type: "imageGallery", images: [{ _type: "imageWithAlt", asset: { _type: "reference", _ref: "asset" } }] }],
    faq: [{ _type: "faqItem", question: "Question?", answer: "Keep answer" }],
    sources: [{ _type: "sourceReference", label: "Source", url: "https://example.com" }],
    tags: ["plain"], migration: { sourceHtml: "<h2>Keep me</h2>", arbitrary: [{ foo: "bar" }] },
    migratedFeaturedImage: { _type: "migratedImage", src: "https://example.com/cover.jpg" },
    author: { _type: "reference", _ref: "author", _weak: true },
    publishedAt: "2020-01-01", contentUpdatedAt: "2021-01-01",
  };
  const snapshot = structuredClone(original);
  const result = normalizeArticle(original);
  assert.deepEqual(original, snapshot);
  assert.deepEqual(normalizeArticle(original), result);
  assert.equal(normalizeArticle(result.document).changes.length, 0);
  assert.equal(normalizeArticle(result.document).patch, null);
  assert.deepEqual(result.document.migration, original.migration);
  assert.deepEqual(result.document.migratedFeaturedImage, original.migratedFeaturedImage);
  assert.equal(result.document.publishedAt, original.publishedAt);
  assert.equal(result.document.contentUpdatedAt, original.contentUpdatedAt);
  assert.deepEqual(Object.keys(result.patch!.set).sort(), ["body", "faq", "sources"]);
  assert.equal(result.patch!.id, original._id);
  assert.equal(result.patch!.ifRevisionID, original._rev);
  assert.ok(result.warnings.some(({ issue }) => issue.includes("duplication")));
  assert.ok(result.warnings.some(({ issue }) => issue.includes("Weak reference")));
  assert.ok(result.changes.some(({ path }) => path === "body[0].rows[0]"));
});

test("invalid rows and existing keys are preserved and reported; generated keys avoid collisions", () => {
  const doc = { _id: "example", _rev: "r", _type: "article", body: [{ _type: "simpleTable", _key: "t", rows: [[4], { _key: "duplicate", cells: [] }, { _key: "duplicate", cells: [] }] }] };
  const result = normalizeArticle(doc);
  assert.deepEqual(result.document, doc);
  assert.equal(result.warnings.length, 2);
  const base = { _id: "example", _rev: "r", _type: "article", faq: [{ question: "a" }] };
  const first = normalizeArticle(base).document.faq as { _key: string }[];
  const collision = normalizeArticle({ ...base, faq: [{ question: "a" }, { _key: first[0]._key, question: "b" }] }).document.faq as { _key: string }[];
  assert.notEqual(collision[0]._key, collision[1]._key);
});

test("target and report guards fail closed and raw draft/published remain separate", () => {
  assert.throws(() => validateTarget("kyfxgjnq", "uat"));
  assert.throws(() => validateTarget("ccb9lnw5", "production"));
  const docs = ["example", "drafts.example"].map((_id) => ({ _id, _rev: _id, _type: "article", faq: [{ question: _id }] }));
  const plan = planMigration({ projectId: "kyfxgjnq", dataset: "production", documents: docs });
  assert.deepEqual(plan.patches.map(({ id }) => id), ["example", "drafts.example"]);
  assert.throws(() => guardApply(plan, "wrong", "kyfxgjnq/production"));
  assert.throws(() => guardApply(plan, plan.confirmation, undefined));
  assert.doesNotThrow(() => guardApply(plan, plan.confirmation, "kyfxgjnq/production"));
  assert.throws(() => planMigration({ projectId: "ccb9lnw5", dataset: "uat", documents: [docs[0], docs[0]] }));
  assert.throws(() => normalizeArticle({ ...docs[0], _rev: undefined }));
  assert.throws(() => normalizeArticle({ ...docs[0], _id: "versions.release.example" }));
});

test("full exports audit release snapshots without any release mutations", () => {
  const plan = planMigration({ projectId: "ccb9lnw5", dataset: "uat", documents: [
    { _id: "author", _type: "author" },
    { _id: "versions.release.example", _rev: "r", _type: "article", faq: [{ question: "Keep" }] },
  ] });
  assert.equal(plan.patches.length, 0);
  assert.equal(plan.report.skipped.length, 1);
  assert.equal(plan.report.documents[0].readOnly, true);
  assert.equal(plan.report.documents[0].changes.length, 1);
});
