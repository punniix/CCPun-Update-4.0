import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync(new URL("../../cms/sanity/schema/objects/seo-metadata.ts", import.meta.url), "utf8");
const sanityContent = readFileSync(new URL("../../lib/content/sanity.ts", import.meta.url), "utf8");
const articleType = readFileSync(new URL("../../lib/content/types.ts", import.meta.url), "utf8");
const articleRoute = readFileSync(new URL("../../features/blog/pages/ArticlePage.tsx", import.meta.url), "utf8");
const articleMetadata = readFileSync(new URL("../../lib/content/article-metadata.ts", import.meta.url), "utf8");
const adminPage = readFileSync(new URL("../../app/snt-admin/(protected)/seo/[id]/page.tsx", import.meta.url), "utf8");

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
  assert.match(articleMetadata, /title: article\.ogTitle \|\| article\.seoTitle/);
  assert.match(articleMetadata, /description: article\.ogDescription \|\| article\.seoDescription/);
  assert.match(articleMetadata, /article\.ogImage\?\.src \?\? article\.featuredImage\?\.src \?\? DEFAULT_SOCIAL_IMAGE/);
});

test("Admin renders separate SERP and social previews without changing URLs", () => {
  assert.match(adminPage, /ตัวอย่างผลค้นหา/);
  assert.match(adminPage, /ตัวอย่างแชร์ Social/);
  assert.match(adminPage, /getArticleCanonical|canonical/);
  assert.doesNotMatch(adminPage, /redirect|permanentRedirect/);
});
