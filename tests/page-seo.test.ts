import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, globSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { PAGE_SEO_PAGES, getPageSeoPage, pageSeoDocumentId, isPageSeoImageUrlAllowed, validatePageSeoFields } from "../lib/content/page-seo-registry";

const baselineHashes = {
  "lib/seo/root-metadata.ts": {
    "false": "5875f11d6039e5367fba129180daefac581468bc2f7eb9770629fb8ad0acc7a7",
    "true": "9573d0f4f86a36bcf4c1119b21139a8e523269268cc6fcfafa517ba5a95eb4ba"
  },
  "features/blog/pages/BlogArchivePage.tsx": {
    "false": "e787404a7dff8b6a0674ae31a048a830d76d7f5957c2a1e7c0f0485ebdb9e1ff",
    "true": "e787404a7dff8b6a0674ae31a048a830d76d7f5957c2a1e7c0f0485ebdb9e1ff"
  },
  "features/ci-planning/page.tsx": {
    "false": "4b1c1fa53d62e6f74a28a9419a02bcc3228b9f6532ca6ab28a4f241b254b4db0",
    "true": "b1d0351fde939bd500bb43657902ec075c112f5af67b59228e14fcceb4e1afd9"
  },
  "features/financial-health-check/page.tsx": {
    "false": "71f3fdf91d8e431e27b6f96cea9e30c25c786dd002042fc3dbea733a70502613",
    "true": "6399b2cb186fb7fa26b2b58beaaf6eeb2b6f6371e680262e954b35946eb300fd"
  },
  "features/money-story/page.tsx": {
    "false": "720fc53f0e281c75b9551fdf0871f3bd788104da8a01d12d75f859372f5dba78",
    "true": "d8335e6d35b48aa591a457869eec492f2872cd0985474f532049dc1e3c522712"
  },
  "features/investment-allocation/page.tsx": {
    "false": "ecd95896269b2e015975fb4ae33561947f604ba3701212bd998b2385d11f1463",
    "true": "5c35db3923f0269c8bd8911d642e1519035a8c56d65549c79cf28431765afc06"
  },
  "features/legal/pages/PrivacyPage.tsx": {
    "false": "1584613e6de3fe8043754e908e7426202d3277949ade7168c0f735083071d6c6",
    "true": "4732b9c364b4febe7e41af97e93d34c5cc38398873f25f0bd4d22b305247ad68"
  },
  "features/legal/pages/CookiePolicyPage.tsx": {
    "false": "5108add8d96e9afa7c2587058f47099baa4121b63838f4adb0c14acbb172af7c",
    "true": "5108add8d96e9afa7c2587058f47099baa4121b63838f4adb0c14acbb172af7c"
  }
};

function resolver(environment: string, data: unknown, fail = false) {
  let calls = 0;
  const requests: unknown[] = [];
  const code = stripTypeScriptTypes(readFileSync("lib/seo/page-seo.ts", "utf8"), { mode: "transform" }).replace(/^import [\s\S]*?;\n/gm, "").replace(/export /g, "");
  const api = runInNewContext(code + "\n({resolvePageSeoMetadata});", {
    URL, getPageSeoPage, validatePageSeoFields, resolveContentEnvironment: () => environment,
    sanityFetch: async (request: unknown) => { calls++; requests.push(request); if (fail) throw new Error("synthetic"); return { data }; },
  });
  return { resolve: api.resolvePageSeoMetadata, calls: () => calls, requests };
}

test("known static pages are wired once and original metadata defaults remain byte-equivalent in normal/review lanes", () => {
  assert.equal(PAGE_SEO_PAGES.length, 8);
  assert.equal(new Set(PAGE_SEO_PAGES.map(p => p.documentId)).size, 8);
  const staticRoutes = [...globSync("apps/web/app/**/page.tsx")].filter(p => !p.includes("[") && !p.includes("signature-article-preview") && !p.includes("uat-tax-article-component-review")).map(p => p.replace("apps/web/app", "").replace("page.tsx", ""));
  for (const path of ["signature-article-preview", "uat-tax-article-component-review"]) assert.match(readFileSync(`apps/web/app/blog/${path}/page.tsx`, "utf8"), /index:\s*false/);
  assert.deepEqual(staticRoutes.sort(), PAGE_SEO_PAGES.map(p => p.pathname).sort(), "new static pages need an explicit metadata owner, never automatic CMS exposure");
  for (const page of PAGE_SEO_PAGES) {
    assert.equal(pageSeoDocumentId(page.pathname), page.documentId);
    const path = "apps/web/app" + (page.pathname === "/" ? "/" : page.pathname) + "page.tsx";
    const route = readFileSync(path, "utf8");
    const owner = route.match(/export \{ default, generateMetadata \} from "@\/(features\/[^"]+)"/)?.[1];
    const source = owner ? readFileSync(owner + ".tsx", "utf8") : route;
    assert.ok(source.includes("generateMetadata"));
    assert.ok(source.includes(JSON.stringify(page.pathname)));
    assert.doesNotMatch(source, /export.*\{.*metadata[, }]/, "Next cannot export both static metadata and generateMetadata");
  }
  for (const [path, hashes] of Object.entries(baselineHashes)) {
    const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText.replace(/^import [\s\S]*?;\n/gm, "").replace(/export default /g, "").replace(/export /g, "");
    for (const review of [false, true]) {
      const value = runInNewContext(code + (path.endsWith("root-metadata.ts") ? "\nbuildSiteRootMetadata({admin:false,review:REVIEW});" : "\nmetadata;"), { URL, getPageSeoPage, IS_REVIEW_ENVIRONMENT: review, REVIEW: review, INVESTMENT_ALLOCATION_ENABLED: true, FHC_FAQS: [] });
      assert.equal(createHash("sha256").update(JSON.stringify(value)).digest("hex"), hashes[String(review) as keyof typeof hashes], path);
    }
  }
});

test("Production, Admin and unknown paths return exact defaults before CMS; missing/error/invalid UAT records fail back without touching robots/canonical", async () => {
  const defaults = { title: "Default", robots: { index: false, follow: true }, alternates: { canonical: "https://ccpun.com/cookie-policy/" } };
  for (const environment of ["production", "local-production", "production-admin", "admin-uat", "development", "unknown"]) {
    const api = resolver(environment, { _id: "pageSeo-home", pathname: "/", seoTitle: "Override" });
    assert.equal(await api.resolve("/", defaults), defaults);
    assert.equal(api.calls(), 0);
  }
  const unknown = resolver("web-uat", {});
  assert.equal(await unknown.resolve("/new-page/", defaults), defaults);
  assert.equal(unknown.calls(), 0);
  for (const data of [null, {}, { _id: "wrong", pathname: "/", seoTitle: "bad" }, { _id: "pageSeo-home", pathname: "/blog/", seoTitle: "bad" }, { _id: "pageSeo-home", pathname: "/", canonical: "https://evil.invalid/" }, { _id: "pageSeo-home", pathname: "/", robots: { index: true } }, { _id: "pageSeo-home", pathname: "/", seoTitle: "<script>" }, { _id: "pageSeo-home", pathname: "/", seoTitle: null }]) {
    const api = resolver("web-uat", data);
    assert.equal(await api.resolve("/", defaults), defaults);
  }
  assert.equal(await resolver("local-uat", null, true).resolve("/", defaults), defaults);
});

test("published UAT updates metadata only, merges native parent social fields, and reads again for subsequent saves", async () => {
  const defaults = { title: "Default", robots: { index: false, follow: true }, alternates: { canonical: "https://ccpun.com/" }, openGraph: { url: "https://ccpun.com/", title: "Default OG" } };
  const data = { _id: "pageSeo-home", pathname: "/", seoTitle: "New SEO", seoDescription: "New description", ogTitle: "New social", ogDescription: "New social description", ogImageUrl: "https://test.ccpun.com/assets/ccpun.webp" };
  const api = resolver("web-uat", data);
  const oldImage = { url: "https://ccpun.com/og-image-old.webp", width: 1200, height: 630, alt: "Default alt", type: "image/webp" };
  const parent = Promise.resolve({ openGraph: { type: "website", siteName: "CCPun", images: [oldImage, oldImage] }, twitter: { card: "summary_large_image", images: [oldImage.url] } });
  const value = await api.resolve("/", defaults, parent);
  assert.equal(value.title, "New SEO");
  assert.equal(value.description, "New description");
  assert.equal(value.openGraph.title, "New social");
  assert.equal(value.openGraph.description, "New social description");
  assert.equal(value.openGraph.url, defaults.openGraph.url);
  assert.equal(value.openGraph.images[0].url, data.ogImageUrl);
  assert.deepEqual(Object.keys(value.openGraph.images[0]), ["url"], "new assets cannot inherit unverified dimensions, alt text or MIME type");
  assert.equal(value.openGraph.images[1], oldImage);
  assert.equal(value.twitter.card, "summary_large_image");
  assert.equal(value.robots, defaults.robots);
  assert.equal(value.alternates, defaults.alternates);
  data.seoTitle = "Second save";
  assert.equal((await api.resolve("/", defaults, parent)).title, "Second save");
  assert.equal(api.calls(), 2);
  const sameImage = await resolver("web-uat", { ...data, ogImageUrl: oldImage.url }).resolve("/", defaults, parent);
  assert.equal(sameImage.openGraph.images[0].width, 1200);
  assert.equal(sameImage.openGraph.images[0].height, 630);
  assert.equal(sameImage.openGraph.images[0].alt, oldImage.alt);
  assert.equal(sameImage.openGraph.images[0].type, oldImage.type);
  const request = api.requests[0] as { query: string; params: { id: string; pathname: string }; perspective: string; stega: boolean };
  assert.equal(request.perspective, "published");
  assert.equal(request.stega, false);
  assert.equal(request.params.id, "pageSeo-home");
  assert.equal(request.params.pathname, "/");
  assert.match(request.query, /_id == \$id/);
  assert.match(request.query, /pathname == \$pathname/);
  const seoOnly = await resolver("web-uat", { _id: "pageSeo-home", pathname: "/", seoTitle: "SEO only" }).resolve("/", defaults);
  assert.equal(seoOnly.openGraph, defaults.openGraph);
});

test("shared field/image validation rejects unknown mutable safety fields and unsafe origins while null clears to defaults", () => {
  assert.equal(pageSeoDocumentId("/blog/example/"), null);
  assert.deepEqual(validatePageSeoFields({ seoTitle: "  Title  ", seoDescription: "" }), { seoTitle: "Title", seoDescription: null });
  for (const input of [{ canonical: "/" }, { robots: true }, { body: "x" }, { seoTitle: 4 }, { seoTitle: "x".repeat(121) }, { seoDescription: "x".repeat(321) }]) assert.throws(() => validatePageSeoFields(input));
  for (const url of ["https://ccpun.com/assets/photo.webp?v=1", "https://test.ccpun.com/og-image-new.png", "https://cdn.sanity.io/images/ccb9lnw5/uat/abc-1200x630.webp?w=1200&auto=format"]) assert.equal(isPageSeoImageUrlAllowed(url), true, url);
  for (const url of ["http://ccpun.com/assets/a.webp", "https://evil.invalid/a.webp", "https://ccpun.com:8443/assets/a.webp", "https://cdn.sanity.io:8443/images/ccb9lnw5/uat/a.webp", "https://cdn.sanity.io/images/kyfxgjnq/production/a.webp", "https://user:pass@ccpun.com/assets/a.webp", "https://ccpun.com/assets/a.webp#secret", "https://ccpun.com/api/private.webp", "https://ccpun.com/assets/a.webp?token=secret", "https://ccpun.com/assets/%2fapi/a.webp"]) assert.equal(isPageSeoImageUrlAllowed(url), false, url);
});
