import { readPhase1Source } from "../../qa/read-phase1-source.mjs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

const schema = readCurrentSource(new URL("../../cms/sanity/schema/objects/seo-metadata.ts", import.meta.url), "utf8");
const sanityContent = readCurrentSource(new URL("../../lib/content/sanity.ts", import.meta.url), "utf8");
const articleType = readCurrentSource(new URL("../../lib/content/types.ts", import.meta.url), "utf8");
const articleRoute = readCurrentSource(new URL("../../features/blog/pages/ArticlePage.tsx", import.meta.url), "utf8");
const adminPage = readCurrentSource(new URL("../../app/(control-plane)/seo/audits/[id]/page.tsx", import.meta.url), "utf8");

test("SEO governance includes keyword cluster and dedicated social fields", () => {
  for (const field of ["keywordCluster", "ogTitle", "ogDescription", "ogImage"]) {
    assert.match(schema, new RegExp(`name: "${field}"`));
  }
});

test("public social metadata keeps current SEO and featured-image fallbacks", () => {
  assert.match(articleType, /ogTitle\?: string/);
  assert.match(articleType, /ogDescription\?: string/);
  assert.match(sanityContent, /ogTitle: raw\.seo\?\.ogTitle/);
  assert.match(articleRoute, /title: article\.ogTitle \|\| article\.seoTitle/);
  assert.match(articleRoute, /description: article\.ogDescription \|\| article\.seoDescription/);
  assert.match(articleRoute, /article\.ogImage\?\.src \?\? article\.featuredImage\?\.src \?\? DEFAULT_SOCIAL_IMAGE/);
});

test("Admin renders separate SERP and social previews without changing URLs", () => {
  assert.match(adminPage, /ตัวอย่างผลค้นหา/);
  assert.match(adminPage, /ตัวอย่างแชร์ Social/);
  assert.match(adminPage, /getArticleCanonical|canonical/);
  assert.doesNotMatch(adminPage, /redirect|permanentRedirect/);
});

function readCurrentSource(file: string | URL, _encoding: "utf8"): string {
  return readPhase1Source(file instanceof URL ? relative(process.cwd(), fileURLToPath(file)) : file);
}
