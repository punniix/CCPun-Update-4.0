import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  lineCardDescriptionOutputSchema,
  parseLocalAiTaskResult,
} from "../../lib/local-ai/contracts";
import {
  buildLineArticleFlexMessage,
  type LineArticleCardSource,
} from "../../lib/line/content-cards";
import { resolveLocalAiInferenceContract } from "../../workers/local-ai/src/index";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const source = {
  id: "article-health-1",
  revision: "rev-123",
  slug: "health-planning",
  title: "วางแผนประกันสุขภาพให้เหมาะกับครอบครัว",
  category: "ประกันสุขภาพ",
} as const;

const input = {
  locale: "th-TH",
  mode: "line-card-description",
  title: source.title,
  body: "อธิบายวิธีพิจารณาวงเงิน ความคุ้มครอง และงบประมาณจากข้อมูลในกรมธรรม์",
  allowedCategories: [source.category],
  source,
} as const;

const output = {
  mode: "line-card-description",
  source,
  lineTitle: "มีประกันสุขภาพแล้ว ควรเช็กวงเงินตรงไหนอีก?",
  lineDescription: "ดูวิธีเทียบวงเงิน ความคุ้มครอง และงบประมาณ เพื่อเห็นจุดที่ควรทบทวนก่อนตัดสินใจ",
  reviewRequired: true,
} as const;

test("line-card mode preserves exact Sanity identity and rejects unsafe output", () => {
  assert.equal(parseLocalAiTaskResult("content-operations", input, output).success, true);
  assert.equal(parseLocalAiTaskResult("content-operations", input, {
    ...output,
    source: { ...source, revision: "different-revision" },
  }).success, false);
  assert.equal(parseLocalAiTaskResult("content-operations", input, {
    ...output,
    lineTitle: "สั้น",
  }).success, false);
  assert.equal(parseLocalAiTaskResult("content-operations", input, {
    ...output,
    lineDescription: "สั้นเกินไป",
  }).success, false);
  assert.equal(parseLocalAiTaskResult("content-operations", input, {
    ...output,
    lineDescription: "รับประกันผลตอบแทนและไม่มีความเสี่ยง พร้อมอ่านข้อมูลสำคัญที่ควรรู้ก่อนตัดสินใจได้ทันที",
  }).success, false);
  assert.equal(parseLocalAiTaskResult("content-operations", input, {
    ...output,
    lineDescription: "อ่านหลักการวางแผนฉบับย่อแล้วติดต่อ 0812345678 เพื่อสอบถามข้อมูลเพิ่มเติมจากทีมงาน",
  }).success, false);
});

test("worker selects the narrow line-card schema without changing legacy content operations", () => {
  assert.equal(resolveLocalAiInferenceContract("content-operations", input).outputSchema, lineCardDescriptionOutputSchema);
  assert.notEqual(resolveLocalAiInferenceContract("content-operations", {
    locale: "th-TH",
    title: "หัวข้อเดิม",
    body: "เนื้อหาเดิม",
    allowedCategories: ["ประกันสุขภาพ"],
  }).outputSchema, lineCardDescriptionOutputSchema);
});

test("LINE card prefers the dedicated description and stays compact", () => {
  const article: LineArticleCardSource = {
    slug: "health-planning",
    title: source.title,
    excerpt: "ข้อความ excerpt ที่ไม่ควรถูกเลือกเมื่อมีคำอธิบาย LINE",
    lineTitle: output.lineTitle,
    lineDescription: output.lineDescription,
    category: "ประกันสุขภาพ",
    categorySlug: "health-insurance",
    status: "published",
    noindex: false,
    featuredImage: { src: "https://cdn.sanity.io/article.jpg", alt: "ภาพ", width: 1200, height: 630 },
  };
  const serialized = JSON.stringify(buildLineArticleFlexMessage("life_health_policy_review", [article], {
    maxCards: 1,
    items: [{ slug: article.slug, enabled: true }],
  }));
  assert.match(serialized, new RegExp(output.lineTitle));
  assert.match(serialized, new RegExp(output.lineDescription));
  assert.doesNotMatch(serialized, /ข้อความ excerpt/);
  assert.match(serialized, /"size":"kilo"/);
  assert.match(serialized, /"aspectRatio":"1\.91:1"/);
  assert.equal((serialized.match(/"maxLines":2/g) ?? []).length, 2);
  assert.match(serialized, /"paddingAll":"16px"/);

  const fallback = JSON.stringify(buildLineArticleFlexMessage("life_health_policy_review", [{ ...article, lineDescription: "   " }], {
    maxCards: 1,
    items: [{ slug: article.slug, enabled: true }],
  }));
  assert.match(fallback, /ข้อความ excerpt/);
});

test("Sanity field is LINE-only and guarded apply never overwrites existing text", () => {
  const articleSchema = read("cms/sanity/schema/documents/article.ts");
  const contentRuntime = read("lib/content/sanity.ts");
  const applyModule = read("lib/admin/line/description-optimization.ts");
  const reviewRoute = read("apps/admin/app/api/admin/local-ai/review/route.ts");

  assert.match(articleSchema, /name: "lineTitle"[\s\S]*การ์ด LINE[\s\S]*ไม่กระทบชื่อบทความหรือ SEO/);
  assert.match(articleSchema, /name: "lineDescription"[\s\S]*การ์ด LINE[\s\S]*ไม่กระทบ Google/);
  assert.match(contentRuntime, /seoDescription = raw\.seo\?\.description/);
  assert.doesNotMatch(contentRuntime, /seoDescription\s*=\s*raw\.lineDescription|seoDescription:\s*raw\.lineDescription/);
  assert.match(applyModule, /if \(existingTitle && existingDescription\) return "skipped-existing"/);
  assert.match(applyModule, /patch\.lineTitle = approved\.lineTitle/);
  assert.match(applyModule, /patch\.lineDescription = approved\.lineDescription/);
  assert.match(applyModule, /\.ifRevisionId\(target\.revision\)\.set\(patch\)/);
  assert.doesNotMatch(applyModule, /\.set(?:IfMissing)?\(\{\s*(?:seo|excerpt|body)\b/);
  assert.match(reviewRoute, /identity\.role !== "owner"/);
  assert.match(reviewRoute, /parsed\.data\.decision === "approve"[\s\S]*applyApprovedLineDescription/);
  assert.doesNotMatch(read("apps/admin/app/api/internal/local-ai/line-descriptions/route.ts"), /applyApprovedLineDescription/);
  assert.match(reviewRoute, /line-description-draft-active/);
  assert.match(reviewRoute, /reviewStatus: "pending"/);
  assert.ok(
    reviewRoute.indexOf("await hasPublishedArticleDraft") < reviewRoute.indexOf("reviewLocalAiJob({ ...parsed.data"),
    "draft preflight must happen before owner approval is persisted",
  );
});

test("missing-only bridge and inactive n8n workflow remain bounded and private", () => {
  const sourceModule = read("lib/admin/line/description-optimization.ts");
  const route = read("apps/admin/app/api/internal/local-ai/line-descriptions/route.ts");
  const workflow = JSON.parse(read("workers/local-ai/n8n/line-description-backfill.inactive.json")) as {
    active: boolean;
    nodes: Array<{ type: string; parameters: Record<string, unknown>; credentials?: unknown }>;
  };
  assert.match(sourceModule, /!defined\(lineTitle\).*lineTitle == ""/);
  assert.match(sourceModule, /!defined\(lineDescription\).*lineDescription == ""/);
  assert.match(sourceModule, /coalesce\(seo\.noindex, false\) != true/);
  assert.match(sourceModule, /!defined\(\*\[_id == "drafts\." \+ \^\._id\]\[0\]\._id\)/);
  assert.match(sourceModule, /readClient\("raw"\)/);
  assert.match(sourceModule, /hasPublishedArticleDraft/);
  assert.match(sourceModule, /status: "deferred-draft"/);
  assert.match(sourceModule, /isAdminReadDataPlaneAllowed/);
  assert.match(route, /isN8nLocalAiRequestAuthorized/);
  assert.match(route, /max\(20\)/);
  assert.equal(workflow.active, false);
  assert.equal(workflow.nodes.some((node) => JSON.stringify(node).includes("queueClass: 'batch'")), true);
  assert.equal(workflow.nodes.some((node) => JSON.stringify(node).includes("CCPun Local AI Admin Bridge")), true);
  assert.equal(workflow.nodes.some((node) => JSON.stringify(node).includes("$env.")), false);
  assert.equal(workflow.nodes.filter((node) => node.type === "n8n-nodes-base.httpRequest").every((node) => node.parameters.authentication === "genericCredentialType"), true);
  assert.doesNotMatch(JSON.stringify(workflow), /api\.ollama|11434|api\.sanity|Bearer\s+[A-Za-z0-9]/i);
});
