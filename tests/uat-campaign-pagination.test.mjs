import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";

const raw = readFileSync("components/ui/health-happy/availability.ts", "utf8");
const executable = stripTypeScriptTypes(raw).replace(/^import .*;\n/gm, "").replace(/export /g, "");
function campaign(lane, article, path = "/blog/health-insurance/aia-health-happy-describe/", fail = false) {
  let reads = 0;
  const available = runInNewContext(executable + "\nisHealthHappyCampaignAvailable;", {
    resolveContentEnvironment: () => lane, getArticlePath: () => path,
    getContentProvider: () => ({ getArticleBySlug: async (slug, options) => {
      reads++;
      assert.equal(slug, "aia-health-happy-describe");
      assert.equal(options.includeDrafts, false);
      if (fail) throw new Error("unavailable");
      return article;
    } }),
  });
  return { available, reads: () => reads };
}
test("UAT hides campaign for missing, Draft, wrong-path or unavailable content; Production stays unchanged", async () => {
  for (const lane of ["web-uat", "admin-uat", "local-uat"]) {
    for (const article of [null, { status: "draft" }]) assert.equal(await campaign(lane, article).available(), false);
    assert.equal(await campaign(lane, { status: "published" }, "/wrong/").available(), false);
    assert.equal(await campaign(lane, null, undefined, true).available(), false);
    assert.equal(await campaign(lane, { status: "published" }).available(), true);
  }
  const production = campaign("production", null);
  assert.equal(await production.available(), true);
  assert.equal(production.reads(), 0);
});
test("Blog uses ten articles per page and retains bounds and query filters", async () => {
  const { BLOG_PAGE_SIZE, blogPage, blogPageHref } = await import("../features/blog/website-43/BlogNavigation.ts");
  assert.equal(BLOG_PAGE_SIZE, 10);
  assert.deepEqual(blogPage("2", 21), { page: 2, pages: 3 });
  assert.deepEqual(blogPage("99", 21), { page: 3, pages: 3 });
  assert.deepEqual(blogPage("NaN", 0), { page: 1, pages: 1 });
  assert.equal(blogPageHref("/blog/?q=tax&page=2", 3), "/blog/?q=tax&page=3");
});

test("CMS date-prefix edits preserve the date and physical article URL", async () => {
  const { toWebsite43ArticleItem } = await import("../features/blog/website-43/blogData.ts");
  const article = { id: "fixture", slug: "copy-date-check", title: "Fixture", excerpt: "Fixture", category: "การเงินส่วนบุคคล", categorySlug: "personal-finance", authorName: "Test", status: "published", publishedAt: "2026-10-23T00:00:00Z", updatedAt: "2026-10-23T00:00:00Z", seoTitle: "Fixture", seoDescription: "Fixture", body: [] };
  const item = toWebsite43ArticleItem(article, { "blog.date.published": "Published test" });
  assert.ok(item.meta.startsWith("Published test "));
  assert.equal(item.href, "/blog/personal-finance/copy-date-check/");
  assert.equal(item.publishedAt, article.publishedAt);
});
