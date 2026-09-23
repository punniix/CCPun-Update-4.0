import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  lineCardDescriptionOutputSchema,
  localAiTaskOutputSchemas,
  parseLocalAiTaskInput,
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

const retiredInput = {
  locale: "th-TH",
  mode: "line-card-description",
  title: source.title,
  body: "อธิบายวิธีพิจารณาวงเงิน ความคุ้มครอง และงบประมาณจากข้อมูลในกรมธรรม์",
  allowedCategories: [source.category],
  source,
} as const;

const historicalOutput = {
  mode: "line-card-description",
  source,
  lineTitle: "มีประกันสุขภาพแล้ว ควรเช็กวงเงินตรงไหนอีก?",
  lineDescription: "ดูวิธีเทียบวงเงิน ความคุ้มครอง และงบประมาณ เพื่อเห็นจุดที่ควรทบทวนก่อนตัดสินใจ",
  reviewRequired: true,
} as const;

test("retired LINE queue payload is rejected while historical output validation remains available", () => {
  assert.equal(parseLocalAiTaskInput("content-operations", retiredInput).success, false);
  assert.equal(lineCardDescriptionOutputSchema.safeParse(historicalOutput).success, true);
  assert.equal(lineCardDescriptionOutputSchema.safeParse({
    ...historicalOutput,
    lineDescription: "รับประกันผลตอบแทนและไม่มีความเสี่ยง พร้อมอ่านข้อมูลสำคัญที่ควรรู้ก่อนตัดสินใจได้ทันที",
  }).success, false);
});

test("queue worker has no LINE-card inference or repair branch", () => {
  const worker = read("workers/local-ai/src/index.ts");
  const contract = resolveLocalAiInferenceContract("content-operations", {
    locale: "th-TH",
    title: "หัวข้อเดิม",
    body: "เนื้อหาเดิม",
    allowedCategories: ["ประกันสุขภาพ"],
  });

  assert.equal(contract.outputSchema, localAiTaskOutputSchemas["content-operations"]);
  assert.doesNotMatch(worker, /lineCardDescriptionInstruction/);
  assert.doesNotMatch(worker, /isLineCardDescriptionInput/);
  assert.doesNotMatch(worker, /lineCardLengthRepair/);
  assert.doesNotMatch(worker, /MAX_LINE_CARD_LENGTH_REPAIRS/);
  assert.doesNotMatch(worker, /composeTrustedLineCardOutput/);
});

test("LINE card prefers the dedicated description and stays compact", () => {
  const article: LineArticleCardSource = {
    slug: "health-planning",
    title: source.title,
    excerpt: "ข้อความ excerpt ที่ไม่ควรถูกเลือกเมื่อมีคำอธิบาย LINE",
    lineTitle: historicalOutput.lineTitle,
    lineDescription: historicalOutput.lineDescription,
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

  assert.match(serialized, new RegExp(historicalOutput.lineTitle));
  assert.match(serialized, new RegExp(historicalOutput.lineDescription));
  assert.doesNotMatch(serialized, /ข้อความ excerpt/);
  assert.match(serialized, /"size":"kilo"/);
  assert.match(serialized, /"aspectRatio":"1\.91:1"/);
  assert.equal((serialized.match(/"maxLines":2/g) ?? []).length, 2);

  const fallback = JSON.stringify(buildLineArticleFlexMessage("life_health_policy_review", [{ ...article, lineDescription: "   " }], {
    maxCards: 1,
    items: [{ slug: article.slug, enabled: true }],
  }));
  assert.match(fallback, /ข้อความ excerpt/);
});

test("LINE generation and publish are no longer owned by the queue review path", () => {
  const reviewRoute = read("apps/admin/app/api/admin/local-ai/review/route.ts");
  const helper = read("lib/admin/line/description-optimization.ts");
  const readRoute = read("apps/admin/app/api/internal/local-ai/line-descriptions/route.ts");
  const readme = read("workers/local-ai/n8n/README.md");

  assert.doesNotMatch(reviewRoute, /applyApprovedLineDescription/);
  assert.doesNotMatch(reviewRoute, /line-description-draft-active/);
  assert.doesNotMatch(helper, /applyApprovedLineDescription/);
  assert.match(helper, /applyGeneratedLineCopyToDraft/);
  assert.match(helper, /publishDraftLineCopyOnly/);
  assert.match(readRoute, /isN8nLocalAiRequestAuthorized/);
  assert.equal(existsSync(path.join(root, "workers/local-ai/n8n/line-description-backfill.inactive.json")), false);
  assert.match(readme, /LINE card generation is no longer part of this encrypted queue worker/);
  assert.match(readme, /Do not enqueue mode line-card-description jobs/);
});
