import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("draft preview uses preview-only category routing without widening public taxonomy", () => {
  const route = read("app/api/admin/content/[id]/preview/route.ts");
  const page = read("features/blog/pages/ArticlePage.tsx");
  const url = read("lib/content/url.ts");
  assert.match(route, /getArticlePreviewCategorySlug/);
  assert.match(page, /includeDrafts \? getArticlePreviewCategorySlug\(article\) : getArticleCategorySlug\(article\)/);
  assert.match(page, /includeDrafts\) redirect\(getArticlePreviewPath\(article\)\)/);
  assert.match(url, /PREVIEW_CATEGORY_SEGMENT/);
  assert.match(url, /Unsupported article preview category/);
  assert.match(url, /Unsupported article category/);
});

test("Article Scheduler read model verifies immutable identity and is read-only", () => {
  const source = read("lib/admin/operations/article-scheduler-read-model.ts");
  assert.match(source, /ARTICLE_SCHEDULER_CHECKSUM/);
  assert.match(source, /SCHEDULER_ROLE/);
  assert.match(source, /article_scheduler_identity/);
  assert.match(source, /article_schedule_audit/);
  assert.match(source, /durableEnabled/);
  assert.match(source, /effectiveEnabled/);
  assert.doesNotMatch(source, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP)\b/i);
});

test("Content Calendar reads durable scheduler records instead of showing a placeholder", () => {
  const source = read("app/(control-plane)/content/calendar/page.tsx");
  assert.match(source, /readArticleSchedulerModel/);
  assert.match(source, /Durable switch/);
  assert.match(source, /healthy zero/);
  assert.doesNotMatch(source, /AdminCapabilityState/);
});

test("Health separates runtime and durable Article Scheduler switches", () => {
  const source = read("app/(control-plane)/operations/health/page.tsx");
  assert.match(source, /Runtime switch/);
  assert.match(source, /Durable Neon switch/);
  assert.match(source, /Effective scheduling/);
  assert.match(source, /scheduler\.effectiveEnabled/);
});

test("Audit page exposes Scheduler transitions plus links to operational logs", () => {
  const source = read("app/(control-plane)/operations/audit-log/page.tsx");
  assert.match(source, /Article Scheduler log/);
  assert.match(source, /article_schedule_audit/);
  assert.match(source, /\/operations\/jobs\//);
  assert.match(source, /\/operations\/deployments\//);
  assert.match(source, /\/content\/calendar\//);
});
