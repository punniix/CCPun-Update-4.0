import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { verifyPublishedArticleSeo } from "../../lib/admin/seo-intelligence/post-publish";

const read = (path: string) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const articleUrl = "https://ccpun.com/blog/personal-finance/example/";
const sitemapUrl = "https://ccpun.com/sitemaps/blog.xml";

test("post-publish verification requires live 200, indexable HTML, canonical parity and sitemap membership", async () => {
  const lastmod = "2026-10-05T01:02:03.000Z";
  const fetcher = async (input: string | URL | Request) => {
    const url = String(input);
    if (url === articleUrl) return new Response(`<html><head><link rel="canonical" href="${articleUrl}"><meta name="robots" content="index,follow"></head></html>`, { status: 200 });
    if (url === sitemapUrl) return new Response(`<urlset><url><loc>${articleUrl}</loc><lastmod>${lastmod}</lastmod></url></urlset>`, { status: 200 });
    return new Response("not found", { status: 404 });
  };
  const result = await verifyPublishedArticleSeo({ articleId: "article.example", url: articleUrl, expectedLastmod: lastmod, fetcher });
  assert.equal(result.live.state, "pass");
  assert.equal(result.indexability.state, "pass");
  assert.equal(result.canonical.state, "pass");
  assert.equal(result.sitemap.state, "pass");
  assert.equal(result.discovery.state, "sitemap-visible");
  assert.equal(result.discovery.directIndexRequestSent, false);
});

test("post-publish verification fails closed on noindex or canonical mismatch", async () => {
  const fetcher = async (input: string | URL | Request) => {
    const url = String(input);
    if (url === articleUrl) return new Response(`<html><head><link rel="canonical" href="https://ccpun.com/wrong/"><meta name="robots" content="noindex"></head></html>`, { status: 200 });
    return new Response(`<urlset></urlset>`, { status: 200 });
  };
  const result = await verifyPublishedArticleSeo({ articleId: "article.example", url: articleUrl, expectedLastmod: null, fetcher });
  assert.equal(result.indexability.state, "fail");
  assert.equal(result.canonical.state, "fail");
  assert.equal(result.sitemap.state, "fail");
});

test("Search Console integration uses supported sitemap submission and observation-only URL Inspection", () => {
  const provider = read("lib/admin/seo-intelligence/providers/gsc.ts");
  assert.match(provider, /searchconsole\.googleapis\.com\/v1\/urlInspection\/index:inspect/);
  assert.match(provider, /method: "PUT"/);
  assert.match(provider, /\/sitemaps\/\$\{encodeURIComponent\(input\.sitemapUrl\)\}/);
  assert.match(provider, /does not request indexing/);
  assert.doesNotMatch(provider, /indexing\.googleapis\.com|urlNotifications:publish/);
});

test("owner publish queues the supported discovery pipeline without using the generic Indexing API", () => {
  const action = read("cms/sanity/policy/article-publish-action.tsx");
  const route = read("apps/admin/app/api/admin/seo/post-publish/route.ts");
  const provider = read("lib/admin/seo-intelligence/providers/gsc.ts");
  const runner = read("lib/admin/seo-intelligence/post-publish-runner.ts");
  assert.match(action, /publishApprovedArticle[\s\S]*\/api\/admin\/seo\/post-publish\//);
  assert.match(route, /identity\.role !== "owner"/);
  assert.match(route, /isPostPublishAdminOriginAllowed/);
  const originPolicy = read("lib/admin/seo-intelligence/post-publish-origin.ts");
  assert.match(originPolicy, /isSameOriginAdminMutation/);
  assert.match(originPolicy, /x-forwarded-host/);
  assert.match(route, /getAdminEnvironment\(\) !== "production-admin"/);
  assert.match(route, /enqueuePublishedSeoArticle/);
  assert.doesNotMatch(route, /after\(async \(\) =>/);
  assert.match(route, /queue-unavailable/);
  assert.match(runner, /submitGscSitemap/);
  assert.match(runner, /inspectGscIndexedUrl/);
  for (const source of [action, route, provider, runner]) {
    assert.doesNotMatch(source, /indexing\.googleapis\.com|urlNotifications:publish/);
  }
});
