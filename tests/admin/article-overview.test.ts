import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { loadFixtureModule } from "../../qa/phase1-fixture-loader.mjs";
import * as contracts from "../../lib/local-ai/contracts";
import { hasArticleContentChanges } from "../../cms/sanity/policy/article-publication";

const summary = "อธิบายวิธีพิจารณารายได้ ค่าใช้จ่าย และค่าลดหย่อน เพื่อเห็นภาพลำดับการคำนวณภาษี\nยกตัวอย่างการเตรียมข้อมูลและข้อควรตรวจสอบ ก่อนนำข้อมูลของตนเองไปใช้คำนวณตามบทความ";
const source = { title: "คำนวณภาษี", body: [2, 3, 4].map(level => ({ _type: "block", style: `h${level}`, children: [{ _type: "span", text: `หัวข้อ ${level}` }] })), faq: [{ question: "เตรียมอะไร", answer: "รายได้" }], sources: [{ label: "กรมสรรพากร", url: "https://www.rd.go.th/" }] };
const initial = { _id: "drafts.article", _type: "article", _rev: "r1", _createdAt: "2026-01-01T00:00:00Z", _updatedAt: "2026-01-01T00:00:00Z", ...source, geo: { entity: "keep" }, publishedAt: "2026-01-01", contentOptimizedAt: "2026-02-01", review: { status: "approved", privateNote: "DO NOT SEND" } };
function fixture(seed: Record<string, unknown>[] = [initial]) {
  const docs = new Map(seed.map(doc => [doc._id, structuredClone(doc)]));
  const writes: unknown[] = [];
  const client = { getDocument: async (id: string) => docs.get(id), create: async (doc: Record<string, unknown>) => { if (docs.has(doc._id)) throw { statusCode: 409 }; writes.push(doc); docs.set(doc._id, { ...doc, _rev: "cloned" }); }, patch(id: string) {
    let rev = ""; let missing: Record<string, unknown> = {}, values: Record<string, unknown> = {};
    const patch = { ifRevisionId(value: string) { rev = value; return patch; }, setIfMissing(value: Record<string, unknown>) { missing = value; return patch; }, set(value: Record<string, unknown>) { values = value; return patch; }, async commit() { const doc = docs.get(id)!; if (doc._rev !== rev) throw { statusCode: 409 }; writes.push({ id, rev, missing, values }); const geo = doc.geo ?? missing.geo; docs.set(id, { ...doc, geo: { ...(geo as object), summary: values["geo.summary"] }, _rev: "r2" }); return docs.get(id); } };
    return patch;
  } };
  const helper = loadFixtureModule("lib/admin/article-overview.ts", { mocks: new Map<string, unknown>([
    ["next-sanity", { createClient: () => client }], ["@/lib/local-ai/contracts", contracts],
    ["@/lib/admin/environment", { isAdminDataPlaneAllowed: () => true, isAdminReadDataPlaneAllowed: () => true }],
    ["@/lib/admin/sanity-credentials", { getAdminSanityReadToken: () => "synthetic-read", getAdminSanityWriteToken: () => "synthetic-write" }],
  ]), globals: { process: { env: { NEXT_PUBLIC_SANITY_PROJECT_ID: "synthetic", NEXT_PUBLIC_SANITY_DATASET: "uat" } } } });
  return { helper, docs, writes };
}

test("typed whole article input retains H2/H3/H4, FAQ and sources, excludes review notes and never clips", () => {
  const { helper } = fixture();
  const actual = helper.articleOverviewSource(initial);
  assert.deepEqual(actual, source); assert.ok(!JSON.stringify(actual).includes("DO NOT SEND"));
  const long = { ...initial, body: [{ _type: "block", children: [{ _type: "span", text: "ก".repeat(20_000) }] }] };
  assert.throws(() => helper.articleOverviewSource(long), /SOURCE_TOO_LARGE/);
  assert.equal(helper.ARTICLE_OVERVIEW_MAX_SOURCE_BYTES, 48_000);
  for (const body of [["not typed"], [{_type:"internalNote", text:"secret"}]]) assert.throws(()=>helper.articleOverviewSource({...initial,body}));
  assert.deepEqual(helper.articleOverviewSource({...initial,faq:[{question:"q",answer:"a",editorialNotes:"secret"}]}).faq,[{question:"q",answer:"a"}]);
});

test("new result protocol enforces two short plain points, grapheme limit, safety and exact revision/version shape", () => {
  const { helper } = fixture();
  const valid = { status: "generated", summary, sourceRevision: "r1", promptVersion: "article-overview-v1" };
  assert.ok(helper.articleOverviewResultSchema.safeParse(valid).success);
  for (const change of [{ summary: "สั้น" }, { summary: "ก".repeat(201) + "\nจบ" }, { summary: summary.replace("\n", " ") }, { summary: summary + "\nประเด็นเพิ่ม" }, { promptVersion: "unknown" }, { surprise: true }, { summary: summary + " https://bad.example" }, { summary: summary + " คุ้มครองทุกกรณี" }]) assert.ok(!helper.articleOverviewResultSchema.safeParse({ ...valid, ...change }).success, JSON.stringify(change));
});

test("Draft CAS applies only missing geo.summary, keeps existing geo, dates and Published unchanged", async () => {
  const published = { ...initial, _id: "article", _rev: "live" };
  const f = fixture([initial, published]);
  const draft = await f.helper.readOrCreateArticleOverviewDraft("article", "r1");
  assert.equal(draft.revision, "r1");
  await f.helper.applyArticleOverviewToDraft("article", "r1", summary);
  assert.deepEqual(f.docs.get("article"), published);
  assert.equal((f.docs.get("drafts.article")?.geo as Record<string, unknown>).summary, summary);
  assert.equal((f.docs.get("drafts.article")?.geo as Record<string, unknown>).entity, "keep");
  assert.equal(f.docs.get("drafts.article")?.publishedAt, initial.publishedAt);
  assert.equal(f.docs.get("drafts.article")?.contentOptimizedAt, initial.contentOptimizedAt);
  assert.deepEqual((f.writes[0] as { values: unknown }).values, { "geo.summary": summary });
  assert.equal(hasArticleContentChanges(initial, { ...initial, geo: { summary } }), false);
  await assert.rejects(f.helper.applyArticleOverviewToDraft("article", "r2", summary), /CONFLICT/);
});

test("published source creates Draft only; stale revisions, drafts/versions IDs and oversize fail closed", async () => {
  const published = { ...initial, _id: "article", _rev: "live" };
  const f = fixture([published]);
  await assert.rejects(f.helper.readOrCreateArticleOverviewDraft("article", "stale"), /CONFLICT/);
  assert.equal(f.writes.length, 0);
  const draft = await f.helper.readOrCreateArticleOverviewDraft("article", "live");
  assert.equal(draft.revision, "cloned"); assert.deepEqual(f.docs.get("article"), published);
  assert.equal(f.writes.length, 1); assert.equal(f.docs.get("drafts.article")?.contentOptimizedAt, initial.contentOptimizedAt);
  for (const id of ["drafts.article", "versions.release.article", "../article"]) await assert.rejects(f.helper.readOrCreateArticleOverviewDraft(id, "live"));
  const tooLarge = fixture([{ ...published, body: [{ _type: "block", children: [{ _type: "span", text: "ก".repeat(20_000) }] }] }]);
  await assert.rejects(tooLarge.helper.readOrCreateArticleOverviewDraft("article", "live"), /SOURCE_TOO_LARGE/); assert.equal(tooLarge.writes.length, 0);
});

const routePath = "apps/admin/app/api/admin/content/[id]/overview/generate/route.ts";
const env = { AUTH_URL: "https://admin-test.ccpun.com", CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "admin", CCPUN_LOCAL_AI_N8N_TOKEN: "s".repeat(48) };
function routeFixture({ role = "owner", actorType = "human", origin = "https://admin-test.ccpun.com", bridge = { lane: "admin-uat", token: "s".repeat(48), webhookUrl: new URL("https://n8n.example/webhook/uat-overview") }, result = { status: "generated", summary, sourceRevision: "r1", promptVersion: "article-overview-v1" }, draftSummary = "", applyConflict = false } = {}) {
  const events: unknown[] = [];
  const h = fixture();
  const route = loadFixtureModule(routePath, { mocks: new Map<string, unknown>([
    ["@/lib/admin/identity", { getAdminIdentity: async () => ({ role, actorType }) }],
    ["@/lib/admin/environment", { getAdminEnvironment: () => "admin-uat" }],
    ["@/lib/admin/local-ai/service-auth", { resolveLineCopyN8nBridge: () => bridge }],
    ["@/lib/admin/article-overview", { ...h.helper, readOrCreateArticleOverviewDraft: async () => { events.push("read"); return { revision: "r1", summary: draftSummary, source }; }, applyArticleOverviewToDraft: async (...args: unknown[]) => { events.push(args); if (applyConflict) throw new Error("OVERVIEW_CONFLICT"); return { status: "applied" }; } }],
  ]), globals: { process: { env } } });
  const request = new Request("http://127.0.0.1:3000/api/admin/content/article/overview/generate/", { method: "POST", headers: { origin, host: "admin-test.ccpun.com", "content-type": "application/json" }, body: JSON.stringify({ sourceRevision: "r1", requestId: "d4b6174c-19e8-4ee1-847a-d5c46ac57d44" }) });
  async function run() { const old = globalThis.fetch; globalThis.fetch = async (url, init) => { events.push({ url: String(url), body: JSON.parse(String(init?.body)) }); return Response.json(result); }; try { return await route.POST(request, { params: Promise.resolve({ id: "article" }) }); } finally { globalThis.fetch = old; } }
  return { run, events };
}

test("actual endpoint denies role/actor and Hostinger cross-origin before any article or model work", async () => {
  for (const change of [{ role: "editor" }, { actorType: "agent" }, { origin: "https://evil.example" }, { origin: "https://admin.ccpun.com" }]) { const f = routeFixture(change); assert.equal((await f.run()).status, 403); assert.deepEqual(f.events, []); }
});

test("actual endpoint binds source revision, no-store response, missing model and concurrent edits without patch", async () => {
  const good = routeFixture(); const response = await good.run(); assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "private, no-store");
  const call = good.events[1] as { url: string; body: Record<string, unknown> }; assert.equal(call.url, "https://n8n.example/webhook/uat-overview"); assert.equal(call.body.mode, "article-overview"); assert.deepEqual(call.body.source, source);
  for (const result of [{ status: "error", errorCategory: "model-unavailable" }, { status: "generated", summary, sourceRevision: "stale", promptVersion: "article-overview-v1" }]) { const f = routeFixture({ result: result as never }); assert.equal((await f.run()).status, 502); assert.equal(f.events.length, 2); }
  const conflict = routeFixture({ applyConflict: true }); assert.equal((await conflict.run()).status, 409);
  const skip = routeFixture({ draftSummary: "existing legacy summary" }); assert.equal((await skip.run()).status, 200); assert.deepEqual(skip.events, ["read"]);
  const off = routeFixture({ bridge: null as never }); assert.equal((await off.run()).status, 503); assert.deepEqual(off.events, []);
});

const workflow = JSON.parse(readFileSync("workers/local-ai/n8n/line-card-copy.direct.json", "utf8"));
const node = (name: string) => workflow.nodes.find((entry: { name: string }) => entry.name === name);
function code(name: string, input: unknown, prep?: unknown) { return new Function("$json", "$", "Buffer", node(name).parameters.jsCode)(input, () => ({ item: { json: prep } }), Buffer)[0].json; }

test("workflow preserves all original 29 LINE node objects/settings and default path, adds isolated six-node branch", () => {
  const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  assert.equal(workflow.nodes.length, 35);
  assert.equal(digest(workflow.nodes.slice(0, 29)), "a00eb59e39fe8f0a219647e062210a9b8634f8437c620c7dc93dc0989628ad14", "all original LINE node objects remain byte-identical in JSON identity");
  assert.equal(digest(workflow.settings), "221d1006199d8a1b22f736b38c8dac2ffcac606902c09274a00887cf4d7dbba9");
  const oldConnections = Object.fromEntries(Object.entries(workflow.connections).filter(([key]) => workflow.nodes.slice(0, 29).some((entry: {name: string}) => entry.name === key)));
  oldConnections["Sanity · Generate LINE"] = { main: [[{ node: "เตรียมงาน LINE", type: "main", index: 0 }]] };
  assert.equal(digest(oldConnections), "79a123a9382b1fe5cf49db02a7a1c1ee7df1e70b89f4b04c5d822f14c19357d4", "only webhook entry changes; every old LINE edge retained");
  assert.equal(workflow.connections["สรุปบทความ?"].main[1][0].node, "เตรียมงาน LINE");
  const ollama = node("Ollama · Article Overview"); assert.equal(ollama.parameters.url, "http://ollama:11434/api/chat"); assert.match(ollama.parameters.jsonBody, /gemma4:12b/); assert.doesNotMatch(ollama.parameters.jsonBody, /qwen|\.slice\(|api\/pull/);
});

test("actual workflow code retains whole typed source, validates protocol/model/length/new numbers", () => {
  const prep = code("เตรียมสรุปบทความ", { mode: "article-overview", requestId: "d4b6174c-19e8-4ee1-847a-d5c46ac57d44", sourceRevision: "r1", promptVersion: "article-overview-v1", source });
  assert.equal(prep.valid, true); assert.deepEqual(JSON.parse(prep.source), source);
  const valid = code("ตรวจสรุปบทความ", { done: true, done_reason: "stop", message: { content: JSON.stringify({ points: summary.split("\n") }) } }, prep); assert.equal(valid.status, "generated"); assert.equal(valid.summary, summary); assert.equal(valid.sourceRevision, "r1");
  assert.equal(code("ตรวจสรุปบทความ", { error: "model not found" }, prep).errorCategory, "model-unavailable");
  for (const points of [["สั้น", "ไป"], [summary, "เพิ่ม 999999 บาท"], ["คุ้มครองทุกกรณี " + summary, "รับประกัน"]]) assert.equal(code("ตรวจสรุปบทความ", { message: { content: JSON.stringify({ points }) } }, prep).status, "error");
  assert.equal(code("เตรียมสรุปบทความ", { mode: "article-overview", requestId: "d4b6174c-19e8-4ee1-847a-d5c46ac57d44", sourceRevision: "r1", promptVersion: "article-overview-v1", source: { ...source, body: [{ _type:"block",children:[{_type:"span",text:"ก".repeat(20_000)}] }] } }).errorCategory, "source-too-large");
});


test("real shared bridge rejects UAT missing/Production/alias webhook with no fallback", () => {
  const bridge = loadFixtureModule("lib/admin/local-ai/service-auth.ts", { mocks: new Map([["@/lib/admin/environment", { getAdminDeploymentIdentity: () => ({valid:true,role:"admin",environment:"admin-uat",provider:"hostinger"}) }]]) });
  const variables = { ...env, NEXT_PUBLIC_SANITY_PROJECT_ID:"ccb9lnw5",NEXT_PUBLIC_SANITY_DATASET:"uat", CCPUN_LOCAL_AI_N8N_WEBHOOK_URL:"https://n8n.example/webhook/uat-overview" };
  assert.equal(bridge.resolveLineCopyN8nBridge(variables)?.lane,"admin-uat");
  for(const url of [undefined,"https://n8n.example/webhook/ccpun-line-card-generate","https://n8n.example/webhook/%75at-overview","https://n8n.example/webhook/uat-overview?alias=prod"]) assert.equal(bridge.resolveLineCopyN8nBridge({...variables,CCPUN_LOCAL_AI_N8N_WEBHOOK_URL:url}),null);
  assert.equal(bridge.resolveLineCopyN8nBridge({...variables,CCPUN_LOCAL_AI_N8N_TOKEN:undefined}),null);
});

test("workflow trust boundary rejects malformed/deep/private sources, completion truncation and model metadata spoofing", () => {
  const request = { mode:"article-overview",requestId:"d4b6174c-19e8-4ee1-847a-d5c46ac57d44",sourceRevision:"r1",promptVersion:"article-overview-v1",source };
  const prep=code("เตรียมสรุปบทความ",request);
  for(const bad of [null,[],"input",{...request,requestId:"-".repeat(36)},{...request,sourceRevision:" "},{...request,promptVersion:"future"},{...request,source:{...source,body:["not typed"]}},{...request,source:{...source,body:[{...source.body[0],children:[{_type:"span",text:"visible",privateNote:"secret"}]}]}}]) assert.deepEqual(code("เตรียมสรุปบทความ",bad),{status:"error",errorCategory:"invalid-input"});
  let deep: unknown="end";for(let i=0;i<7000;i++)deep=[deep];
  assert.deepEqual(code("เตรียมสรุปบทความ",{...request,source:{...source,body:[{...source.body[0],nested:deep}]}}),{status:"error",errorCategory:"invalid-input"});
  const complete={done:true,done_reason:"stop",message:{content:JSON.stringify({points:summary.split("\n")})}};
  for(const bad of [{...complete,done:false},{...complete,done_reason:"length"},{...complete,message:{content:JSON.stringify({points:summary.split("\n"),sourceRevision:"attacker"})}},{...complete,message:{content:JSON.stringify({points:summary.split("\n"),status:"applied"})}}]) assert.equal(code("ตรวจสรุปบทความ",bad,prep).status,"error");
  for(const unsafe of ["ไม่ขาดทุน","คุ้มครองทุกกรณี","รับประกันผลตอบแทน","081-234-5678","1-2345-67890-12-3","owner@example.com"]) {
    const points=summary.split("\n");points[1]+=" "+unsafe;
    assert.equal(code("ตรวจสรุปบทความ",{...complete,message:{content:JSON.stringify({points})}},prep).status,"error",unsafe);
  }
  const points=summary.split("\n");points[1]+=" 99";
  assert.equal(code("ตรวจสรุปบทความ",{...complete,message:{content:JSON.stringify({points})}},{...prep,source:prep.source+" 1999"}).status,"error","numeric substring is not a matching token");
  const table={_type:"simpleTable",headers:["รายได้"],rows:[{_type:"tableRow",cells:["ข้อมูลเต็ม"]}]};
  const details={_type:"detailsBlock",summary:"หัวข้อขยาย",text:"เนื้อหาครบ"};
  const rich=code("เตรียมสรุปบทความ",{...request,source:{...source,body:[...source.body,table,details]}});assert.equal(rich.valid,true);assert.deepEqual(JSON.parse(rich.source).body,[...source.body,table,details]);
});


test("schema-derived public selection strips non-prefix editorial notes at every type and n8n rejects raw unknown fields", () => {
  const {helper}=fixture();
  const marker="SYNTHETIC_NONPUBLIC_ONLY";
  const body=[...source.body.map(block=>({...block,editorialNotes:marker,children:block.children.map(span=>({...span,editorialNotes:marker}))})),{_type:"simpleTable",headers:["หัวตาราง"],rows:[{_type:"tableRow",cells:["ข้อมูลครบ"],editorialNotes:marker}],editorialNotes:marker},{_type:"detailsBlock",summary:"หัวข้อ",text:"ข้อความครบ",editorialNotes:marker},{_type:"imageGallery",images:[{_type:"imageWithAlt",alt:"คำอธิบายภาพ",caption:"คำบรรยาย",editorialNotes:marker}],editorialNotes:marker}];
  const selected=helper.articleOverviewSource({...initial,body,faq:[{question:"คำถาม",answer:"คำตอบ",editorialNotes:marker}],sources:[{label:"แหล่งอ้างอิง",url:"https://example.com",editorialNotes:marker}]});
  assert.ok(!JSON.stringify(selected).includes(marker));assert.deepEqual(selected.body.slice(0,3),source.body);assert.equal(selected.body[3].rows[0].cells[0],"ข้อมูลครบ");assert.equal(selected.body[4].text,"ข้อความครบ");assert.equal(selected.body[5].images[0].caption,"คำบรรยาย");
  const request={mode:"article-overview",requestId:"d4b6174c-19e8-4ee1-847a-d5c46ac57d44",sourceRevision:"r1",promptVersion:"article-overview-v1",source:selected};
  const prep=code("เตรียมสรุปบทความ",request);assert.equal(prep.valid,true);assert.deepEqual(JSON.parse(prep.source),selected);
  for(const raw of [{...selected,body},{...selected,faq:[{question:"คำถาม",answer:"คำตอบ",editorialNotes:marker}]},{...selected,sources:[{label:"แหล่ง",editorialNotes:marker}]}]) assert.deepEqual(code("เตรียมสรุปบทความ",{...request,source:raw}),{status:"error",errorCategory:"invalid-input"});
});
