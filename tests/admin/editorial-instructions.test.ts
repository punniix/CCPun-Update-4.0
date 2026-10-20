import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  ARTICLE_OVERVIEW_DEFAULT_INSTRUCTIONS, EDITORIAL_INSTRUCTION_VERSION,
  LINE_TITLE_DEFAULT_INSTRUCTIONS, LINE_DESCRIPTION_DEFAULT_INSTRUCTIONS,
  editorialInstructionSchema, lineEditorialInstructionsSchema,
  resolveLineEditorialInstructions, resolveOverviewEditorialInstructions,
} from "../../lib/local-ai/editorial-instructions";

test("separate editable field defaults fit the actual Unicode and byte budgets without clipping", () => {
  const defaults = [LINE_TITLE_DEFAULT_INSTRUCTIONS, LINE_DESCRIPTION_DEFAULT_INSTRUCTIONS, ARTICLE_OVERVIEW_DEFAULT_INSTRUCTIONS];
  assert.equal(new Set(defaults).size,3);
  for (const value of defaults) assert.equal(editorialInstructionSchema.parse(value),value);
  assert.deepEqual(resolveLineEditorialInstructions(),{lineTitle:defaults[0],lineDescription:defaults[1]});
  assert.equal(resolveOverviewEditorialInstructions(),defaults[2]);
  assert.equal(editorialInstructionSchema.parse(" กิ้👩‍💻 "),"กิ้👩‍💻");
  assert.ok(editorialInstructionSchema.safeParse("ก".repeat(200)).success);
  assert.ok(!editorialInstructionSchema.safeParse("ก".repeat(201)).success);
  assert.ok(!editorialInstructionSchema.safeParse("กิ้".repeat(100)).success,"UTF-8 budget is independent of grapheme budget");
  for (const value of [null,{},12,"", " \n\t ","owner@example.com","081-234-5678"]) assert.ok(!editorialInstructionSchema.safeParse(value).success);
  for (const value of [null,[],"text",{unknown:"preference"},{lineTitle:""},{lineDescription:7}]) assert.ok(!lineEditorialInstructionsSchema.safeParse(value).success);
});

test("normalised effective preferences and fixed version bind replay identity, never client configuration", () => {
  const digest=(value: unknown)=>createHash("sha256").update(JSON.stringify([EDITORIAL_INSTRUCTION_VERSION,value])).digest("hex");
  assert.equal(digest(resolveLineEditorialInstructions()),digest(resolveLineEditorialInstructions({})));
  assert.equal(digest(resolveLineEditorialInstructions({lineTitle:" ชัดเจน "})),digest(resolveLineEditorialInstructions({lineTitle:"ชัดเจน"})));
  assert.notEqual(digest(resolveLineEditorialInstructions()),digest(resolveLineEditorialInstructions({lineTitle:"เน้นภาพรวม"})));
  assert.notEqual(digest(resolveOverviewEditorialInstructions()),digest(resolveOverviewEditorialInstructions("เน้นภาพรวม")));
  assert.equal(EDITORIAL_INSTRUCTION_VERSION,"field-editorial-v1");
});

test("Studio LINE dialog exposes separate defaults before Gen, sends only missing-field preferences, and reset stays transient", async () => {
  const React=await import("react");
  const {renderToStaticMarkup}=await import("react-dom/server");
  const {loadFixtureModule}=await import("../../qa/phase1-fixture-loader.mjs");
  const values:unknown[]=[];let cursor=0;
  const hooks={...React,useState:(initial:unknown)=>{const index=cursor++;if(!(index in values))values[index]=initial;return[values[index],(next:unknown)=>{values[index]=next;}];},useRef:(initial:unknown)=>{const index=cursor++;if(!(index in values))values[index]={current:initial};return values[index];},useEffect:()=>{}};
  const fixtureModule=loadFixtureModule("cms/sanity/policy/article-line-copy-action.tsx",{mocks:new Map<string,unknown>([["react",hooks],["sanity",{useSyncState:()=>({isSyncing:false})}]])});
  type Element=React.ReactElement<{children?:React.ReactNode;value?:string;onChange?:(event:{currentTarget:{value:string}})=>void;onClick?:()=>void}>;
  function elements(value:React.ReactNode):Element[]{return React.Children.toArray(value).flatMap(child=>{if(!React.isValidElement(child))return[];const element=child as Element;if(typeof element.type==="function")return elements((element.type as (props:unknown)=>React.ReactNode)(element.props));return[element,...elements(element.props.children)];});}
  const component=fixtureModule.createGenerateArticleLineCopyAction();
  const props={id:"article",type:"article",draft:{_rev:"r1",lineTitle:"Existing title",lineDescription:""},published:null,onComplete:()=>{}};
  const render=()=>{cursor=0;return component(props);};
  const previous=globalThis.fetch;const bodies:Record<string,unknown>[]=[];
  globalThis.fetch=async (_url,init)=>{bodies.push(JSON.parse(String(init?.body)));return Response.json({status:"applied"});};
  try{
    let action=render();action.onHandle();assert.equal(bodies.length,0,"opening preferences does not generate");action=render();
    const html=renderToStaticMarkup(action.dialog.content);assert.ok(html.includes(LINE_DESCRIPTION_DEFAULT_INSTRUCTIONS));assert.ok(!html.includes("คำแนะนำสำหรับ LINE Title"),"filled title stays untouched");
    let controls=elements(action.dialog.content);assert.equal(controls.filter(e=>e.type==="textarea").length,1);
    controls.find(e=>e.type==="textarea")!.props.onChange!({currentTarget:{value:"เน้นประเด็นหลัก"}});action=render();controls=elements(action.dialog.content);
    controls.filter(e=>e.type==="button").at(-1)!.props.onClick!();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(bodies.length,1);assert.deepEqual(bodies[0].editorialInstructions,{lineDescription:"เน้นประเด็นหลัก"});
    action=render();action.onHandle();action=render();controls=elements(action.dialog.content);
    controls.find(e=>e.type==="button")!.props.onClick!();action=render();assert.ok(renderToStaticMarkup(action.dialog.content).includes(LINE_DESCRIPTION_DEFAULT_INSTRUCTIONS));assert.equal(bodies.length,1,"reset does not generate or persist");
  }finally{globalThis.fetch=previous;}
});

test("actual n8n preferences remain separate style data, preserve legacy calls and reject malformed controls", async () => {
  const {readFileSync}=await import("node:fs");
  const workflow=JSON.parse(readFileSync("workers/local-ai/n8n/line-card-copy.direct.json","utf8"));
  const node=(name:string)=>workflow.nodes.find((entry:{name:string})=>entry.name===name);
  const prep=(raw:unknown)=>new Function("$input","$execution","Buffer",node("เตรียมงาน LINE").parameters.jsCode)({first:()=>({json:raw})},{id:"synthetic"},Buffer)[0].json;
  const source={id:"article",revision:"r1",slug:"article",title:"บทความตัวอย่าง",category:"การเงิน"};
  const input={requestId:"11111111-1111-4111-8111-111111111111",triggerSource:"sanity",source,body:"เนื้อหาบทความ ".repeat(150)};
  const legacy=prep(input);assert.equal(legacy.status,"running");assert.equal(legacy.editorialInstructions,undefined);
  const preferences=resolveLineEditorialInstructions();
  const hash=createHash("sha256").update(JSON.stringify([EDITORIAL_INSTRUCTION_VERSION,preferences])).digest("hex");
  const custom={...input,editorialInstructions:preferences,editorialInstructionVersion:EDITORIAL_INSTRUCTION_VERSION,triggerSource:`sanity:${EDITORIAL_INSTRUCTION_VERSION}:${hash}`};
  const prepared=prep(custom);assert.equal(prepared.status,"running");assert.deepEqual(prepared.editorialInstructions,preferences);
  for(const change of [{editorialInstructions:{lineTitle:" "}},{editorialInstructions:{lineTitle:"owner@example.com"}},{editorialInstructions:{unknown:"field"}},{editorialInstructionVersion:"other"},{triggerSource:"attacker"}])assert.equal(prep({...custom,...change}).status,"error");
  for(const name of ["Ollama · Candidate A","Ollama · Candidate B","Ollama · Candidate C","Ollama · Improve A","Ollama · Improve B","Ollama · เลือก Candidate"]){
    const evaluate=(data:unknown)=>new Function("$","$json","return "+node(name).parameters.jsonBody.slice(3,-2))(()=>({item:{json:data}}),data);
    const data={...prepared,existingLineTitle:"หัวข้อเดิม",existingLineDescription:"คำโปรยเดิม",validTitleCandidates:["หัวข้อ"],validDescriptionCandidates:["คำโปรย"]};
    const request=evaluate(data);assert.equal(request.options.num_ctx,8192);assert.ok(request.messages[0].content.includes("untrusted style/goal"));assert.ok(request.messages[1].content.includes(JSON.stringify(preferences)));assert.equal(request.model,"qwen3:1.7b");
    assert.throws(()=>evaluate({...data,title:"ก".repeat(20000),existingLineDescription:"ก".repeat(20000),validDescriptionCandidates:["ก".repeat(20000)]}),/editorial-input-too-large/);
    const old=evaluate({...data,editorialInstructions:undefined});assert.ok(old.options.num_ctx<8192);assert.ok(!old.messages[1].content.includes("EDITORIAL PREFERENCES"));
  }
  const improve=prep({...custom,body:undefined,mode:"improve-existing",existingLineTitle:"ก".repeat(30),existingLineDescription:"ข".repeat(60)});
  // Improve forbids a body key entirely, even undefined in a synthetic non-JSON object.
  const {body:discarded,...improveInput}={...custom,mode:"improve-existing",existingLineTitle:"ก".repeat(30),existingLineDescription:"ข".repeat(60)};void discarded;
  assert.equal(improve.status,"error");const good=prep(improveInput);
  const row={requestKey:good.requestKey,articleId:source.id,articleRevision:source.revision,triggerSource:good.triggerSource,status:"generated",lineTitle:"ก".repeat(30),lineDescription:"ข".repeat(60)};
  const replay=(base:unknown)=>new Function("$","$input",node("ตรวจ Replay Improve").parameters.jsCode)(()=>({item:{json:base}}),{first:()=>({json:row})})[0].json;
  assert.equal(replay(good).replayState,"cached");
  const changed=prep({...improveInput,editorialInstructions:{lineTitle:"แนวใหม่"},triggerSource:`sanity:${EDITORIAL_INSTRUCTION_VERSION}:${"0".repeat(64)}`});assert.equal(replay(changed).errorCategory,"idempotency-conflict");
});
