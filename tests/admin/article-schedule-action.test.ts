import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { randomUUID } from "node:crypto";
import ts from "typescript";
import { articlePublishBlock } from "../../cms/sanity/policy/article-publication";

// Match the existing Studio-wrapper harness: only Sanity hooks are injected.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Bag = Record<string, any>;
const require = createRequire(import.meta.url);
const { JSDOM } = require("jsdom");
const source=readFileSync(new URL("../../cms/sanity/policy/article-schedule-action.tsx",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
async function mount(queued=false,ready=true,readFails=false) {
  const dom=new JSDOM("<div id='root'></div>");
  const previous={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch};
  const state: Bag={sync:{isSyncing:false},validation:{isValidating:false,validation:[]},calls:[],ready,readFails,
    row:queued?{generation:randomUUID(),rowVersion:2,status:"scheduled",scheduledAt:new Date(Date.now()+600_000).toISOString(),timezone:"Asia/Bangkok",mode:"publish",errorCode:null}:null};
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(_url:string,options:RequestInit={})=>{
    if(!options.method) return state.readFails?Response.json({error:"not-ready"},{status:503}):Response.json({ready:state.ready,mode:"publish",schedule:state.row});
    const body=JSON.parse(String(options.body));state.calls.push({method:options.method,body});
    state.row=options.method==="DELETE"?{...state.row,status:"cancelled",rowVersion:state.row.rowVersion+1}:
      {generation:body.requestId,rowVersion:(state.row?.rowVersion??0)+2,status:"scheduled",scheduledAt:new Date(`${body.scheduledLocal}:00+07:00`).toISOString(),timezone:"Asia/Bangkok",mode:"publish",errorCode:null};
    return Response.json({schedule:state.row},{status:options.method==="POST"?201:200});
  }});
  const root=createRoot(document.getElementById("root")!);const exports:Bag={};
  new Function("require","exports",compiled)((id:string)=>{
    if(id==="sanity")return{useSyncState:()=>state.sync,useValidationStatus:()=>state.validation};
    if(id==="./article-publication")return{articlePublishBlock};
    return require(id);
  },exports);
  const action=exports.createArticleScheduleAction("production-admin");let current:Bag;
  let props:Bag={id:"article-1",type:"article",draft:{_id:"drafts.article-1",_type:"article",_rev:"draft-1",review:{status:"approved"},slug:{current:"article-1"},category:{_ref:"category-1"}},published:null};
  function Probe(){current=action(props);return current?.dialog?.content??null;}
  const render=async(update:Bag={})=>{props={...props,...update};await act(async()=>root.render(createElement(Probe)));};
  await render();
  return {state,get result(){return current!;},get props(){return props;},render,
    open:async()=>{await act(async()=>current!.onHandle());},
    confirm:async()=>{const input=document.querySelector<HTMLInputElement>('input[type="checkbox"]');assert.ok(input);await act(async()=>input.click());},
    button:(text:string)=>{const button=Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((node)=>node.textContent?.includes(text));assert.ok(button,text);return button;},
    click:async(button:HTMLButtonElement)=>{await act(async()=>button.click());},
    close:async()=>{await act(async()=>root.unmount());dom.window.close();Object.assign(globalThis,previous);},
  };
}

test("mounted scheduler requires explicit confirmation and freezes the visible Draft and Live revisions",async()=>{
  const ui=await mount();try{
    await ui.open();assert.equal(ui.button("ยืนยันตั้งเวลา").disabled,true);
    await ui.confirm();assert.equal(ui.button("ยืนยันตั้งเวลา").disabled,false);
    await ui.render({draft:{...ui.props.draft,_rev:"changed"}});
    assert.equal(ui.button("ยืนยันตั้งเวลา").disabled,true);await ui.click(ui.button("ยืนยันตั้งเวลา"));assert.equal(ui.state.calls.length,0);
  }finally{await ui.close();}
});
test("mounted scheduler keeps cancellation usable after Draft removal and while activation is disabled",async()=>{
  const ui=await mount(true,false);try{
    const original=structuredClone(ui.state.row);await ui.open();await ui.render({draft:null});
    assert.equal(ui.result.disabled,false);assert.equal(ui.button("ยกเลิกคิวนี้").disabled,false);
    await ui.click(ui.button("ยกเลิกคิวนี้"));assert.equal(ui.state.calls.length,1);
    assert.deepEqual(ui.state.calls[0],{method:"DELETE",body:{expectedGeneration:original.generation,expectedVersion:original.rowVersion}});
  }finally{await ui.close();}
});
test("mounted scheduler blocks syncing validation errors and unavailable backend state",async()=>{
  for(const variant of ["sync","validation","unavailable"]){
    const ui=await mount(false,true,variant==="unavailable");try{
      await ui.open();await ui.confirm();
      if(variant==="sync")ui.state.sync.isSyncing=true;
      if(variant==="validation")ui.state.validation.validation=[{level:"error"}];
      await ui.render();assert.equal(ui.button("ยืนยันตั้งเวลา").disabled,true);assert.equal(ui.state.calls.length,0);
    }finally{await ui.close();}
  }
});
test("mounted scheduler suppresses duplicate clicks but gives a new confirmed reschedule a new request identity",async()=>{
  const ui=await mount();try{
    await ui.open();await ui.confirm();const button=ui.button("ยืนยันตั้งเวลา");
    await act(async()=>{button.click();button.click();});assert.equal(ui.state.calls.length,1);
    const first=ui.state.calls[0].body;assert.equal(first.draftRevision,"draft-1");assert.equal(first.publishedRevision,null);
    await ui.confirm();await ui.click(ui.button("ยืนยันตั้งเวลา"));assert.equal(ui.state.calls.length,2);
    assert.notEqual(ui.state.calls[1].body.requestId,first.requestId);
    assert.equal(ui.state.calls[1].body.expectedGeneration,first.requestId);
  }finally{await ui.close();}
});
