import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { buildPublishedArticleDocument, hasArticleContentChanges, type PublishableArticle } from "../cms/sanity/policy/article-publication";
import * as urls from "../lib/content/url";
import * as contract from "../lib/runtime/deployment-contract";
import * as identity from "../lib/runtime/deployment-identity";
import * as dates from "../lib/sitemap/google";
import * as xml from "../lib/sitemap/xml";

const require = createRequire(import.meta.url);
const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
// Execute the real route/query with bounded local dependencies; never contact Sanity or Cloudflare.
function load(path: string, imports: Record<string, unknown>, variables?: Record<string, string>) {
  const exports: Record<string, unknown> = {};
  const compiled = ts.transpileModule(source(path), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function("require", "exports", "process", compiled)((id: string) => Object.hasOwn(imports, id) ? imports[id] : require(id), exports, variables ? { env: variables } : process);
  return exports;
}

const first = "2025-01-01T00:00:00.000Z";
const previous = "2025-02-01T00:00:00.000Z";
const now = "2025-03-01T00:00:00.000Z";
const article = { id: "article", slug: "tax-guide", category: "การเงินส่วนบุคคล", categorySlug: "personal-finance", status: "published", publishedAt: first, updatedAt: previous };

function route(rows: unknown[] = [article], blocked = false, fail = false) {
  const calls: unknown[] = [];
  const loaded = load("apps/web/app/sitemaps/ai-search.xml/route.ts", {
    "@/lib/content/sitemap": { listSitemapArticles: async (options: unknown) => { calls.push(options); if (fail) throw new Error("private diagnostic"); return rows; } },
    "@/lib/content/url": urls,
    "@/lib/runtime/deployment-contract": contract,
    "@/lib/sitemap/google": dates,
    "@/lib/sitemap/xml": xml,
    "../../../runtime-environment": { shouldBlockWebIndexing: () => blocked },
  });
  return { calls, GET: loaded.GET as (request: Request) => Promise<Response> };
}
const request = (origin = "https://ccpun.com") => new Request(`${origin}/sitemaps/ai-search.xml`);

test("AI feed contains only home and eligible canonical articles, with fresh published-only reads", async () => {
  const loaded = route([
    article, { ...article, optimizedAt: now },
    ...[
      { id: "drafts.article" }, { id: "versions.release.article" }, { status: "draft" }, { noindex: true },
      { publishedAt: "2999-01-01" }, { optimizedAt: "2999-01-01" }, { optimizedAt: "invalid" },
      { canonical: "https://example.com/blog/personal-finance/tax-guide/" },
      { canonical: "https://ccpun.com/privacy/" }, { canonical: "https://ccpun.com/blog/?preview=1" },
      { canonical: "https://ccpun.com/research-preview/" },
      { canonical: "https://ccpun.com/investment-allocation/" },
    ].map((changes) => ({ ...article, ...changes })),
  ]);
  const response = await loaded.GET(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
  assert.match(response.headers.get("content-type")!, /application\/xml/);
  assert.deepEqual(loaded.calls, [{ includeDrafts: false, fresh: true }]);
  const body = await response.text();
  assert.equal((body.match(/<url>/g) || []).length, 2);
  assert.match(body, /<loc>https:\/\/ccpun.com\/<\/loc>/);
  assert.match(body, /<loc>https:\/\/ccpun.com\/blog\/personal-finance\/tax-guide\/<\/loc><lastmod>2025-03-01T00:00:00.000Z<\/lastmod>/);
  assert.doesNotMatch(body, /example|privacy|research|investment-allocation|drafts|versions|preview/);
});

test("private deployment requests fail closed before reading content, regardless of transport URL", async () => {
  for (const origin of ["https://ccpun.com", "https://test.ccpun.com", "https://admin.ccpun.com", "http://127.0.0.1:3000"]) {
    const loaded = route([article], true);
    const response = await loaded.GET(request(origin));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(loaded.calls.length, 0);
    assert.doesNotMatch(await response.text(), /<url>|tax-guide/);
  }
});

test("real Web indexing guard allows only the complete Production contract, never UAT or mixed lanes", async () => {
  const production = {
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "web", CCPUN_APP_ENV: "production",
    NEXT_PUBLIC_CCPUN_APP_ENV: "production", NEXT_PUBLIC_SANITY_PROJECT_ID: "kyfxgjnq",
    NEXT_PUBLIC_SANITY_DATASET: "production", CCPUN_UAT_MODE: "0", CCPUN_ENABLE_PRODUCTION_ANALYTICS: "1",
  };
  for (const changes of [null, { CCPUN_APP_ENV: "web-uat" }, { NEXT_PUBLIC_SANITY_DATASET: "uat" }, { CCPUN_UAT_MODE: "1" }, { CCPUN_DEPLOYMENT_ROLE: "admin" }, { CCPUN_DEPLOYMENT_PROVIDER: "unknown" }]) {
    const variables = { ...production, ...changes };
    const webConfig = load("lib/runtime/web-build-config.mjs", {}, variables);
    const runtime = load("apps/web/runtime-environment.ts", {
      "../../lib/runtime/web-build-config.mjs": webConfig,
      "../../lib/runtime/deployment-identity": identity,
      "../../lib/runtime/deployment-contract": contract,
      "../../lib/content/sanity-lane": {},
    }, variables);
    const blocked = (runtime.shouldBlockWebIndexing as () => boolean)();
    assert.equal(blocked, changes !== null);
    const loaded = route([article], blocked);
    // Hostinger rewrites the request URL to an internal HTTP origin; deployment policy owns eligibility.
    assert.equal((await loaded.GET(request("http://127.0.0.1:3000"))).status, changes === null ? 200 : 503);
    assert.equal(loaded.calls.length, changes === null ? 1 : 0);
  }
});

test("source failure stays no-store and returns no partial home-only feed or diagnostics", async () => {
  const response = await route([], false, true).GET(request());
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("retry-after"), "300");
  assert.doesNotMatch(await response.text(), /private diagnostic|<url>/);
});

const draft: PublishableArticle = {
  _id: "drafts.article", _type: "article", _rev: "draft-1", _createdAt: first, _updatedAt: first, title: "Original text",
  body: [{ _type: "block", children: [{ _type: "span", text: "Original body" }] }],
  review: { status: "approved" },
};
const live: PublishableArticle = { ...draft, _id: "article", _rev: "live-1", publishedAt: first, contentUpdatedAt: previous };
async function feedLastmod(document: PublishableArticle) {
  const response = await route([{ ...article, publishedAt: document.publishedAt, optimizedAt: document.contentOptimizedAt, updatedAt: document.contentUpdatedAt }]).GET(request());
  assert.equal(response.status, 200);
  return (await response.text()).match(/<lastmod>(.*?)<\/lastmod>/)?.[1];
}

test("first publication enters AI feed; explicitly approved text optimization advances AI lastmod", async () => {
  const published = buildPublishedArticleDocument(draft, null, now);
  assert.equal(published.contentOptimizedAt, undefined);
  assert.equal(await feedLastmod(published), now);
  const changed = { ...draft, title: "Updated text" };
  assert.equal(hasArticleContentChanges(changed, live), true);
  const optimized = buildPublishedArticleDocument(changed, live, now, true);
  assert.equal(optimized.publishedAt, first);
  assert.equal(optimized.contentOptimizedAt, now);
  assert.equal(await feedLastmod(optimized), now);
});

test("featured-image-only publication preserves prior/absent optimized date and AI lastmod, even with approval intent", async () => {
  for (const optimizedAt of [undefined, previous]) {
    for (const field of ["featuredImage", "migratedFeaturedImage"]) {
      const published = { ...live, ...(optimizedAt ? { contentOptimizedAt: optimizedAt } : {}) };
      const imageOnly = { ...draft, [field]: { asset: { _ref: "image-new-public-asset" } }, contentOptimizedAt: now };
      assert.equal(hasArticleContentChanges(imageOnly, published), false);
      const result = buildPublishedArticleDocument(imageOnly, published, now, true);
      assert.equal(result.contentOptimizedAt, optimizedAt);
      assert.equal(result.contentUpdatedAt, now, "existing broader Google/public content timestamp remains unchanged");
      assert.equal(result.publishedAt, first);
      assert.equal(await feedLastmod(result), optimizedAt ?? first);
    }
  }
});

test("existing lightweight sitemap query projects optimization separately; fresh option does not change Google read/cache defaults", async () => {
  const calls: unknown[][] = [];
  const row = { _id: "article", slug: article.slug, category: article.category, categorySlug: article.categorySlug, publishedAt: first, contentUpdatedAt: previous, contentOptimizedAt: now, systemUpdatedAt: now };
  const client = { withConfig: () => client, fetch: async (...args: unknown[]) => { calls.push(args); return [row]; } };
  const loaded = load("lib/content/sitemap.ts", {
    "server-only": {},
    "next-sanity": { createClient: () => client, groq: (strings: TemplateStringsArray) => strings.join("") },
    "@/lib/content/sanity-credentials": { getSanityReadToken: () => undefined },
    "@/lib/content/sanity-lane": { isContentSanityLaneAllowed: () => true },
    "@/lib/sitemap/google": dates,
    "@/lib/runtime/deployment-identity": { resolveDeploymentIdentity: () => ({ valid: true, role: "web", environment: "production" }) },
  }, { NEXT_PUBLIC_SANITY_PROJECT_ID: "kyfxgjnq", NEXT_PUBLIC_SANITY_DATASET: "production" });
  // Module configuration uses only these public, non-secret identifiers.
  assert.match(source("lib/content/sitemap.ts"), /contentOptimizedAt: z\.string\(\)\.nullish\(\)/);
  const list = loaded.listSitemapArticles as (options?: { includeDrafts: false; fresh?: boolean }) => Promise<Array<{ optimizedAt?: string; updatedAt: string }>>;
  const google = await list();
  const ai = await list({ includeDrafts: false, fresh: true });
  assert.equal(google[0].updatedAt, previous);
  assert.equal(ai[0].optimizedAt, now);
  assert.equal(ai[0].updatedAt, previous);
  assert.equal(calls[0][2], undefined);
  assert.deepEqual(calls[1][2], { cache: "no-store" });
  assert.match(source("lib/content/sitemap.ts"), /fetch\(sitemapArticleQuery, \{\}, options\.fresh \? \{ cache: "no-store" \} : undefined\)/);
  assert.match(source("lib/content/sitemap.ts"), /perspective: "published"/);
  assert.match(source("lib/content/sitemap.ts"), /review\.status == "approved"/);
  assert.match(source("lib/content/sitemap.ts"), /coalesce\(seo\.noindex, false\) == false/);
  assert.doesNotMatch(source("apps/web/app/sitemaps/blog.xml/route.ts"), /optimizedAt|fresh: true|ai-search/);
  assert.equal(xml.xmlResponse("test").headers.get("cache-control"), "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
});
