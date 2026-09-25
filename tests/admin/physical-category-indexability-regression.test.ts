import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildCategoryRegistry,
  listPhysicalCategorySitemapEntries,
} from "../../lib/content/category-registry";
import { getBlogTopicHub } from "../../lib/content/taxonomy";

function source(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

test("active physical categories become sitemap-eligible from indexable content even when the semantic hub is gated", () => {
  const registry = buildCategoryRegistry([
    {
      _id: "ccpun-category-investment",
      title: "การลงทุน",
      slug: "investment",
      status: "active",
    },
  ]);

  assert.equal(getBlogTopicHub("investment")?.indexable, false);
  assert.deepEqual(
    listPhysicalCategorySitemapEntries(registry, [{ categorySlug: "investment" }]),
    [{ loc: "https://ccpun.com/blog/investment/" }],
  );
  assert.deepEqual(listPhysicalCategorySitemapEntries(registry, []), []);
});

test("physical category metadata and sitemap do not inherit semantic-hub indexability", () => {
  const categoryPage = source("features/blog/pages/BlogCategoryPage.tsx");
  const sitemap = source("app/sitemaps/blog.xml/route.ts");

  assert.match(
    categoryPage,
    /const shouldIndex = !includeDrafts\s*&& category\.status === "active"\s*&& relevantIndexableArticles\.length > 0;/,
  );
  assert.doesNotMatch(
    categoryPage,
    /category\.status === "active"[\s\S]{0,160}\(hub\?\.indexable \?\? true\)/,
  );

  const physicalStart = sitemap.indexOf("const physicalCategoryEntries");
  const semanticHubStart = sitemap.indexOf("const hubEntries");
  assert.ok(physicalStart >= 0 && semanticHubStart > physicalStart);
  const physicalBlock = sitemap.slice(physicalStart, semanticHubStart);

  assert.match(physicalBlock, /listPhysicalCategorySitemapEntries\(categoryRegistry, indexableArticles\)/);
  assert.doesNotMatch(physicalBlock, /hub\.indexable/);
});
