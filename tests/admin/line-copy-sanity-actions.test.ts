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

test("published-only generation creates only a Draft and rejects revision and creation races", async () => {
  const ts = await import("typescript");
  const { z } = await import("zod");
  let draft: Record<string, unknown> | null = null;
  let creates = 0;
  let conflict = false;
  const published = { _id: "article-1", _type: "article", _rev: "published-rev", _createdAt: "date", _updatedAt: "date", title: "Article", body: [], lineTitle: "Existing" };
  const target = (revision: string) => ({ id: "drafts.article-1", revision, slug: "article-1", title: "Article", category: "Health", body: "Article body", lineTitle: "Existing", lineDescription: null });
  const client = {
    withConfig: () => client,
    fetch: async () => draft,
    getDocument: async () => published,
    create: async (document: Record<string, unknown>) => {
      creates++;
      if (conflict) throw { statusCode: 409 };
      assert.equal(document._id, "drafts.article-1");
      assert.equal(document._type, "article");
      assert.equal(document.lineTitle, "Existing");
      for (const key of ["_rev", "_createdAt", "_updatedAt", "_originalId"]) assert.equal(key in document, false);
      draft = target("draft-rev");
      return document;
    },
  };
  const source = read("lib/admin/line/description-optimization.ts")
    .replace('process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim()', '"test-project"')
    .replace('process.env.NEXT_PUBLIC_SANITY_DATASET?.trim()', '"uat"');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports: { readOrCreateArticleDraftLineCopy?: (id: string, revision: string) => Promise<Record<string, unknown>> } = {};
  new Function("require", "exports", compiled)((id: string) => {
    if (id === "server-only") return {};
    if (id === "next-sanity") return { createClient: () => client, defineQuery: (query: string) => query };
    if (id === "zod") return { z };
    if (id === "../../local-ai/contracts") return { lineCardTextDescriptionSchema: z.string(), lineCardTitleSchema: z.string() };
    if (id === "../environment") return { isAdminDataPlaneAllowed: () => true, isAdminReadDataPlaneAllowed: () => true };
    if (id === "../sanity-credentials") return { getAdminSanityReadToken: () => "synthetic", getAdminSanityWriteToken: () => "synthetic" };
    throw new Error("Unexpected dependency " + id);
  }, exports);
  const readOrCreate = exports.readOrCreateArticleDraftLineCopy!;
  await assert.rejects(readOrCreate("article-1", "stale"), /LINE_COPY_CONFLICT/);
  assert.equal(creates, 0);
  assert.equal((await readOrCreate("article-1", "published-rev")).revision, "draft-rev");
  assert.equal(creates, 1);
  await assert.rejects(readOrCreate("article-1", "published-rev"), /LINE_COPY_CONFLICT/);
  assert.equal((await readOrCreate("article-1", "draft-rev")).revision, "draft-rev");
  assert.equal(creates, 1);
  draft = null;
  conflict = true;
  await assert.rejects(readOrCreate("article-1", "published-rev"), /LINE_COPY_CONFLICT/);
  await assert.rejects(readOrCreate("versions.release.article-1", "published-rev"), /LINE_COPY_INVALID_REQUEST/);
  assert.doesNotMatch(read("cms/sanity/policy/article-editorial-status.tsx"), /props\.onChange|PatchEvent\.from/);
});

const uatBridgeEnv = {
  CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "admin",
  CCPUN_APP_ENV: "admin-uat", NEXT_PUBLIC_CCPUN_APP_ENV: "admin-uat",
  NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5", NEXT_PUBLIC_SANITY_DATASET: "uat",
  CCPUN_LOCAL_AI_N8N_TOKEN: "synthetic-uat-" + "u".repeat(50),
  CCPUN_LOCAL_AI_N8N_WEBHOOK_URL: "https://n8n.srv908107.hstgr.cloud/webhook/uat-line-copy",
};
const productionBridgeEnv = {
  CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "admin",
  CCPUN_APP_ENV: "production-admin", CCPUN_LOCAL_AI_N8N_TOKEN: "synthetic-production-" + "p".repeat(50),
};

async function loadBridge() {
  const ts = await import("typescript");
  const crypto = await import("node:crypto");
  const compile = (source: string) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const identity: Record<string, unknown> = {};
  new Function("exports", compile(read("lib/runtime/deployment-identity.ts")))(identity);
  const bridge: Record<string, unknown> = {};
  new Function("require", "exports", compile(read("lib/admin/local-ai/service-auth.ts")))((id: string) => {
    if (id === "node:crypto") return crypto;
    if (id === "../environment") return {
      getAdminDeploymentIdentity: (env: Record<string, string | undefined>) =>
        (identity.resolveDeploymentIdentity as (env: Record<string, string | undefined>, role: string) => unknown)(env, "admin"),
    };
    throw new Error("Unexpected bridge dependency " + id);
  }, bridge);
  return bridge as { resolveLineCopyN8nBridge: (env: Record<string, string | undefined>) => { lane: string; token?: string; webhookUrl?: URL } | null };
}

async function loadLineRoute(name: "generate" | "improve", env: Record<string, string | undefined>) {
  const ts = await import("typescript");
  const { z } = await import("zod");
  const crypto = await import("node:crypto");
  const bridge = await loadBridge();
  const state = {
    owner: true, origin: true, reads: 0, writes: 0,
    draft: { revision: "draft-rev", title: "Article", body: "Draft body", category: "Health", slug: "article-1", lineTitle: "", lineDescription: "" },
    calls: [] as { url: string; options: RequestInit }[],
  };
  const target = () => ({ draft: state.draft, published: { ...state.draft, revision: "published-rev", lineTitle: "Published title", lineDescription: "Published description" } });
  const exports: { POST?: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response> } = {};
  const compiled = ts.transpileModule(read(`apps/admin/app/api/admin/content/[id]/line-copy/${name}/route.ts`), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function("require", "exports", "process", "fetch", compiled)((id: string) => {
    if (id === "node:crypto") return crypto;
    if (id === "zod") return { z };
    if (id === "next/server") return { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } };
    if (id === "@/lib/admin/auth-config") return { isSameOriginAdminMutation: () => state.origin };
    if (id === "@/lib/admin/identity") return { getAdminIdentity: async () => state.owner ? { actorType: "human", role: "owner" } : null };
    if (id === "@/lib/admin/rbac") return { hasAdminPermission: () => true };
    if (id === "@/lib/admin/local-ai/service-auth") return bridge;
    if (id === "@/lib/local-ai/contracts") return { lineCardTitleSchema: z.string().min(1), lineCardTextDescriptionSchema: z.string().min(1) };
    if (id === "@/lib/admin/line/description-optimization") return {
      readOrCreateArticleDraftLineCopy: async () => { state.reads++; return state.draft; },
      readArticleLineCopyImprovementTarget: async () => { state.reads++; return target(); },
      applyGeneratedLineCopyToDraft: async () => { state.writes++; return { status: "applied", revision: "next-rev", appliedFields: ["lineTitle", "lineDescription"] }; },
      applyImprovedLineCopyToDraft: async () => { state.writes++; return { status: "applied", revision: "next-rev" }; },
    };
    throw new Error("Unexpected route dependency " + id);
  }, exports, { env }, async (url: URL, options: RequestInit) => {
    state.calls.push({ url: url.href, options });
    return Response.json({ status: "generated", lineTitle: "Proposal title", lineDescription: "Proposal description" });
  });
  const invoke = (body: unknown) => exports.POST!(new Request("https://admin-test.ccpun.com/api/admin/content/article-1/line-copy/" + name, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: "https://admin-test.ccpun.com" }, body: JSON.stringify(body),
  }), { params: Promise.resolve({ id: "article-1" }) });
  return { state, invoke };
}
const generateInput = { sourceRevision: "published-rev", requestId: "11111111-1111-4111-8111-111111111111" };
const proposeInput = { action: "propose", draftRevision: "draft-rev", publishedRevision: "published-rev", requestId: generateInput.requestId };
const acceptInput = { action: "accept", draftRevision: "draft-rev", publishedRevision: "published-rev", lineTitle: "Proposal title", lineDescription: "Proposal description", proposalToken: "x".repeat(43) };

test("UAT bridge requires a pure matching identity, Sanity lane and canonical explicit webhook", async () => {
  const { resolveLineCopyN8nBridge: resolve } = await loadBridge();
  assert.equal(resolve(uatBridgeEnv)?.webhookUrl?.href, uatBridgeEnv.CCPUN_LOCAL_AI_N8N_WEBHOOK_URL);
  assert.equal(resolve({ ...uatBridgeEnv, NEXT_PUBLIC_CCPUN_APP_ENV: undefined })?.lane, "admin-uat");
  for (const delta of [
    { CCPUN_LOCAL_AI_N8N_WEBHOOK_URL: undefined }, { CCPUN_LOCAL_AI_N8N_TOKEN: "short" },
    { NEXT_PUBLIC_SANITY_PROJECT_ID: "kyfxgjnq" }, { NEXT_PUBLIC_SANITY_DATASET: "production" },
    { NEXT_PUBLIC_CCPUN_APP_ENV: "production-admin" }, { CCPUN_APP_ENV: "unknown" },
    { NEXT_PUBLIC_CCPUN_DEPLOYMENT_PROVIDER: "vercel" }, { NEXT_PUBLIC_CCPUN_DEPLOYMENT_ROLE: "web" },
    { CCPUN_DEPLOYMENT_ROLE: "web" }, { VERCEL_PROJECT_ID: "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN" },
  ]) assert.equal(resolve({ ...uatBridgeEnv, ...delta }), null);
  for (const url of [
    "http://n8n.example/webhook/uat", "https://user:pass@n8n.example/webhook/uat",
    "https://n8n.example/webhook/uat?x=1", "https://n8n.example/webhook/uat#x",
    "https://n8n.example/webhook/uat?", "https://n8n.example/webhook/uat#",
    "https://n8n.example/webhook/ccpun-line-card-generate", "https://n8n.example/webhook/CCPUN-LINE-CARD-GENERATE", "https://n8n.example/webhook/ccpun-line-card-generate/",
    "https://n8n.example/webhook/%63cpun-line-card-generate", "https://n8n.example/webhook%2fccpun-line-card-generate",
    "https://n8n.example/webhook/%2563cpun-line-card-generate", "https://n8n.example/webhook/uat/../ccpun-line-card-generate",
    "https://n8n.example/webhook/uat/", "https://n8n.example/webhook/uat\\bad", "https://n8n.example:443/webhook/uat",
  ]) assert.equal(resolve({ ...uatBridgeEnv, CCPUN_LOCAL_AI_N8N_WEBHOOK_URL: url }), null, url);
  const preview = { ...uatBridgeEnv, CCPUN_DEPLOYMENT_PROVIDER: "vercel", VERCEL_PROJECT_ID: "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN", VERCEL_ENV: "preview" };
  assert.equal(resolve(preview)?.lane, "admin-uat");
  assert.equal(resolve({ ...preview, VERCEL_ENV: "production" }), null);
  assert.equal(resolve(productionBridgeEnv)?.lane, "production-admin");
  assert.equal(resolve({}) , null);
});

test("blocked UAT Generate/Improve cannot read, create a Draft, apply or call n8n", async () => {
  for (const delta of [
    { CCPUN_LOCAL_AI_N8N_WEBHOOK_URL: undefined }, { CCPUN_LOCAL_AI_N8N_TOKEN: undefined },
    { CCPUN_LOCAL_AI_N8N_WEBHOOK_URL: "https://n8n.srv908107.hstgr.cloud/webhook/ccpun-line-card-generate" },
    { NEXT_PUBLIC_SANITY_DATASET: "production" }, { NEXT_PUBLIC_CCPUN_APP_ENV: "production-admin" },
    { CCPUN_APP_ENV: "unknown" }, { CCPUN_DEPLOYMENT_ROLE: "web" },
    { NEXT_PUBLIC_CCPUN_DEPLOYMENT_PROVIDER: "vercel" }, { NEXT_PUBLIC_CCPUN_DEPLOYMENT_ROLE: "web" },
    { CCPUN_LOCAL_AI_N8N_WEBHOOK_URL: uatBridgeEnv.CCPUN_LOCAL_AI_N8N_WEBHOOK_URL + "?" },
    { CCPUN_LOCAL_AI_N8N_WEBHOOK_URL: uatBridgeEnv.CCPUN_LOCAL_AI_N8N_WEBHOOK_URL + "#" },
  ]) {
    for (const [name, body] of [["generate", generateInput], ["improve", proposeInput], ["improve", acceptInput]] as const) {
      const route = await loadLineRoute(name, { ...uatBridgeEnv, ...delta });
      assert.equal((await route.invoke(body)).status, 503);
      assert.deepEqual([route.state.reads, route.state.writes, route.state.calls.length], [0, 0, 0]);
    }
  }
});

test("owner, origin and input rejection retain priority over unavailable bridge", async () => {
  for (const name of ["generate", "improve"] as const) {
    const route = await loadLineRoute(name, {});
    route.state.owner = false;
    assert.equal((await route.invoke({})).status, 403);
    route.state.owner = true; route.state.origin = false;
    assert.equal((await route.invoke({})).status, 403);
    route.state.origin = true;
    assert.equal((await route.invoke({})).status, 400);
    assert.deepEqual([route.state.reads, route.state.writes, route.state.calls.length], [0, 0, 0]);
  }
});

test("configured UAT uses only exact explicit URL/token, denies redirects and retains manual acceptance", async () => {
  for (const name of ["generate", "improve"] as const) {
    const route = await loadLineRoute(name, uatBridgeEnv);
    const response = await route.invoke(name === "generate" ? generateInput : proposeInput);
    assert.equal(response.status, 200);
    const call = route.state.calls[0];
    assert.equal(call.url, uatBridgeEnv.CCPUN_LOCAL_AI_N8N_WEBHOOK_URL);
    assert.equal((call.options.headers as Record<string, string>).Authorization, "Bearer " + uatBridgeEnv.CCPUN_LOCAL_AI_N8N_TOKEN);
    assert.equal(call.options.redirect, "error");
    if (name === "improve") {
      assert.equal(route.state.writes, 0);
      assert.equal(JSON.parse(call.options.body as string).body, undefined);
      const proposal = await response.json();
      assert.equal((await route.invoke(acceptInput)).status, 400);
      assert.equal(route.state.writes, 0);
      assert.equal((await route.invoke({ ...acceptInput, proposalToken: proposal.proposalToken })).status, 200);
      assert.equal(route.state.writes, 1);
      assert.equal(route.state.calls.length, 1);
    }
  }
});

test("Production keeps legacy default/custom-base webhook, skipped generation and token-only HMAC acceptance", async () => {
  for (const base of [undefined, "https://other-n8n.example/ignored-prefix/"]) {
    for (const name of ["generate", "improve"] as const) {
      const route = await loadLineRoute(name, { ...productionBridgeEnv, CCPUN_LOCAL_AI_N8N_BASE_URL: base });
      const response = await route.invoke(name === "generate" ? generateInput : proposeInput);
      assert.equal(response.status, 200);
      assert.equal(route.state.calls[0].url, (base ? "https://other-n8n.example" : "https://n8n.srv908107.hstgr.cloud") + "/webhook/ccpun-line-card-generate");
      assert.equal(route.state.calls[0].options.redirect, undefined);
      if (name === "improve") {
        const proposal = await response.json();
        const accept = await loadLineRoute("improve", { ...productionBridgeEnv, CCPUN_LOCAL_AI_N8N_BASE_URL: "invalid" });
        assert.equal((await accept.invoke({ ...acceptInput, proposalToken: proposal.proposalToken })).status, 200);
        assert.deepEqual([accept.state.reads, accept.state.writes, accept.state.calls.length], [0, 1, 0]);
      }
    }
  }
  const skipped = await loadLineRoute("generate", { ...productionBridgeEnv, CCPUN_LOCAL_AI_N8N_TOKEN: undefined });
  skipped.state.draft.lineTitle = "Existing"; skipped.state.draft.lineDescription = "Existing description";
  assert.equal((await (await skipped.invoke(generateInput)).json()).status, "skipped-existing");
  assert.deepEqual([skipped.state.reads, skipped.state.writes, skipped.state.calls.length], [1, 0, 0]);
});
