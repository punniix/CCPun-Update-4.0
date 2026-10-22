import {spawn} from 'node:child_process';
import {writeFileSync,mkdirSync} from 'node:fs';
const port=9245;
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ['--headless=new','--disable-gpu','--no-first-run','--disable-extensions','--remote-debugging-port='+port,
  '--user-data-dir=/tmp/ccpun-signature-cdp-'+Date.now(),'about:blank'],{stdio:'ignore'});
let ws;
try{
  let tabs;
  for(let i=0;i<50;i++){try{tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();if(tabs[0]?.webSocketDebuggerUrl)break;}catch{}
    await new Promise(r=>setTimeout(r,150));}
  const page=tabs?.find(x=>x.type==='page' && x.webSocketDebuggerUrl);
  console.log('TABS',tabs?.map(x=>({type:x.type,url:x.url})));
  if(!page)throw Error('Chrome page target not ready');
  ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let counter=0;const pending=new Map();
  ws.onmessage=e=>{const msg=JSON.parse(e.data);if(pending.has(msg.id)){
    const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(Error(JSON.stringify(msg.error))):p.resolve(msg.result);}};
  function cmd(method,params={}){return new Promise((resolve,reject)=>{
    const id=++counter;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
  async function evaluate(expression){
    const r=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  }
  await cmd('Page.enable');
  await cmd('Runtime.enable');
  await cmd('Page.navigate',{url:'http://127.0.0.1:3156/blog/signature-article-preview/'});
  await new Promise(r=>setTimeout(r,1400));
  mkdirSync('/tmp/ccpun-signature-browser-qa',{recursive:true});
  for(const width of [320,390,820,1440]){
    await cmd('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<=390});
    await new Promise(r=>setTimeout(r,250));
    const value=await evaluate("(()=>{const roots=[...document.querySelectorAll('[data-ccpun-signature]')];const small=roots.flatMap(a=>[...a.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().height<44).map(b=>b.textContent.slice(0,24)));const overflow=roots.flatMap(a=>[...a.querySelectorAll('*')].filter(x=>{const r=x.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+2||r.left < -2)}).slice(0,3).map(x=>x.textContent.slice(0,26)));return {viewport:innerWidth,pageWidth:document.documentElement.scrollWidth,blocks:roots.length,small:small.slice(0,8),overflow:overflow.slice(0,8)};})()");
    console.log('DEVICE',JSON.stringify(value));
    if(value.blocks!==10||value.small.length||value.overflow.length)throw Error('Device QA failure '+JSON.stringify(value));
    if(width===390||width===1440){
      await evaluate("document.querySelector('[data-ccpun-signature=\"plan-explorer\"]').scrollIntoView({block:'center'});true");
      const shot=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      writeFileSync('/tmp/ccpun-signature-browser-qa/article-'+width+'.png',Buffer.from(shot.data,'base64'));
    }
  }
  const result=await evaluate("(async()=>{const root=document.querySelector('[data-ccpun-signature=\"plan-explorer\"]');const compare=[...root.querySelectorAll('button')].find(x=>x.textContent.includes('02 เปรียบเทียบ'));compare.click();await new Promise(r=>setTimeout(r,100));const selector=root.querySelector('button[aria-expanded]');selector.click();await new Promise(r=>setTimeout(r,100));const opened=selector.getAttribute('aria-expanded')==='true';const c=[...root.querySelectorAll('button')].find(x=>x.textContent.includes('ตัวเลือก C'));c?.click();await new Promise(r=>setTimeout(r,100));return {opened,selectedC:!!c,html:root.textContent.includes('ตัวเลือก C')};})()");
  console.log('INTERACTION',JSON.stringify(result));
  if(!result.opened||!result.selectedC)throw Error('Dropdown interaction failed');
  console.log('BROWSER_QA_PASS');
}finally{ws?.close();chrome.kill('SIGTERM');}
