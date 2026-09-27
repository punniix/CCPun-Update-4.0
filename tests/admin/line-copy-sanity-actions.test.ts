import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

test("Sanity LINE actions stay separate from normal article publish and show elapsed generation time", () => {
  const config = read("sanity.config.ts");
  const action = read("cms/sanity/policy/article-line-copy-action.tsx");
  assert.match(config, /appendArticleLineCopyActions/);
  assert.match(action, /กำลังสร้างข้อความ LINE… \$\{elapsed\} วินาที/);
  assert.match(action, /Publish LINE only/);
  assert.match(action, /เนื้อหาและงาน SEO อื่นใน Draft จะยังไม่ถูกเผยแพร่/);
  assert.match(action, /inFlight\.current/);
  assert.match(action, /const source = draft \?\? published/);
  assert.match(action, /complete \|\| !source\?\._rev/);
});

test("server bridge calls n8n only from server and applies missing LINE fields with revision guard", () => {
  const route = read("apps/admin/app/api/admin/content/[id]/line-copy/generate/route.ts");
  const helper = read("lib/admin/line/description-optimization.ts");
  assert.match(route, /CCPUN_LOCAL_AI_N8N_TOKEN/);
  assert.match(route, /\/webhook\/ccpun-line-card-generate/);
  assert.match(route, /missingTitle/);
  assert.match(route, /missingDescription/);
  assert.match(route, /applyGeneratedLineCopyToDraft/);
  assert.match(helper, /ifRevisionId\(draft\.revision\)/);
  assert.match(helper, /if \(!existingTitle\)/);
  assert.match(helper, /if \(!existingDescription\)/);
  assert.match(helper, /skipped-existing/);
});

test("Publish LINE only uses a revision-guarded transaction and refuses never-published articles", () => {
  const helper = read("lib/admin/line/description-optimization.ts");
  const route = read("apps/admin/app/api/admin/content/[id]/line-copy/publish/route.ts");
  assert.match(helper, /LINE_COPY_PUBLISHED_REQUIRED/);
  assert.match(helper, /\.transaction\(\)/);
  assert.match(helper, /\.patch\(logicalId/);
  assert.match(helper, /\.patch\("drafts\." \+ logicalId/);
  assert.match(helper, /ifRevisionId\(pair\.published!/);
  assert.match(helper, /ifRevisionId\(pair\.draft!/);
  assert.doesNotMatch(helper.replace(/\n/g, " "), /\.set\(\{[^}]*body:/);
  assert.match(route, /line-copy-published-required/);
});

test("Improve LINE copy uses approved Published fields only and requires owner acceptance before Draft write", () => {
  const action = read("cms/sanity/policy/article-line-copy-action.tsx");
  const route = read("apps/admin/app/api/admin/content/[id]/line-copy/improve/route.ts");
  const helper = read("lib/admin/line/description-optimization.ts");
  assert.match(action, /createImproveArticleLineCopyAction\(\)/);
  assert.match(action, /action: "propose"/);
  assert.match(action, /ตรวจข้อเสนอ LINE copy ก่อนบันทึก Draft/);
  assert.match(action, /action: "accept"/);
  assert.match(action, /Publish LINE only/);
  assert.match(route, /mode: "improve-existing"/);
  assert.match(route, /existingLineTitle/);
  assert.match(route, /existingLineDescription/);
  assert.doesNotMatch(route, /draft\.body|published\.body|"body":/);
  assert.doesNotMatch(helper.split("const improvementTargetQuery =")[1]?.split("function readClient")[0] ?? "", /pt::text\(body\)|"body"/);
  assert.match(route, /identity\.role !== "owner"/);
  assert.match(route, /isSameOriginAdminMutation/);
  assert.match(route, /signProposal\(token/);
  assert.match(route, /timingSafeEqual/);
  assert.match(helper, /target\.draft\.revision !== draftRevision\.data \|\| target\.published\.revision !== publishedRevision\.data/);
  assert.match(helper, /\.ifRevisionId\(target\.draft\.revision\)/);
  assert.match(helper, /\.set\(\{ lineTitle, lineDescription \}\)/);
});

test("n8n Improve replay preserves a successful result after a conflicting request", () => {
  const workflow = JSON.parse(read("workers/local-ai/n8n/line-card-copy.direct.json"));
  const node = (name: string) => workflow.nodes.find((item: { name: string }) => item.name === name);
  assert.match(node("ตรวจ Replay Improve").parameters.jsCode, /String\(row\.triggerSource\)===base\.triggerSource/);
  assert.equal(workflow.connections["สรุป Replay Conflict"].main[0][0].node, "ตอบกลับ Sanity");
  assert.equal(workflow.connections["Replay ใช้ไม่ได้?"].main[0][0].node, "สรุป Replay Conflict");
  for (const name of ["Ollama · Improve A", "Ollama · Improve B"]) {
    assert.match(node(name).parameters.jsonBody, /format:'json'/);
    assert.equal(node(name).parameters.options.timeout, 60_000);
  }
});
