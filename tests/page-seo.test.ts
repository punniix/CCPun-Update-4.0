import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, globSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { PAGE_SEO_PAGES, getPageSeoPage, pageSeoDocumentId, isPageSeoImageUrlAllowed, validatePageSeoFields } from "../lib/content/page-seo-registry";

test("reviewed registry extraction recovers the original Root metadata owner and rejects unrelated source/default changes", () => {
  const proof = readFileSync("qa/phase1-source-proof.mjs", "utf8").replace(/^import .*;\n/gm, "").replace(/^const read = .*;\n/m, "").replace(/export /g, "");
  const { pageSeoRootMetadataBaseline } = runInNewContext(proof + "\n({pageSeoRootMetadataBaseline});", { assert, createHash });
  const source = readFileSync("lib/seo/root-metadata.ts", "utf8");
  const registry = readFileSync("lib/content/page-seo-registry.ts", "utf8");
  assert.equal(createHash("sha256").update(pageSeoRootMetadataBaseline(source, registry)).digest("hex"), "2983a29ac19e21bab33d4faa9d9245a3643fa6fdbbd08821463e67233fdee874");
  for (const changed of [source.replace("index: false", "index: true"), source.replace("width: 1200", "width: 800"), source.replace("PAGE_SEO_DEFAULTS.seoTitle!", '"changed"')]) {
    assert.notEqual(changed, source);
    assert.throws(() => pageSeoRootMetadataBaseline(changed, registry));
  }
  assert.throws(() => pageSeoRootMetadataBaseline(source, registry.replace('"documentId": "pageSeo-home"', '"documentId": "pageSeo.other"')));
});

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
  assert.deepEqual(PAGE_SEO_PAGES.map(p => p.documentId), ['pageSeo-home', 'pageSeo-blog', 'pageSeo-ci-planning', 'pageSeo-financial-health-check', 'pageSeo-money-story', 'pageSeo-investment-allocation', 'pageSeo-privacy', 'pageSeo-cookie-policy']);
  for (const page of PAGE_SEO_PAGES) assert.match(page.documentId, /^pageSeo-[a-z0-9-]+$/, 'public SEO singleton IDs must not select protected dotted namespaces');
  const staticRoutes = [...globSync("apps/web/app/**/page.tsx")].filter(p => !p.includes("[")).map(p => p.replace("apps/web/app", "").replace("page.tsx", ""));
  assert.deepEqual(staticRoutes.sort(), PAGE_SEO_PAGES.map(p => p.pathname).sort(), "new static pages need an explicit metadata owner, never automatic CMS exposure");
  for (const page of PAGE_SEO_PAGES) {
    assert.equal(pageSeoDocumentId(page.pathname), page.documentId);
    const path = "apps/web/app" + (page.pathname === "/" ? "/" : page.pathname) + "page.tsx";
    const source = readFileSync(path, "utf8");
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
  for (const id of ['pageSeo.home', 'admin.operational-synthetic', 'drafts.pageSeo-home']) {
    assert.equal(await resolver("web-uat", { _id: id, pathname: "/", seoTitle: "Protected synthetic record" }).resolve("/", defaults), defaults);
  }
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

test("seven existing Root aliases follow the native metadata owner without rewriting frozen history or the retained Admin Blog", () => {
  const proof = JSON.parse(readFileSync("qa/page-seo-compat-owners.json", "utf8")) as {
    baseline: string; pairs: Array<{ legacy: string; canonical: string; beforeSha256: string; beforeSource: string; wrapper: string; status: string }>;
    adminMirror: { legacy: string; canonical: string; sha256: string; source: string; feature: string };
  };
  const expectedBefore: Record<string, string> = {
  "app/page.tsx": "814c4f422df23d52812e47838606bfd339417cf7e80ead1854af453e8c8cfec9",
  "app/blog/page.tsx": "29a233316183374446d117aeb0d9fc9ccba52d43055e5552e4f3f80ec550f5ce",
  "app/ci-planning/page.tsx": "1bcec72d36fbf2cb3239620f21399ca9192eb259043f8f175bfeaec3a4868048",
  "app/tools/financial-health-check/page.tsx": "3e572c982951b4ecea1e5d0786841ff28535f80cfccacb7907de290fd452e396",
  "app/play/money-story/page.tsx": "82d0e4b963086b418224683ae699f51b6b1604e6969f01c297e0b8b521e1f00f",
  "app/privacy/page.tsx": "3b5d431637f269a409327d38e6d9cb9f2d8af255d7cbf24cab9ba78e35fe421d",
  "app/cookie-policy/page.tsx": "44b8f8a62b3f3e8fe363dd5ed38bfe8ef3aa7c1490fa5626616272f3ca72c2f7"
};
  assert.equal(proof.baseline, "7148dcdf3283a079a5f9bdc929867ea0ba7312d6");
  assert.deepEqual(Object.keys(proof).sort(), ["baseline", "pairs", "adminMirror"].sort());
  assert.deepEqual(proof.pairs.map(p => p.legacy).sort(), Object.keys(expectedBefore).sort());
  const historical = JSON.parse(readFileSync("qa/root-runtime-owner-migration.json", "utf8")) as { pairs: Array<{ legacy: string }> };
  assert.equal(historical.pairs.length, 73);
  assert.equal(new Set([...historical.pairs, ...proof.pairs].map(p => p.legacy)).size, 79);
  for (const [path, hash] of Object.entries({
  "qa/root-runtime-owner-migration.json": "50c719a6a4705fd4b33f2c16cd75f5e293aaab5a1f481de00379a3bb289dba62",
  "qa/p2-source-mirror-inventory.json": "4fd2d4c59512b4c9af978d09b97d4fd235b02910a8d55b2a114e0b0c73de0aed",
  "qa/monorepo-compatibility-mirrors.json": "2360f9c49e4d62a0fa77218fe81a8040f54327188157ea0cc4b6873685ebfae1"
})) assert.equal(createHash("sha256").update(readFileSync(path)).digest("hex"), hash, "historical evidence cannot be resealed");
  for (const owner of proof.pairs) {
    assert.deepEqual(Object.keys(owner).sort(), ["legacy", "canonical", "beforeSha256", "beforeSource", "wrapper", "status"].sort());
    assert.equal(owner.canonical, "apps/web/" + owner.legacy);
    assert.equal(owner.status, "migrated");
    assert.equal(owner.beforeSha256, expectedBefore[owner.legacy]);
    assert.equal(createHash("sha256").update(owner.beforeSource).digest("hex"), owner.beforeSha256);
    assert.equal(owner.wrapper, `export { default, generateMetadata } from "@/${owner.canonical.replace(/\.tsx$/, "")}";\n`);
    assert.equal(readFileSync(owner.legacy, "utf8"), owner.wrapper);
    const native = readFileSync(owner.canonical, "utf8");
    assert.match(native, /export function generateMetadata/);
    assert.ok(native.includes("resolvePageSeoMetadata"));
  }
  const retained = proof.adminMirror;
  assert.equal(retained.legacy, "app/blog/page.tsx");
  assert.equal(retained.canonical, "apps/admin/app/blog/page.tsx");
  assert.equal(retained.feature, "@/features/blog/pages/BlogArchivePage");
  assert.equal(retained.sha256, expectedBefore[retained.legacy]);
  const admin = readFileSync(retained.canonical, "utf8");
  assert.equal(createHash("sha256").update(admin).digest("hex"), retained.sha256);
  assert.equal(admin, `export { metadata, default } from "${retained.feature}";\n`);
  const native = readFileSync("apps/web/app/blog/page.tsx", "utf8");
  assert.ok(native.includes(`import { metadata as defaults } from "${retained.feature}";`));
  assert.ok(native.includes(`export { default } from "${retained.feature}";`));
});
