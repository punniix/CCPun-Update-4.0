import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import { LINE_CHAT_DEFAULTS, LINE_CHAT_DEFAULT_HEADLINE, LINE_CHAT_RESULT_TOPICS, chatContextForPath, hasVisibleCode, resolveChatPanel, resultChatHref, selectChatConfigForPage, type LineChatResultTool } from "../../lib/line/chat-panel";

const require = createRequire(import.meta.url);
const { JSDOM } = require("jsdom");
const React = require("react");
const { createRoot } = require("react-dom/client");
const { renderToString } = require("react-dom/server");
const { loadFixtureModule } = require("../../qa/phase1-fixture-loader.mjs");
const { websiteV5ResultLineSources, websiteV5PhaseASources, isWebsiteV5ReviewedSuccessor } = require("../../qa/website-v5-phase-a-proof.mjs");
const { assertProductionCmsOwner, cmsNativeFollowupOwners } = require("../../qa/production-cms-source-proof.mjs");
const now = new Date("2026-10-26T12:00:00Z");
const context = (tool: LineChatResultTool) => chatContextForPath(tool === "ci" ? "/ci-planning/" : "/tools/financial-health-check/");
const message = (href: string) => decodeURIComponent(href.split("/?")[1]);

test("result intent stays first through a full campaign and page override; campaign metadata and owner switches remain authoritative", () => {
  for (const tool of ["ci", "fhc"] as const) {
    const config = structuredClone(LINE_CHAT_DEFAULTS);
    config.campaigns = [{code:"result-review",refCode:"RS",title:"Review",type:"temporary",startsAt:"2026-01-01",endsAt:"2027-01-01",pageGroups:["all"],pinnedTopicIds:["book-a-chat","tax-deduction","health-plan","ci-plan"],paused:false,headline:"หัวข้อแคมเปญ"}];
    config.pageOverrides = [{key:`page:${context(tool).routeKey}`,title:"Tool",enabled:true,hideSource:true,topics:[{kind:"library",id:"health-plan"}]}];
    config.placements = config.placements.map(item => item.key === context(tool).pageGroup ? {...item,topicIds:["health-plan"]} : item);
    const slice = selectChatConfigForPage(config,context(tool),now);
    assert.ok(slice.topics.some(topic => topic.id === LINE_CHAT_RESULT_TOPICS[tool]),"result topic is retained even when the owner placement omits it");
    const panel = resolveChatPanel({...context(tool),config:slice,resultTool:tool,utmCampaign:"result-review",now,consentGiven:false});
    assert.equal(panel.mode,"panel");
    if (panel.mode !== "panel") continue;
    assert.equal(panel.topics[0].id,LINE_CHAT_RESULT_TOPICS[tool]);
    assert.equal(panel.topics[0].href,resultChatHref(tool));
    assert.equal(panel.campaignCode,"result-review");
    assert.equal(panel.headline,"หัวข้อแคมเปญ");
    assert.equal(panel.layer,"page");
    assert.equal(panel.source,"campaign-utm");
    assert.equal(panel.topics.at(-1)!.id,"type-own");
    assert.ok(!hasVisibleCode(panel.topics[0].prefill));
    assert.doesNotMatch(panel.topics[0].prefill,/\d/);
    assert.match(panel.topics[0].prefill,/ใช้เครื่องมือ.+มาครับ/);
    const ordinary=resolveChatPanel({...context(tool),config:slice,utmCampaign:"result-review",now,consentGiven:false});
    assert.ok(ordinary.mode === "panel" && !ordinary.topics[0].prefill.includes("ใช้เครื่องมือ"),"ordinary dock topics still honor page hideSource");
    const emptyTemplate={...slice,sourceTemplates:{article:"",tool:""}};
    const emptyPanel=resolveChatPanel({...context(tool),config:emptyTemplate,resultTool:tool,now,consentGiven:false});
    assert.ok(emptyPanel.mode === "panel" && emptyPanel.topics[0].href===resultChatHref(tool),"empty templates cannot remove the required result-tool origin");
    const customTemplate={...slice,sourceTemplates:{article:"",tool:"มาจากเครื่องมือ{toolName}ครับ"}};
    const customPanel=resolveChatPanel({...context(tool),config:customTemplate,resultTool:tool,now,consentGiven:false});
    assert.ok(customPanel.mode === "panel" && /มาจากเครื่องมือ.+ครับ$/.test(customPanel.topics[0].prefill),"nonempty configured tool origin stays authoritative for result intent");
    const before = JSON.stringify(config);
    resolveChatPanel({...context(tool),config,resultTool:tool,now,consentGiven:true});
    assert.equal(JSON.stringify(config),before,"selection never mutates owner config");
    assert.equal(resolveChatPanel({...context(tool),config:{...slice,enabled:false},resultTool:tool,now,consentGiven:false}).mode,"plain");
    const disabled = {...config,topics:config.topics.map(topic => topic.id === LINE_CHAT_RESULT_TOPICS[tool] ? {...topic,enabled:false} : topic)};
    const disabledPanel=resolveChatPanel({...context(tool),config:selectChatConfigForPage(disabled,context(tool),now),resultTool:tool,now,consentGiven:false});
    assert.ok(disabledPanel.mode === "panel" && !disabledPanel.topics.some(topic => topic.id === LINE_CHAT_RESULT_TOPICS[tool]),"explicitly disabled topics are not resurrected");
    const untrusted = resolveChatPanel({...context(tool),config,resultTool:"987654321" as LineChatResultTool,now,consentGiven:false});
    assert.ok(!JSON.stringify(untrusted).includes("987654321"),"untrusted tool tokens never become message content");
  }
});

test("only the exact approved result CTA source successors pass; old pins and unrelated edits remain protected", () => {
  for (const [file, entry] of Object.entries(websiteV5ResultLineSources) as [string,{before:string;after:string}][]) {
    assert.equal(entry.before,file.includes("CIResult") ? websiteV5PhaseASources[file].after : cmsNativeFollowupOwners[file].after);
    const source=readFileSync(new URL(`../../${file}`,import.meta.url),"utf8");
    assert.equal(isWebsiteV5ReviewedSuccessor(file,source),true);
    assert.equal(assertProductionCmsOwner(file,source),true);
    for(const changed of [source+"\n",source.replace("resultChatHref", "resultChatHrefChanged")]) {
      assert.notEqual(changed,source);
      assert.equal(isWebsiteV5ReviewedSuccessor(file,changed),false);
      assert.throws(()=>assertProductionCmsOwner(file,changed));
    }
  }
});

test("result link SSR and one existing dock/panel event carry only a bounded intent, with no calculator values", async () => {
  const dom=new JSDOM('<div id="root"></div>',{url:"http://localhost/"});
  const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,MutationObserver:dom.window.MutationObserver,CustomEvent:dom.window.CustomEvent,Event:dom.window.Event,MouseEvent:dom.window.MouseEvent,IS_REACT_ACT_ENVIRONMENT:true};
  const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const[key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,value,writable:true});
  dom.window.matchMedia=()=>({matches:true});
  dom.window.requestAnimationFrame=(fn:()=>void)=>dom.window.setTimeout(fn,0);
  dom.window.cancelAnimationFrame=(id:number)=>dom.window.clearTimeout(id);
  const events: {name:string;params:Record<string,unknown>}[]=[];
  const mocks=new Map<string,unknown>([
    ["./V5ChatDock.module.css",{__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})}],
    ["@/lib/analytics",{trackEvent:(name:string,params:Record<string,unknown>)=>events.push({name,params})}],
    ["@/lib/cookie-consent",{getConsentData:()=>null}],
    ["@/lib/acquisition",{getAttribution:()=>undefined}],
  ]);
  const Link=loadFixtureModule("components/layout/v5/V5ChatLink.tsx",{mocks}).default;
  const Dock=loadFixtureModule("components/layout/v5/V5ChatDock.tsx",{mocks}).default;
  const root=createRoot(dom.window.document.getElementById("root"));
  try {
    for(const tool of ["ci","fhc"] as const) {
      const href=resultChatHref(tool);
      const html=renderToString(React.createElement(Link,{href,resultTool:tool},LINE_CHAT_DEFAULT_HEADLINE));
      assert.match(html,/href="https:\/\/line\.me\/R\/oaMessage\/%40ccpun\/\?/);
      assert.doesNotMatch(html,/lin\.ee|aria-haspopup/);
      assert.doesNotMatch(message(href),/\d|987654321/);
      const details:Record<string,unknown>[]=[];
      const capture=(event:Event)=>{const detail=(event as CustomEvent).detail;details.push({trigger:detail.trigger,resultTool:detail.resultTool,keys:Object.keys(detail).sort()});};
      dom.window.addEventListener("ccpun:open-chat",capture);
      await React.act(async()=>root.render(React.createElement("div",null,
        React.createElement("main",{id:"main-content"},React.createElement("p",null,"987654321"),React.createElement(Link,{href,resultTool:tool},LINE_CHAT_DEFAULT_HEADLINE)),
        React.createElement(Dock,{config:LINE_CHAT_DEFAULTS,context:context(tool),fallbackHref:href}))));
      const resultLink=dom.window.document.querySelector("[data-v5-chat-link]");
      await React.act(async()=>{resultLink.dispatchEvent(new dom.window.MouseEvent("click",{bubbles:true,cancelable:true}));});
      assert.deepEqual(details,[{trigger:"article_cta",resultTool:tool,keys:["resultTool","returnTo","trigger"]}]);
      assert.equal(dom.window.document.querySelectorAll("#v5-chat-panel").length,1);
      assert.equal(dom.window.document.querySelector("[data-chat-topic]").getAttribute("href"),href);
      assert.equal(dom.window.document.querySelectorAll("[data-v5-chat-dock], [data-v5-chat-link]").length,2);
      assert.doesNotMatch(JSON.stringify(events),/987654321/);
      await React.act(async()=>{dom.window.dispatchEvent(new dom.window.KeyboardEvent("keydown",{key:"Escape",bubbles:true}));});
      assert.equal(dom.window.document.querySelectorAll("#v5-chat-panel").length,0);
      dom.window.removeEventListener("ccpun:open-chat",capture);
      await React.act(async()=>root.render(null));
    }
  } finally {
    await React.act(async()=>root.unmount());dom.window.close();
    for(const[key,descriptor]of previous)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);
  }
});
