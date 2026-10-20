import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { SanityClient } from "sanity";
import { articlePublishBlock, buildPublishedArticleDocument, hasMeaningfulArticleContentChange, publishApprovedArticle, type PublishableArticle } from "../cms/sanity/policy/article-publication";
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
    category: { _type: "reference", _ref: "category-google" },
  };
  const published = { ...draft, _id: "google-eligibility", _rev: "live-revision", publishedAt: firstPublishedAt, title: "Existing live article" };
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


for (const appRoot of ["", "apps/web/"]) test(`keeps ${appRoot || "legacy "}utility compliance and private error surfaces out of search ownership`, () => {
  const coreWrapper = readSource(appRoot + "app/sitemaps/core.xml/route.ts");
  const coreSitemap = readSource("lib/sitemap/routes/core.ts");
  assert.match(coreWrapper, /export \{ GET \} from ["']@\/lib\/sitemap\/routes\/core["']/);
  const cookieRoute = readSource(`${appRoot}app/cookie-policy/page.tsx`);
  assert.match(cookieRoute, /export \{ metadata, default \} from ["']@\/features\/legal\/pages\/CookiePolicyPage["']/);
  const cookiePolicy = readSource("features/legal/pages/CookiePolicyPage.tsx");
  const robotsSource = readSource(`${appRoot}app/robots.ts`);
  const nextConfig = readSource(`${appRoot}next.config.ts`);

  assert.match(coreSitemap, /https:\/\/ccpun\.com\/privacy\//);
  assert.doesNotMatch(coreSitemap, /cookie-policy/);
  assert.match(cookiePolicy, /robots:\s*\{\s*index:\s*false,\s*follow:\s*true\s*\}/);
  assert.match(robotsSource, /["']\/admin-not-found\/["']/);
  assert.match(nextConfig, /["']\/admin-not-found\/:path\*["']/);
  if (appRoot) {
    assert.match(nextConfig, /source:\s*["']\/admin-not-found\/:path\*["'][\s\S]{0,120}X-Robots-Tag[\s\S]{0,60}noindex, nofollow, noarchive/);
    assert.match(readSource("apps/admin/next.config.ts"), /source:\s*["']\/:path\(\(\?!studio[\s\S]{0,220}PRIVATE_SURFACE_ROBOTS_HEADERS/);
  }
});


test("active Web core sitemap and private error headers enforce the search boundary", async () => {
  const { GET } = await import("../apps/web/app/sitemaps/core.xml/route");
  const { default: webConfig } = await import("../apps/web/next.config");
  const xml = await GET().text();
  assert.match(xml, /https:\/\/ccpun\.com\/privacy\//);
  assert.doesNotMatch(xml, /cookie-policy/);
  const headers = await webConfig.headers!();
  assert.deepEqual(headers.find((rule) => rule.source === "/admin-not-found/:path*")?.headers, [
    { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  ]);
});


test("preserves static sitemap XML responses for legacy and canonical Web routes", async () => {
  const routeSpecs = [
    ["sitemap.xml/route", ["https://ccpun.com/sitemaps/core.xml", "https://ccpun.com/sitemaps/tools.xml", "https://ccpun.com/sitemaps/blog.xml"]],
    ["sitemaps/core.xml/route", ["https://ccpun.com/", "https://ccpun.com/privacy/"]],
    ["sitemaps/tools.xml/route", ["https://ccpun.com/ci-planning/", "https://ccpun.com/tools/financial-health-check/"]],
  ] as const;
  const legacyIndex = await import("../app/sitemap.xml/route");
  const webIndex = await import("../apps/web/app/sitemap.xml/route");
  const legacyCore = await import("../app/sitemaps/core.xml/route");
  const webCore = await import("../apps/web/app/sitemaps/core.xml/route");
  const legacyTools = await import("../app/sitemaps/tools.xml/route");
  const webTools = await import("../apps/web/app/sitemaps/tools.xml/route");
  const handlers = [[legacyIndex, webIndex], [legacyCore, webCore], [legacyTools, webTools]];
  for (let index = 0; index < routeSpecs.length; index++) {
    const [path, urls] = routeSpecs[index];
    const [legacy, web] = handlers[index];
    const [legacyResponse, webResponse] = [legacy.GET(), web.GET()];
    assert.equal(legacyResponse.headers.get("content-type"), webResponse.headers.get("content-type"), path);
    const legacyXml = await legacyResponse.text();
    const webXml = await webResponse.text();
    assert.equal(legacyXml, webXml, path + " legacy and canonical output diverged");
    for (const url of urls) assert.ok(webXml.includes(url), path + " missing " + url);
    assert.doesNotMatch(webXml, /https:\/\/admin\.ccpun\.com/);
  }
});

test("new draft, first publish, live optimization and internal-only change keep distinct freshness dates", () => {
  const now = "2026-10-20T02:32:45.000Z";
  const first = "2026-09-22T15:05:24.694Z";
  const previousChange = "2026-10-01T15:50:57.639Z";
  const base = {
    _type: "article", _createdAt: first, _updatedAt: first, _rev: "draft-123",
    slug: { current: "tax-deduction" }, category: { _type: "reference", _ref: "personal-finance" },
    title: "Tax 2569", body: [{ _key: "intro", _type: "block", children: [{ _key: "span", text: "Old" }] }],
    faq: [{ _key: "faq1", question: "Question", answer: "Answer" }],
    review: { status: "approved", notes: "internal" },
  } as unknown as PublishableArticle;
  const draft = { ...base, _id: "drafts.tax-deduction" };
  const live = { ...base, _id: "tax-deduction", publishedAt: first, contentUpdatedAt: previousChange };

  // A saved draft must not modify Live. First publish gets both dates.
  const firstPublish = buildPublishedArticleDocument(draft, null, now);
  assert.equal(firstPublish.publishedAt, now);
  assert.equal(firstPublish.contentUpdatedAt, now);

  // A meaningful optimization preserves the original publication date.
  const optimized = { ...draft, body: [{ _type: "block", _key: "new-intro", children: [{ _key: "span-2", text: "New" }] }] };
  assert.equal(hasMeaningfulArticleContentChange(optimized, live), true);
  const changed = buildPublishedArticleDocument(optimized, live, now);
  assert.equal(changed.publishedAt, first);
  assert.equal(changed.contentUpdatedAt, now);

  // Review notes and generated Portable Text keys do not count as updates.
  const notesOnly = {
    ...draft,
    review: { status: "approved", notes: "new internal note" },
    seo: { auditSnapshot: { score: 100 } },
    body: [{ _key: "fresh-key", _type: "block", children: [{ _key: "fresh-span", text: "Old" }] }],
  } as unknown as PublishableArticle;
  assert.equal(hasMeaningfulArticleContentChange(notesOnly, live), false);
  assert.equal(hasMeaningfulArticleContentChange({
    ...notesOnly, seo: { noindex: false, auditSnapshot: { score: 88 } },
  }, live), false, "normalized noindex false and internal SEO audit do not change the public page");
  const unchanged = buildPublishedArticleDocument(notesOnly, live, now);
  assert.equal(unchanged.publishedAt, first);
  assert.equal(unchanged.contentUpdatedAt, previousChange);

  // Public SEO title and FAQ changes are meaningful, regardless of review notes.
  assert.equal(hasMeaningfulArticleContentChange({ ...draft, seo: { title: "Updated SEO" } }, live), true);
  assert.equal(hasMeaningfulArticleContentChange({ ...draft, faq: [{ question: "New question", answer: "Answer" }] }, live), true);
});

test("public content reads bypass Sanity CDN and Next.js persistent fetch cache", () => {
  const fetchSource = readSource("lib/content/sanity-fetch.ts");
  assert.match(fetchSource, /useCdn:\s*false/);
  assert.match(fetchSource, /cache:\s*"no-store"/);
});
