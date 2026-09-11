import assert from "node:assert/strict";
import test from "node:test";
import type { SanityClient } from "sanity";
import { articlePublishBlock, publicationSummary, publishApprovedArticle, type PublishableArticle } from "../../cms/sanity/policy/article-publication";
import { faqItem } from "../../cms/sanity/schema/objects/faq-item";
import { sourceReference } from "../../cms/sanity/schema/objects/source-reference";
import { tableRow, simpleTable } from "../../cms/sanity/schema/objects/table";
import { migratedImage } from "../../cms/sanity/schema/objects/migrated-image";
import { callout } from "../../cms/sanity/schema/objects/callout";
import { ctaBlock } from "../../cms/sanity/schema/objects/cta-block";
import { pdfDownload } from "../../cms/sanity/schema/objects/pdf-download";
import { detailsBlock } from "../../cms/sanity/schema/objects/details-block";
import { imageWithAlt } from "../../cms/sanity/schema/objects/image-with-alt";
import { divider } from "../../cms/sanity/schema/objects/divider";

const now = "2026-09-09T12:00:00.000Z";
const first = "2024-01-01T00:00:00.000Z";
const draft = { _id: "drafts.article1", _type: "article", _rev: "draft1", _createdAt: first, _updatedAt: first, publishedAt: "2025-01-01T00:00:00.000Z", review: { status: "approved" }, slug: { current: "original" }, category: { _ref: "category" }, faq: [{ _key: "q", question: "keep me" }], author: { _type: "reference", _weak: true, _ref: "author" } } as PublishableArticle;
const published = { ...draft, _id: "article1", _rev: "live1", publishedAt: first };

function memoryClient(seed: PublishableArticle[], fail = false) {
  let documents = new Map(seed.map((doc) => [doc._id, structuredClone(doc)]));
  let commitCount = 0;
  const operations: Array<(docs: Map<string, PublishableArticle>) => void> = [];
  const transaction = {
    patch(id: string, configure: (patch: unknown) => unknown) {
      let revision = "";
      const patch = { ifRevisionId(rev: string) { revision = rev; return patch; }, unset() { return patch; } };
      configure(patch);
      operations.push((docs) => { assert.equal(docs.get(id)?._rev, revision, "revision conflict"); });
      return transaction;
    },
    create(doc: PublishableArticle) { operations.push((docs) => { assert.ok(!docs.has(doc._id), "already exists"); docs.set(doc._id, structuredClone(doc)); }); return transaction; },
    createOrReplace(doc: PublishableArticle) { operations.push((docs) => { docs.set(doc._id, structuredClone(doc)); }); return transaction; },
    delete(id: string) { operations.push((docs) => { docs.delete(id); }); return transaction; },
    async commit() {
      commitCount++;
      const staged = structuredClone(documents);
      operations.forEach((operation) => operation(staged));
      if (fail) throw new Error("network failure");
      documents = staged;
      return { transactionId: "committed" };
    },
  };
  return { client: { transaction: () => transaction } as unknown as SanityClient, read: () => documents, commits: () => commitCount };
}

test("populated and empty Article cards have meaningful previews", () => {
  const schemas = [faqItem, sourceReference, tableRow, simpleTable, migratedImage, callout, ctaBlock, pdfDownload, detailsBlock, imageWithAlt, divider];
  for (const schema of schemas) {
    const prepare = schema.preview?.prepare;
    assert.ok(prepare, schema.name);
    for (const selection of [{}, { title: "ข้อมูลทดสอบ", subtitle: "รายละเอียด", cells: ["Bronze", "0–9999"], headers: ["ระดับ"], rows: [{}], alt: "ภาพทดสอบ", src: "/image.png" }]) {
      const preview = (prepare as (value: Record<string, unknown>) => { title?: unknown })(selection);
      assert.ok(preview.title, schema.name);
      assert.doesNotMatch(String(preview.title), /Untitled|undefined/);
    }
  }
  assert.equal(faqItem.preview!.prepare!({ title: undefined, subtitle: undefined }).title, "คำถามใหม่");
  assert.equal(sourceReference.preview!.prepare!({ title: undefined, url: undefined, publisher: undefined }).title, "แหล่งอ้างอิงใหม่");
  assert.equal(tableRow.preview!.prepare!({ cells: undefined }).title, "แถวใหม่");
});

test("publication leaves content/references intact and preserves ORIGINAL publishedAt", async () => {
  const db = memoryClient([draft, published]);
  await publishApprovedArticle(db.client, draft, published, now);
  const live = db.read().get("article1")!;
  assert.equal(live.publishedAt, first);
  assert.equal(live.contentUpdatedAt, now);
  assert.deepEqual(live.faq, draft.faq);
  assert.deepEqual(live.author, draft.author);
  assert.ok(!db.read().has(draft._id));
  assert.equal(draft.publishedAt, "2025-01-01T00:00:00.000Z");
});

test("first publish sets dates and fails when a published version appears concurrently", async () => {
  const fresh = { ...draft, publishedAt: undefined };
  const db = memoryClient([fresh]);
  await publishApprovedArticle(db.client, fresh, null, now);
  assert.equal(db.read().get("article1")?.publishedAt, now);
  const conflict = memoryClient([fresh, published]);
  await assert.rejects(publishApprovedArticle(conflict.client, fresh, null, now), /already exists/);
  assert.deepEqual(conflict.read().get("article1"), published);
  assert.deepEqual(conflict.read().get(fresh._id), fresh);
});

test("failed publication and revision conflicts leave both dates and versions untouched", async () => {
  for (const [changedDraft, changedLive, fail] of [[draft, published, true], [{ ...draft, _rev: "new" }, published, false], [draft, { ...published, _rev: "new" }, false]] as const) {
    const db = memoryClient([changedDraft, changedLive], fail);
    await assert.rejects(publishApprovedArticle(db.client, draft, published, now));
    assert.deepEqual(db.read().get(draft._id), changedDraft);
    assert.deepEqual(db.read().get(published._id), changedLive);
  }
});

test("review, URL, date, release and pending-reference guards fail closed", async () => {
  const invalid = [
    { ...draft, review: { status: "drafting" } },
    { ...draft, slug: { current: "changed" } },
    { ...draft, category: { _ref: "changed" } },
    { ...draft, _id: "versions.release.article1" },
    { ...draft, author: { _type: "reference", _ref: "author", _strengthenOnPublish: { type: "author" } } },
  ];
  for (const value of invalid) {
    const db = memoryClient([value, published]);
    await assert.rejects(publishApprovedArticle(db.client, value, published, now));
    assert.equal(db.commits(), 0);
  }
  assert.ok(articlePublishBlock({ ...draft, publishedAt: "2030-01-01" }, null, Date.parse(now)));
  assert.ok(articlePublishBlock(draft, { ...published, publishedAt: undefined }));
  assert.equal(articlePublishBlock(draft, published), null);
});

test("Live and draft state remains separate from review status", () => {
  assert.match(publicationSummary(published, draft), /Live.*ยังไม่เผยแพร่/);
  assert.match(publicationSummary(published, null), /ฉบับปัจจุบันเผยแพร่อยู่/);
  assert.match(publicationSummary(null, draft), /ยังไม่เผยแพร่/);
});
