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
import { inferAndValidate, resolveLocalAiInferenceContract } from "../../workers/local-ai/src/index";

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

const modelOutput = {
  lineTitle: output.lineTitle,
  lineDescription: output.lineDescription,
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

test("worker gives the model only copy fields and keeps final LINE output contract separate", () => {
  const contract = resolveLocalAiInferenceContract("content-operations", input);
  assert.notEqual(contract.outputSchema, lineCardDescriptionOutputSchema);
  assert.deepEqual(contract.outputSchema.parse({
    ...modelOutput,
    mode: "spoofed-mode",
    source: { ...source, revision: "spoofed-revision" },
    reviewRequired: false,
  }), modelOutput);
  assert.notEqual(resolveLocalAiInferenceContract("content-operations", {
    locale: "th-TH",
    title: "หัวข้อเดิม",
    body: "เนื้อหาเดิม",
    allowedCategories: ["ประกันสุขภาพ"],
  }).outputSchema, contract.outputSchema);
});

test("worker makes up to two length-only repairs, restores trusted metadata, and never repairs unsafe LINE output", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let responses: unknown[] = [];
  const requests: Array<{ format: unknown; messages: Array<{ role: string; content: string }> }> = [];
  globalThis.fetch = async (_input, init) => {
    requests.push(JSON.parse(String(init?.body)) as (typeof requests)[number]);
    const next = responses.shift();
    return Response.json({ message: { content: typeof next === "string" ? next : JSON.stringify(next) } });
  };

  const tooShortModelOutput = { lineTitle: "สั้น", lineDescription: "สั้นเกินไป" };

  responses = [tooShortModelOutput, tooShortModelOutput, modelOutput];
  const repaired = await inferAndValidate("http://ollama:11434/", "qwen3:1.7b", "content-operations", input);
  assert.equal(repaired.success, true);
  if (repaired.success) assert.deepEqual(repaired.data, output);
  assert.equal(requests.length, 3);
  for (const request of [requests[1], requests[2]]) {
    assert.equal(request?.messages.length, 4);
    assert.match(request?.messages[3]?.content ?? "", /24-60/);
    assert.match(request?.messages[3]?.content ?? "", /50-90/);
    assert.match(request?.messages[3]?.content ?? "", /60-75/);
  }

  const modelFormat = JSON.stringify(requests[0]?.format);
  assert.match(modelFormat, /lineTitle/);
  assert.match(modelFormat, /lineDescription/);
  assert.doesNotMatch(modelFormat, /source|reviewRequired|mode/);
  assert.match(requests[0]?.messages[0]?.content ?? "", /รับประกันความคุ้มครอง/);
  assert.match(requests[0]?.messages[0]?.content ?? "", /13-digit identifier/);
  assert.match(requests[0]?.messages[0]?.content ?? "", /Do not return mode, source, reviewRequired/);

  requests.length = 0;
  responses = [tooShortModelOutput, tooShortModelOutput, tooShortModelOutput, modelOutput];
  const exhausted = await inferAndValidate("http://ollama:11434/", "qwen3:1.7b", "content-operations", input);
  assert.equal(exhausted.success, false);
  assert.equal(requests.length, 3);

  requests.length = 0;
  responses = [{
    ...modelOutput,
    mode: "spoofed-mode",
    source: { ...source, revision: "spoofed-revision" },
    reviewRequired: false,
  }];
  const trusted = await inferAndValidate("http://ollama:11434/", "qwen3:1.7b", "content-operations", input);
  assert.equal(trusted.success, true);
  if (trusted.success) assert.deepEqual(trusted.data, output);
  assert.equal(requests.length, 1);

  for (const unsafe of [
    { ...modelOutput, lineDescription: "อ่านหลักการวางแผนฉบับย่อแล้วติดต่อ 0812345678 เพื่อสอบถามข้อมูลเพิ่มเติมจากทีมงาน" },
    { ...modelOutput, lineDescription: "รับประกันผลตอบแทนและไม่มีความเสี่ยง พร้อมอ่านข้อมูลสำคัญที่ควรรู้ก่อนตัดสินใจได้ทันที" },
  ]) {
    requests.length = 0;
    responses = [unsafe, modelOutput];
    const rejected = await inferAndValidate("http://ollama:11434/", "qwen3:1.7b", "content-operations", input);
    assert.equal(rejected.success, false);
    assert.equal(requests.length, 1);
  }

  requests.length = 0;
  responses = ["not-json", modelOutput];
  await assert.rejects(
    inferAndValidate("http://ollama:11434/", "qwen3:1.7b", "content-operations", input),
    /MODEL_JSON_INVALID/,
  );
  assert.equal(requests.length, 1);
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
    nodes: Array<{
      name: string;
      type: string;
      parameters: Record<string, unknown>;
      credentials?: unknown;
    }>;
    connections: Record<string, Record<string, Array<Array<{ node: string }>>>>;
  };
  const workflowText = JSON.stringify(workflow);
  const connectionCount = Object.values(workflow.connections).reduce(
    (total, connectionGroups) => total + Object.values(connectionGroups).reduce(
      (groupTotal, branches) => groupTotal + branches.reduce((branchTotal, branch) => branchTotal + branch.length, 0),
      0,
    ),
    0,
  );
  const node = (name: string) => workflow.nodes.find((candidate) => candidate.name === name);
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
  assert.match(route, /searchParams\.get\("slug"\)/);
  assert.match(route, /searchParams\.get\("sourceId"\)/);
  assert.match(sourceModule, /\(\$slug == null \|\| slug\.current == \$slug\)/);
  assert.match(sourceModule, /readPublishedArticleLineDescription/);
  assert.equal(workflow.active, false);
  assert.equal(workflow.nodes.length, 23);
  assert.equal(connectionCount, 25);
  assert.equal(workflow.nodes.some((node) => node.type === "n8n-nodes-base.manualTrigger"), true);
  assert.equal(workflow.nodes.some((node) => node.type === "n8n-nodes-base.scheduleTrigger"), true);
  assert.equal(workflow.nodes.some((node) => node.type === "n8n-nodes-base.wait"), true);
  assert.equal(
    node("อ่านบทความ critical สำหรับ manual")?.parameters.url,
    "https://admin.ccpun.com/api/internal/local-ai/line-descriptions/?limit=1&slug=critical-illness-insurance",
  );
  assert.equal(
    workflow.connections["ทดสอบด้วยบทความ critical"]?.main?.[0]?.[0]?.node,
    "อ่านบทความ critical สำหรับ manual",
  );
  assert.equal(
    workflow.connections["ทุก 6 ชั่วโมง"]?.main?.[0]?.[0]?.node,
    "อ่านบทความที่ยังขาดข้อความ LINE",
  );
  assert.equal(workflow.nodes.some((node) => JSON.stringify(node).includes("queueClass: 'batch'")), true);
  assert.equal(workflowText.match(/line-card-copy:v4:/g)?.length ?? 0, 0);
  assert.equal(workflowText.match(/line-card-copy:v7:/g)?.length ?? 0, 1);
  assert.equal(workflow.nodes.some((node) => JSON.stringify(node).includes("/local-ai/reviews/?jobId=")), true);
  assert.equal(workflow.nodes.some((node) => JSON.stringify(node).includes("sourceId=")), true);
  assert.equal(workflow.nodes.some((node) => JSON.stringify(node).includes("sanity-verification-failed")), true);
  assert.equal(workflow.nodes.some((node) => JSON.stringify(node).includes("CCPun Local AI Admin Bridge")), true);
  assert.equal(workflow.nodes.some((node) => JSON.stringify(node).includes("$env.")), false);
  assert.equal(workflow.nodes.filter((node) => node.type === "n8n-nodes-base.httpRequest").every((node) => node.parameters.authentication === "genericCredentialType"), true);
  assert.doesNotMatch(workflowText, /api\.ollama|11434|api\.sanity|Bearer\s+[A-Za-z0-9]/i);
});
