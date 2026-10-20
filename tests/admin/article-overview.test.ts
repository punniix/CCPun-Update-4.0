import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { loadFixtureModule } from "../../qa/phase1-fixture-loader.mjs";
import * as contracts from "../../lib/local-ai/contracts";
import { hasArticleContentChanges } from "../../cms/sanity/policy/article-publication";
import { EDITORIAL_INSTRUCTION_VERSION, ARTICLE_OVERVIEW_DEFAULT_INSTRUCTIONS } from "../../lib/local-ai/editorial-instructions";

const summary = "อธิบายวิธีพิจารณารายได้ ค่าใช้จ่าย และค่าลดหย่อน เพื่อเห็นภาพลำดับการคำนวณภาษี\nยกตัวอย่างการเตรียมข้อมูลและข้อควรตรวจสอบ ก่อนนำข้อมูลของตนเองไปใช้คำนวณตามบทความ";
const source = { title: "คำนวณภาษี", body: [2, 3, 4].map(level => ({ _type: "block", style: `h${level}`, children: [{ _type: "span", text: `หัวข้อ ${level}` }] })), faq: [{ question: "เตรียมอะไร", answer: "รายได้" }], sources: [{ label: "กรมสรรพากร", url: "https://www.rd.go.th/" }] };
const instructionHash = createHash("sha256").update(JSON.stringify([EDITORIAL_INSTRUCTION_VERSION, ARTICLE_OVERVIEW_DEFAULT_INSTRUCTIONS])).digest("hex");
const overviewMetadata = { requestId: "d4b6174c-19e8-4ee1-847a-d5c46ac57d44", editorialInstructions: ARTICLE_OVERVIEW_DEFAULT_INSTRUCTIONS, editorialInstructionVersion: EDITORIAL_INSTRUCTION_VERSION, instructionHash, triggerSource: `sanity:${EDITORIAL_INSTRUCTION_VERSION}:${instructionHash}`, inferenceProvider: "local" };
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
  const long = { ...initial, body: [{ _type: "block", children: [{ _type: "span", text: "ก".repeat(70_000) }] }] };
  assert.throws(() => helper.articleOverviewSource(long), /SOURCE_TOO_LARGE/);
  assert.equal(helper.ARTICLE_OVERVIEW_MAX_SOURCE_BYTES, 192_000);
  for (const body of [["not typed"], [{_type:"internalNote", text:"secret"}]]) assert.throws(()=>helper.articleOverviewSource({...initial,body}));
  assert.deepEqual(helper.articleOverviewSource({...initial,faq:[{question:"q",answer:"a",editorialNotes:"secret"}]}).faq,[{question:"q",answer:"a"}]);
});

test("new result protocol enforces two or three short plain points, grapheme limit, safety and exact revision/version shape", () => {
  const { helper } = fixture();
  const valid = { status: "generated", summary, sourceRevision: "r1", promptVersion: "article-overview-v2" };
  assert.ok(helper.articleOverviewResultSchema.safeParse(valid).success);
  for (const change of [{ summary: "สั้น" }, { summary: "ก".repeat(301) + "\nจบ" }, { summary: summary.replace("\n", " ") }, { summary: summary + "\nประเด็นเพิ่ม\nประเด็นเกิน" }, { promptVersion: "unknown" }, { surprise: true }, { summary: summary + " https://bad.example" }, { summary: summary + " คุ้มครองทุกกรณี" }]) assert.ok(!helper.articleOverviewResultSchema.safeParse({ ...valid, ...change }).success, JSON.stringify(change));
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
  const tooLarge = fixture([{ ...published, body: [{ _type: "block", children: [{ _type: "span", text: "ก".repeat(70_000) }] }] }]);
  await assert.rejects(tooLarge.helper.readOrCreateArticleOverviewDraft("article", "live"), /SOURCE_TOO_LARGE/); assert.equal(tooLarge.writes.length, 0);
});

const routePath = "apps/admin/app/api/admin/content/[id]/overview/generate/route.ts";
const env = { AUTH_URL: "https://admin-test.ccpun.com", CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "admin", CCPUN_LOCAL_AI_N8N_TOKEN: "s".repeat(48) };
function routeFixture({ role = "owner", actorType = "human", origin = "https://admin-test.ccpun.com", bridge = { lane: "admin-uat", token: "s".repeat(48), webhookUrl: new URL("https://n8n.example/webhook/uat-overview") }, result = { status: "generated", summary, sourceRevision: "r1", promptVersion: "article-overview-v2" }, draftSummary = "", applyConflict = false, routeSource = source, requestBody = undefined as Record<string, unknown> | undefined } = {}) {
  const events: unknown[] = [];
  const h = fixture();
  const route = loadFixtureModule(routePath, { mocks: new Map<string, unknown>([
    ["@/lib/admin/identity", { getAdminIdentity: async () => ({ role, actorType }) }],
    ["@/lib/admin/environment", { getAdminEnvironment: () => "admin-uat" }],
    ["@/lib/admin/local-ai/service-auth", { resolveLineCopyN8nBridge: () => bridge }],
    ["@/lib/admin/article-overview", { ...h.helper, readOrCreateArticleOverviewDraft: async () => { events.push("read"); return { revision: "r1", summary: draftSummary, source: routeSource }; }, applyArticleOverviewToDraft: async (...args: unknown[]) => { events.push(args); if (applyConflict) throw new Error("OVERVIEW_CONFLICT"); return { status: "applied" }; } }],
  ]), globals: { process: { env } } });
  const request = new Request("http://127.0.0.1:3000/api/admin/content/article/overview/generate/", { method: "POST", headers: { origin, host: "admin-test.ccpun.com", "content-type": "application/json" }, body: JSON.stringify(requestBody ?? { sourceRevision: "r1", requestId: "d4b6174c-19e8-4ee1-847a-d5c46ac57d44" }) });
  async function run() { const old = globalThis.fetch; globalThis.fetch = async (url, init) => { events.push({ url: String(url), body: JSON.parse(String(init?.body)) }); return Response.json({ requestId: (events.at(-1) as {body: Record<string, unknown>}).body.requestId, instructionHash: (events.at(-1) as {body: Record<string, unknown>}).body.instructionHash, editorialInstructionVersion: EDITORIAL_INSTRUCTION_VERSION, ...result }); }; try { return await route.POST(request, { params: Promise.resolve({ id: "article" }) }); } finally { globalThis.fetch = old; } }
  return { run, events };
}

test("actual endpoint denies role/actor and Hostinger cross-origin before any article or model work", async () => {
  for (const change of [{ role: "editor" }, { actorType: "agent" }, { origin: "https://evil.example" }, { origin: "https://admin.ccpun.com" }]) { const f = routeFixture(change); assert.equal((await f.run()).status, 403); assert.deepEqual(f.events, []); }
});

test("actual endpoint binds source revision, no-store response, missing model and concurrent edits without patch", async () => {
  const good = routeFixture(); const response = await good.run(); assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "private, no-store");
  const call = good.events[1] as { url: string; body: Record<string, unknown> }; assert.equal(call.url, "https://n8n.example/webhook/uat-overview"); assert.equal(call.body.mode, "article-overview"); assert.deepEqual(call.body.source, source);
  for (const result of [{ status: "error", errorCategory: "model-unavailable" }, { status: "generated", summary, sourceRevision: "stale", promptVersion: "article-overview-v2" }]) { const f = routeFixture({ result: result as never }); assert.equal((await f.run()).status, 502); assert.equal(f.events.length, 2); }
  const conflict = routeFixture({ applyConflict: true }); assert.equal((await conflict.run()).status, 409);
  const skip = routeFixture({ draftSummary: "existing legacy summary" }); assert.equal((await skip.run()).status, 200); assert.deepEqual(skip.events, ["read"]);
  const off = routeFixture({ bridge: null as never }); assert.equal((await off.run()).status, 503); assert.deepEqual(off.events, []);
});

const workflow = JSON.parse(readFileSync("workers/local-ai/n8n/line-card-copy.direct.json", "utf8"));
const node = (name: string) => workflow.nodes.find((entry: { name: string }) => entry.name === name);
function code(name: string, input: unknown, prep?: unknown) { return new Function("$json", "$", "Buffer", node(name).parameters.jsCode)(input, () => ({ item: { json: prep } }), Buffer)[0].json; }

test("workflow preserves 22 untouched LINE nodes, exact seven editorial changes, settings and original LINE edges", () => {
  const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  assert.equal(workflow.nodes.length, 38);
  const changedNames = ["เตรียมงาน LINE", "Ollama · Candidate A", "Ollama · Candidate B", "Ollama · Candidate C", "Ollama · Improve A", "Ollama · Improve B", "Ollama · เลือก Candidate"];
  const editorialPins = {"เตรียมงาน LINE": "ed7f8a2c56270baa17da3fab8d28a81621b9d6b2fd8bd2b9a6e68b52236a3a64", "Ollama · Candidate A": "fcc6bd0bebb359f489904fb39b4486d1afa6c16266cecb96c9366af7558c6dbd", "Ollama · Candidate B": "b8d2b861278a917dd26d22e087166e6d0f3141b85f58b06b9a5e47921cb3574b", "Ollama · Candidate C": "1aad904d352e708719d5e7b1365c92f262f1ae2d440678d06116da71fc5e210d", "Ollama · เลือก Candidate": "4edd682de5348a56264a1ff40169908d9d3dc4aafdf66df5642d5a1a88253188", "Ollama · Improve A": "272b8a446a137b475ed5ec134723b3294c8d661aafb1064f54f37d076d4a2ed3", "Ollama · Improve B": "282b8bab98ac169a454f5cb8085ee4db833ab85dcb33b74d6d3a4b82d494384b"};
  assert.equal(digest(workflow.nodes.slice(0,29).filter((entry:{name:string})=>!changedNames.includes(entry.name))), "8564770c48dbf412dd8df74e4f7d4d20dc33a30b37956f5e88ddabe19b9d8778", "22 unmodified original LINE node objects remain frozen");
  for(const entry of workflow.nodes.slice(0,29).filter((entry:{name:string})=>changedNames.includes(entry.name)))assert.equal(digest(entry),editorialPins[entry.name as keyof typeof editorialPins],"exact reviewed preference-only node body");
  assert.equal(digest(workflow.settings), "221d1006199d8a1b22f736b38c8dac2ffcac606902c09274a00887cf4d7dbba9");
  const oldConnections = Object.fromEntries(Object.entries(workflow.connections).filter(([key]) => workflow.nodes.slice(0, 29).some((entry: {name: string}) => entry.name === key)));
  oldConnections["Sanity · Generate LINE"] = { main: [[{ node: "เตรียมงาน LINE", type: "main", index: 0 }]] };
  assert.equal(digest(oldConnections), "79a123a9382b1fe5cf49db02a7a1c1ee7df1e70b89f4b04c5d822f14c19357d4", "only webhook entry changes; every old LINE edge retained");
  assert.equal(workflow.connections["สรุปบทความ?"].main[1][0].node, "เตรียมงาน LINE");
  const ollama = node("Ollama · Article Overview"); assert.equal(ollama.parameters.url, "http://ollama:11434/api/chat"); assert.match(ollama.parameters.jsonBody, /gemma4:12b/); assert.doesNotMatch(ollama.parameters.jsonBody, /qwen|\.slice\(|api\/pull/);
});

test("actual workflow code retains whole typed source, validates protocol/model/length/new numbers", () => {
  const prep = code("เตรียมสรุปบทความ", { mode: "article-overview", ...overviewMetadata, sourceRevision: "r1", promptVersion: "article-overview-v2", source });
  assert.equal(prep.valid, true); assert.deepEqual(JSON.parse(prep.source), source);
  const valid = code("ตรวจสรุปบทความ", { done: true, done_reason: "stop", message: { content: JSON.stringify({ points: summary.split("\n") }) } }, prep); assert.equal(valid.status, "generated"); assert.equal(valid.summary, summary); assert.equal(valid.sourceRevision, "r1");
  assert.equal(code("ตรวจสรุปบทความ", { error: "model not found" }, prep).errorCategory, "model-unavailable");
  for (const points of [["สั้น", "ไป"], [summary, "เพิ่ม 999999 บาท"], ["คุ้มครองทุกกรณี " + summary, "รับประกัน"]]) assert.equal(code("ตรวจสรุปบทความ", { message: { content: JSON.stringify({ points }) } }, prep).status, "error");
  assert.equal(code("เตรียมสรุปบทความ", { mode: "article-overview", ...overviewMetadata, sourceRevision: "r1", promptVersion: "article-overview-v2", source: { ...source, body: [{ _type:"block",children:[{_type:"span",text:"ก".repeat(70_000)}] }] } }).errorCategory, "source-too-large");
});


test("real shared bridge rejects UAT missing/Production/alias webhook with no fallback", () => {
  const bridge = loadFixtureModule("lib/admin/local-ai/service-auth.ts", { mocks: new Map([["@/lib/admin/environment", { getAdminDeploymentIdentity: () => ({valid:true,role:"admin",environment:"admin-uat",provider:"hostinger"}) }]]) });
  const variables = { ...env, NEXT_PUBLIC_SANITY_PROJECT_ID:"ccb9lnw5",NEXT_PUBLIC_SANITY_DATASET:"uat", CCPUN_LOCAL_AI_N8N_WEBHOOK_URL:"https://n8n.example/webhook/uat-overview" };
  assert.equal(bridge.resolveLineCopyN8nBridge(variables)?.lane,"admin-uat");
  for(const url of [undefined,"https://n8n.example/webhook/ccpun-line-card-generate","https://n8n.example/webhook/%75at-overview","https://n8n.example/webhook/uat-overview?alias=prod"]) assert.equal(bridge.resolveLineCopyN8nBridge({...variables,CCPUN_LOCAL_AI_N8N_WEBHOOK_URL:url}),null);
  assert.equal(bridge.resolveLineCopyN8nBridge({...variables,CCPUN_LOCAL_AI_N8N_TOKEN:undefined}),null);
});

test("workflow trust boundary rejects malformed/deep/private sources, completion truncation and model metadata spoofing", () => {
  const request = { mode:"article-overview",...overviewMetadata,sourceRevision:"r1",promptVersion:"article-overview-v2",source };
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
  const request={mode:"article-overview",...overviewMetadata,sourceRevision:"r1",promptVersion:"article-overview-v2",source:selected};
  const prep=code("เตรียมสรุปบทความ",request);assert.equal(prep.valid,true);assert.deepEqual(JSON.parse(prep.source),selected);
  for(const raw of [{...selected,body},{...selected,faq:[{question:"คำถาม",answer:"คำตอบ",editorialNotes:marker}]},{...selected,sources:[{label:"แหล่ง",editorialNotes:marker}]}]) assert.deepEqual(code("เตรียมสรุปบทความ",{...request,source:raw}),{status:"error",errorCategory:"invalid-input"});
});

test("Overview v2 accepts two or three brief points only and forwards whole middle/tail/FAQ/source content", () => {
  const {helper}=fixture();
  const valid={status:"generated",summary,sourceRevision:"r1",promptVersion:"article-overview-v2"};
  assert.ok(helper.articleOverviewResultSchema.safeParse(valid).success);
  assert.ok(helper.articleOverviewResultSchema.safeParse({...valid,summary:summary+"\nอธิบายข้อควรตรวจสอบและเงื่อนไขสำคัญที่เกี่ยวข้องกับเนื้อหา"}).success);
  for(const changed of [{summary:"สรุปเพียงประเด็นเดียว ".repeat(5)},{summary:summary+"\nข้อสาม\nข้อสี่"},{promptVersion:"article-overview-v1"}])assert.ok(!helper.articleOverviewResultSchema.safeParse({...valid,...changed}).success);
  const rich={...source,body:[...source.body,{_type:"block",style:"normal",children:[{_type:"span",text:"MIDDLE_COMPLETE ข้อมูลช่วงกลาง "+"รายละเอียด ".repeat(250)}]},{_type:"block",style:"h4",children:[{_type:"span",text:"TAIL_COMPLETE ข้อจำกัดท้ายบทความ"}]}],faq:[{question:"FAQ_COMPLETE",answer:"เงื่อนไขครบ"}],sources:[{label:"REFERENCE_COMPLETE",url:"https://www.rd.go.th/"}]};
  const selected=helper.articleOverviewSource(rich);const request={mode:"article-overview",...overviewMetadata,sourceRevision:"r1",promptVersion:"article-overview-v2",source:selected};
  const prepared=code("เตรียมสรุปบทความ",request);assert.equal(prepared.valid,true);assert.deepEqual(JSON.parse(prepared.source),rich);
  for(const marker of ["MIDDLE_COMPLETE","TAIL_COMPLETE","FAQ_COMPLETE","REFERENCE_COMPLETE"])assert.ok(prepared.source.includes(marker),marker);
  assert.ok(prepared.source.length>1400,"complete article flow never reuses LINE excerpt cutoff");
});

test("Overview request preference is optional, bounded and separate from full article source", async () => {
  const base={sourceRevision:"r1",requestId:"d4b6174c-19e8-4ee1-847a-d5c46ac57d44"};
  for(const requestBody of [{...base,editorialInstructions:" "},{...base,editorialInstructions:{}},{...base,editorialInstructions:"ก".repeat(201)},{...base,editorialInstructionVersion:"attacker"},{...base,triggerSource:"attacker"}]) {
    const f=routeFixture({requestBody});assert.equal((await f.run()).status,400);assert.deepEqual(f.events,[]);
  }
  const omitted=routeFixture();assert.equal((await omitted.run()).status,200);
  const call=(omitted.events[1] as {body:Record<string,unknown>}).body;
  assert.equal(call.editorialInstructions,ARTICLE_OVERVIEW_DEFAULT_INSTRUCTIONS);assert.equal(call.editorialInstructionVersion,EDITORIAL_INSTRUCTION_VERSION);
  const custom=routeFixture({requestBody:{...base,editorialInstructions:" เน้นภาพรวมและเงื่อนไขสำคัญ "}});assert.equal((await custom.run()).status,200);
  const customCall=(custom.events[1] as {body:Record<string,unknown>}).body;
  assert.equal(customCall.editorialInstructions,"เน้นภาพรวมและเงื่อนไขสำคัญ");assert.notEqual(customCall.triggerSource,call.triggerSource);assert.deepEqual(customCall.source,source);
});

test("full serialized prompt routes locally only within both source and context limits, otherwise one bounded OpenAI route", () => {
  const {helper}=fixture();
  const input=(text:string)=>({...source,body:[{_type:"block",style:"normal",children:[{_type:"span",text}]}]});
  for(const [text,provider] of [["รายละเอียด ".repeat(50),"local"],["ก".repeat(17_000),"openai"],["\n".repeat(23_000),"openai"],["ก".repeat(60_000),"openai"]]){
    const selected=helper.articleOverviewSource(input(text));const plan=helper.articleOverviewInferencePlan(selected,ARTICLE_OVERVIEW_DEFAULT_INSTRUCTIONS);
    assert.equal(plan.provider,provider);
    const prepared=code("เตรียมสรุปบทความ",{mode:"article-overview",...overviewMetadata,sourceRevision:"r1",promptVersion:"article-overview-v2",source:selected,inferenceProvider:provider});
    assert.equal(prepared.valid,true);assert.equal(prepared.provider,plan.provider);assert.deepEqual(prepared.messages,plan.messages);assert.deepEqual(prepared.format,plan.format);assert.equal(prepared.promptUpperBytes,plan.promptUpperBytes);
    assert.ok(prepared.inputTokenUpperBound<=200_000);assert.ok(prepared.inputTokenUpperBound*0.1/1_000_000+1024*0.5/1_000_000<0.03);
    assert.ok(prepared.messages[1].content.includes(JSON.stringify(selected)),"no source clipping at provider boundary");
  }
  assert.throws(()=>helper.articleOverviewInferencePlan(helper.articleOverviewSource(input('"'.repeat(60_000)))),/SOURCE_TOO_LARGE/,"JSON escaping cannot bypass final prompt cap even below raw-source cap");
  const selected=helper.articleOverviewSource(source);
  assert.deepEqual(code("เตรียมสรุปบทความ",{mode:"article-overview",...overviewMetadata,sourceRevision:"r1",promptVersion:"article-overview-v2",source:selected,inferenceProvider:"openai"}),{status:"error",errorCategory:"invalid-input"},"server route is recomputed at workflow boundary");
});

test("native cloud branch fixes standard tier, nonstored strict output and one call; incomplete/refused/unbound errors never become summary", () => {
  const cloud=node("OpenAI · Article Overview");
  assert.equal(cloud.type,"n8n-nodes-base.httpRequest");assert.equal(cloud.typeVersion,4.5);assert.equal(cloud.parameters.url,"https://api.openai.com/v1/responses");assert.equal(cloud.parameters.method,"POST");
  assert.equal(cloud.parameters.authentication,"predefinedCredentialType");assert.equal(cloud.parameters.nodeCredentialType,"openAiApi");assert.equal(cloud.parameters.options.redirect.redirect.followRedirects,false);assert.equal(cloud.parameters.options.sendCredentialsOnCrossOriginRedirect,false);assert.equal(cloud.retryOnFail,false);assert.equal(cloud.maxTries,1);
  const {helper}=fixture();const plan=helper.articleOverviewInferencePlan({...source,body:[{_type:"block",children:[{_type:"span",text:"ก".repeat(17000)}]}]});
  const request=new Function("$", "return "+cloud.parameters.jsonBody.slice(3,-2))(()=>({item:{json:{...plan,provider:"openai"}}}));
  assert.equal(request.model,"gpt-6-luna");assert.equal(request.service_tier,"default");assert.equal(request.store,false);assert.equal(request.max_output_tokens,1024);assert.equal(request.text.format.strict,true);assert.deepEqual(request.input,plan.messages);assert.deepEqual(request.text.format.schema,plan.format);
  assert.ok(JSON.stringify(request).replace(/[^\x00-\x7F]/g,"xxx").length<=plan.inputTokenUpperBound,"actual complete wire body is within the reserved upper bound");
  assert.equal(cloud.credentials.openAiApi.id,"OWNER_APPROVED_OVERVIEW_BINDING_REQUIRED","source carries only an unbound owner-approval placeholder");
  const prep={valid:true,provider:"openai",inputTokenUpperBound:190000,maxCostUsd:0.03,...overviewMetadata,sourceRevision:"r1",promptVersion:"article-overview-v2",source:JSON.stringify(source)};
  const response={status:"completed",store:false,service_tier:"default",output:[{type:"message",content:[{type:"output_text",text:JSON.stringify({points:summary.split("\n")})}]}]};
  const normalized=code("อ่านผล OpenAI Overview",response,prep);assert.equal(normalized.done,true);
  const final=code("ตรวจสรุปบทความ",normalized,prep);assert.equal(final.status,"generated");assert.equal(final.requestId,overviewMetadata.requestId);assert.equal(final.instructionHash,instructionHash);assert.equal(final.editorialInstructionVersion,EDITORIAL_INSTRUCTION_VERSION);
  for(const bad of [{error:"missing-credential"},{...response,status:"incomplete"},{...response,store:true},{...response,service_tier:"priority"},{...response,incomplete_details:{reason:"max_output_tokens"}},{...response,output:[{content:[{type:"refusal",refusal:"refused"}]}]}])assert.deepEqual(code("อ่านผล OpenAI Overview",bad,prep),{error:"model-unavailable"});
});

test("workflow and API bind trusted request, preferences hash and version; model cannot forge metadata", async () => {
  const base={mode:"article-overview",...overviewMetadata,sourceRevision:"r1",promptVersion:"article-overview-v2",source};
  for(const change of [{instructionHash:"bad"},{editorialInstructionVersion:"future"},{triggerSource:"sanity:attacker"}])assert.deepEqual(code("เตรียมสรุปบทความ",{...base,...change}),{status:"error",errorCategory:"invalid-input"});
  for(const change of [{requestId:"00000000-0000-4000-8000-000000000001"},{instructionHash:"0".repeat(64)},{editorialInstructionVersion:"future"}]){
    const f=routeFixture({result:{status:"generated",summary,sourceRevision:"r1",promptVersion:"article-overview-v2",...change} as never});assert.equal((await f.run()).status,502);assert.equal(f.events.length,2,"mismatched result is never written to Draft");
  }
});


test("API rejects source or final escaped prompt exceeding cap before any inference request", async () => {
  for(const text of ["ก".repeat(70000),'"'.repeat(60000)]) {
    const f=routeFixture({routeSource:{...source,body:[{_type:"block",style:"normal",children:[{_type:"span",text}]}]}});
    assert.equal((await f.run()).status,413);assert.deepEqual(f.events,["read"]);
  }
});

test("pure-object HTTP expression preserves the previous bounded cloud body; actual Prep/IF graph fences every rejected input", () => {
  const previous="={{ (()=>{const data=$('เตรียมสรุปบทความ').item.json;if(data.provider!=='openai'||data.inputTokenUpperBound>200000||data.maxCostUsd!==0.03)throw new Error('overview-budget-invalid');return {model:'gpt-6-luna',input:data.messages,service_tier:'default',store:false,max_output_tokens:1024,reasoning:{effort:'low'},text:{format:{type:'json_schema',name:'article_overview_v2',schema:data.format,strict:true}}};})() }}";
  const current=node("OpenAI · Article Overview").parameters.jsonBody;
  assert.doesNotMatch(current,/=>|\bconst\b|\bthrow\b|\breturn\b/);
  const evaluate=(expression:string,data:unknown)=>new Function("$","return "+expression.slice(3,-2))(()=>({item:{json:data}}));
  const {helper}=fixture();
  for(const [text,preference] of [["ก".repeat(17000),undefined],["ก".repeat(60000),"เน้นภาพรวมและเงื่อนไขสำคัญ"],['"'.repeat(24000),"ใช้ภาษาธรรมชาติ"],["\n".repeat(23000),"ก".repeat(200)]]){
    const selected=helper.articleOverviewSource({...source,body:[{_type:"block",children:[{_type:"span",text}]}]});
    const plan=helper.articleOverviewInferencePlan(selected,preference);assert.equal(plan.provider,"openai");
    assert.deepEqual(evaluate(current,plan),evaluate(previous,plan),"all fixed wire fields, full text, schema and preferences remain identical");
  }
  const condition=(name:string,data:unknown)=>{const gate=node(name).parameters.conditions.conditions[0];const left=new Function("$json","return "+gate.leftValue.slice(3,-2))(data);if(gate.operator.type==="boolean"){assert.equal(gate.operator.operation,"true");return left===true;}assert.equal(gate.operator.type,"string");assert.equal(gate.operator.operation,"equals");return left===gate.rightValue;};
  const path=(input:unknown)=>{const prepared=code("เตรียมสรุปบทความ",input);const ready=condition("ข้อมูลสรุปพร้อม?",prepared);const target=workflow.connections["ข้อมูลสรุปพร้อม?"].main[ready?0:1][0].node;if(!ready)return[target];assert.equal(target,"สรุปด้วย Local?");return[target,workflow.connections[target].main[condition(target,prepared)?0:1][0].node];};
  const base={mode:"article-overview",...overviewMetadata,sourceRevision:"r1",promptVersion:"article-overview-v2",source};
  assert.deepEqual(path(base),["สรุปด้วย Local?","Ollama · Article Overview"]);
  const cloudSource={...source,body:[{_type:"block",children:[{_type:"span",text:"ก".repeat(17000)}]}]};
  assert.deepEqual(path({...base,source:cloudSource,inferenceProvider:"openai"}),["สรุปด้วย Local?","OpenAI · Article Overview"]);
  for(const input of [null,{}, {...base,inferenceProvider:"openai"},{...base,instructionHash:"bad"},{...base,editorialInstructionVersion:"future"},{...base,source:{...source,body:["untyped"]}},{...base,source:{...source,body:[{_type:"block",children:[{_type:"span",text:"ก".repeat(70000)}]}]}},{...base,source:{...source,body:[{_type:"block",children:[{_type:"span",text:'"'.repeat(60000)}]}]}}])assert.deepEqual(path(input),["ตอบสรุปบทความ"],"invalid/oversize/version/hash/provider failures cannot reach either inference HTTP node");
});
