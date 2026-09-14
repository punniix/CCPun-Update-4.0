import assert from "node:assert/strict";
import test from "node:test";
import { buildPublishedArticleDocument } from "../../cms/sanity/policy/article-publication";

const baseDraft = {
  _id: "drafts.article-1",
  _type: "article",
  _rev: "draft-rev",
  review: { status: "approved" },
  slug: { current: "example" },
  category: { _ref: "category-1" },
};

test("normal publication always clears draft noindex", () => {
  const result = buildPublishedArticleDocument({
    ...baseDraft,
    seo: { title: "Example", noindex: true },
  } as never, null, "2026-09-14T14:00:00.000Z");

  assert.equal(result._id, "article-1");
  assert.equal(result.seo?.noindex, false);
  assert.equal(result.seo?.title, "Example");
  assert.equal(result.publishedAt, "2026-09-14T14:00:00.000Z");
});

test("updating a published article preserves first publishedAt while clearing noindex", () => {
  const result = buildPublishedArticleDocument({
    ...baseDraft,
    publishedAt: "2026-09-14T13:00:00.000Z",
    seo: { noindex: true },
  } as never, {
    _id: "article-1",
    _type: "article",
    _rev: "live-rev",
    publishedAt: "2026-09-01T00:00:00.000Z",
  } as never, "2026-09-14T14:00:00.000Z");

  assert.equal(result.seo?.noindex, false);
  assert.equal(result.publishedAt, "2026-09-01T00:00:00.000Z");
  assert.equal(result.contentUpdatedAt, "2026-09-14T14:00:00.000Z");
});
