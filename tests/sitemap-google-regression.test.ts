import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { SanityClient } from "sanity";
import { articlePublishBlock, publishApprovedArticle, type PublishableArticle } from "../cms/sanity/policy/article-publication";
import {
  latestSitemapLastmod,
  normalizeSitemapLastmod,
  resolveContentLastmod,
  uniqueSortedSitemapEntries,
} from "../lib/sitemap/google";

test("normalizes supported W3C timestamps to one stable ISO representation", () => {
  assert.equal(
    normalizeSitemapLastmod("2026-09-02T14:00:00+07:00"),
    "2026-09-02T07:00:00.000Z",
  );
  assert.equal(normalizeSitemapLastmod("not-a-date"), undefined);
});

test("uses the explicit meaningful-content timestamp before migration or system timestamps", () => {
  assert.equal(
    resolveContentLastmod({
      contentUpdatedAt: "2026-09-02T10:00:00Z",
      sourceModifiedAt: "2026-08-11T13:46:39+07:00",
      systemUpdatedAt: "2026-09-03T10:00:00Z",
    }),
    "2026-09-02T10:00:00.000Z",
  );
  assert.equal(
    resolveContentLastmod({
      sourceModifiedAt: "2026-08-11T13:46:39+07:00",
      systemUpdatedAt: "2026-09-03T10:00:00Z",
    }),
    "2026-08-11T06:46:39.000Z",
  );
});

test("compares timestamps by time rather than timezone-formatted strings", () => {
  assert.equal(
    latestSitemapLastmod([
      "2026-09-02T10:00:00+07:00",
      "2026-09-02T04:00:00Z",
    ]),
    "2026-09-02T04:00:00.000Z",
  );
});

test("deduplicates canonical URLs and retains the newest valid lastmod", () => {
  assert.deepEqual(
    uniqueSortedSitemapEntries([
      { loc: "https://ccpun.com/blog/b/", lastmod: "2026-09-02T10:00:00+07:00" },
      { loc: "https://ccpun.com/blog/a/" },
      { loc: "https://ccpun.com/blog/b/", lastmod: "2026-09-02T04:00:00Z" },
    ]),
    [
      { loc: "https://ccpun.com/blog/a/" },
      { loc: "https://ccpun.com/blog/b/", lastmod: "2026-09-02T04:00:00.000Z" },
    ],
  );
});

const readSource = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("uses a lightweight published-only Sanity query for Google sitemap entries", () => {
  const source = readSource("lib/content/sitemap.ts");
  assert.match(source, /perspective:\s*"published"/);
  assert.match(source, /dateTime\(publishedAt\)\s*<=\s*dateTime\(now\(\)\)/);
  assert.match(source, /review\.status\s*==\s*"approved"/);
  assert.match(source, /coalesce\(seo\.noindex, false\)\s*==\s*false/);
  assert.doesNotMatch(source, /body\[\]|faq\[\]|featuredImage\.asset/);
});

test("protects Google publish eligibility and sets one meaningful publication timestamp", async () => {
  const action = readSource("cms/sanity/policy/article-publish-action.tsx");
  const config = readSource("sanity.config.ts");
  const schema = readSource("cms/sanity/schema/documents/article.ts");

  const now = "2026-09-09T12:00:00.000Z";
  const firstPublishedAt = "2024-01-01T00:00:00.000Z";
  const draft: PublishableArticle = {
    _id: "drafts.google-eligibility", _type: "article", _rev: "draft-revision",
    _createdAt: firstPublishedAt, _updatedAt: firstPublishedAt,
    review: { status: "approved" }, publishedAt: "2025-01-01T00:00:00.000Z",
  };
  const published = { ...draft, _id: "google-eligibility", _rev: "live-revision", publishedAt: firstPublishedAt };
  assert.equal(articlePublishBlock(draft, published, Date.parse(now)), null);
  assert.ok(articlePublishBlock({ ...draft, review: { status: "drafting" } }, published, Date.parse(now)));
  assert.ok(articlePublishBlock({ ...draft, publishedAt: "2030-01-01T00:00:00Z" }, null, Date.parse(now)));
  assert.ok(articlePublishBlock({ ...draft, publishedAt: "not-a-date" }, null, Date.parse(now)));
  let written: PublishableArticle | undefined;
  let committed = false;
  const transaction = {
    patch() { return transaction; },
    createOrReplace(document: PublishableArticle) { written = document; return transaction; },
    delete(id: string) { assert.equal(id, draft._id); return transaction; },
    async commit() { committed = true; return { transactionId: "test" }; },
  };
  await publishApprovedArticle({ transaction: () => transaction } as unknown as SanityClient, draft, published, now);
  assert.equal(committed, true);
  assert.equal(written?.publishedAt, firstPublishedAt);
  assert.equal(written?.contentUpdatedAt, now);
  assert.equal(resolveContentLastmod(written!), now);
  assert.equal(draft.contentUpdatedAt, undefined, "publication must not stamp a saved draft separately");
  assert.match(action, /articlePublishBlock\(draft, published\)/);
  assert.match(action, /await publishApprovedArticle\(client, draft, published\)/);
  assert.match(action, /schemaType !== "article"[\s\S]*action\.action === "publish"/);
  assert.match(config, /wrapGoogleSafeArticlePublishActions[\s\S]*protectProductionContentLifecycleActions/);
  assert.match(schema, /name:\s*"contentUpdatedAt"[\s\S]*readOnly:\s*true/);
});