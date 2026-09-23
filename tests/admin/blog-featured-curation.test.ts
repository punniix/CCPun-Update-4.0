import assert from "node:assert/strict";
import test from "node:test";
import { curateFeaturedArticles } from "../../lib/content/featured-articles";
import type { Article } from "../../lib/content/types";

function article(id: string, publishedAt: string, status: Article["status"] = "published"): Article {
  return {
    id,
    slug: id,
    title: id,
    excerpt: id,
    category: "ทดสอบ",
    categorySlug: "test",
    authorName: "CCPun",
    status,
    publishedAt,
    updatedAt: publishedAt,
    seoTitle: id,
    seoDescription: id,
    body: [],
  };
}

test("manual featured order wins and latest published articles fill remaining slots without duplicates", () => {
  const candidates = [
    article("article-a", "2026-09-01T00:00:00Z"),
    article("article-b", "2026-09-03T00:00:00Z"),
    article("article-c", "2026-09-02T00:00:00Z"),
    article("article-d", "2026-09-04T00:00:00Z"),
    article("article-e", "2026-09-05T00:00:00Z"),
    article("article-f", "2026-09-06T00:00:00Z"),
    article("article-g", "2026-09-07T00:00:00Z"),
  ];

  const result = curateFeaturedArticles(candidates, ["article-c", "article-a", "article-c"]);

  assert.deepEqual(result.map(({ id }) => id), [
    "article-c",
    "article-a",
    "article-g",
    "article-f",
    "article-e",
    "article-d",
  ]);
});

test("manual references outside the candidate set or not published are ignored", () => {
  const candidates = [
    article("article-a", "2026-09-01T00:00:00Z"),
    article("article-b", "2026-09-03T00:00:00Z", "draft"),
    article("article-c", "2026-09-02T00:00:00Z"),
  ];

  const result = curateFeaturedArticles(candidates, ["article-b", "other-category", "article-a"]);

  assert.deepEqual(result.map(({ id }) => id), ["article-a", "article-c"]);
});

test("manual list can extend beyond the default count but is capped at eight", () => {
  const candidates = Array.from({ length: 10 }, (_, index) =>
    article(`article-${index + 1}`, `2026-09-${String(index + 1).padStart(2, "0")}T00:00:00Z`),
  );
  const manual = candidates.map(({ id }) => id);

  const result = curateFeaturedArticles(candidates, manual);

  assert.equal(result.length, 8);
  assert.deepEqual(result.map(({ id }) => id), manual.slice(0, 8));
});
