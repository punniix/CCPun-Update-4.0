import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

test("Sanity LINE actions stay separate from normal article publish and show elapsed generation time", () => {
  const config = read("sanity.config.ts");
  const action = read("cms/sanity/policy/article-line-copy-action.tsx");
  assert.match(config, /appendArticleLineCopyActions/);
  assert.match(action, /กำลังสร้าง LINE… \$\{elapsed\} วินาที/);
  assert.match(action, /Publish LINE only/);
  assert.match(action, /เนื้อหาและงาน SEO อื่นใน Draft จะยังไม่ถูกเผยแพร่/);
  assert.match(action, /inFlight\.current/);
  assert.match(action, /complete \|\| !draft\?\._rev/);
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
