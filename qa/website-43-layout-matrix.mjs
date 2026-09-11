import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

// Read-only UI QA against an explicit Preview; no CMS writes or runtime capture endpoints.
const origin = new URL(process.env.WEBSITE43_BASE_URL ?? 'http://127.0.0.1:3100');
if (!['127.0.0.1', 'localhost'].includes(origin.hostname) && !origin.hostname.endsWith('.vercel.app')) throw new Error('An isolated localhost/UAT Preview is required.');
const prefix = '/preview/website-4-3';
const cdp = process.env.CDP_HTTP ?? 'http://127.0.0.1:9222';
const out = path.resolve(process.env.QA_OUTPUT_DIR ?? 'qa/website-43-layout-latest');
const head = process.env.QA_HEAD_SHA ?? 'unverified';
const deployment = process.env.QA_DEPLOYMENT_ID ?? 'unverified';
const widths = (process.env.QA_WIDTHS ?? '390,600,820,1024,1100,1280,1440,1728,1920').split(',').map(Number);
const routeFilter = process.env.QA_ROUTES?.split(',');
const capture = process.env.QA_CAPTURE !== '0';
const overlayScrollbars = process.env.QA_OVERLAY_SCROLLBARS === '1';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const canonical = [390, 820, 1440, 1728, 1920];
const routes = [
  ['S01', '/'], ['S02', '/blog/'], ['S03', null],
  ['S04', '/tools/financial-health-check/'], ['S05', '/ci-planning/'],
  ['S06', '/privacy/'], ['S07', '/cookie-policy/'], ['S08', '/404/'],
];

class CDP {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.url);
    this.ws.addEventListener('message', event => {
      const m = JSON.parse(event.data); const p = this.pending.get(m.id);
      if (!p) return;
      this.pending.delete(m.id); clearTimeout(p.timer);
      if (m.error) p.reject(new Error(JSON.stringify(m.error))); else p.resolve(m.result);
    });
    await new Promise((resolve, reject) => { this.ws.addEventListener('open', resolve, {once:true}); this.ws.addEventListener('error', reject, {once:true}); });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 60000);
      this.pending.set(id, {resolve, reject, timer}); this.ws.send(JSON.stringify({id, method, params}));
    });
  }
  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', {expression, awaitPromise:true, returnByValue:true});
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  }
  close() { this.ws?.close(); }
}

async function navigate(client, url) {
  await client.send('Page.bringToFront');
  await client.send('Page.navigate', {url});
  for (let n=0; n<120; n++) {
    await sleep(150);
    const ready = await client.evaluate(`location.href.startsWith(${JSON.stringify(url)}) && document.readyState === 'complete' && !!document.querySelector('main h1')`).catch(() => false);
    if (ready) { await client.evaluate('document.fonts.ready.then(() => true)'); await sleep(200); return; }
  }
  throw new Error(`Page identity/readiness failed for ${url}`);
}

async function hydrateImages(client) {
  return client.evaluate(`(async () => {
    const pause = ms => new Promise(r => setTimeout(r,ms));
    for (let y=0; y<document.documentElement.scrollHeight; y+=Math.max(400,innerHeight-150)) { scrollTo(0,y); await pause(80); }
    scrollTo(0,0);
    const visible = img => { const r=img.getBoundingClientRect(); if(r.width<1||r.height<1||r.right<=0||r.left>=document.documentElement.clientWidth)return false; let p=img.parentElement; while(p&&p!==document.body){const s=getComputedStyle(p),b=p.getBoundingClientRect(); if((s.overflowX==='hidden'||s.overflowX==='clip'||s.overflowX==='auto')&&(r.right<=b.left||r.left>=b.right))return false; p=p.parentElement;} return true; };
    const images=[...document.images].filter(visible);
    for(const img of images){if(!img.complete||!img.naturalWidth){img.scrollIntoView({block:'center'});await pause(150);await Promise.race([img.decode().catch(()=>null),pause(5000)]);}}
    scrollTo(0,0);
    await Promise.race([Promise.all(images.map(i=>i.decode().catch(()=>null))),pause(10000)]);
    await pause(350);
    return images.map(i=>({src:i.currentSrc||i.src,naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight,complete:i.complete}));
  })()`);
}

const measurement = `(() => {
  const doc=document.documentElement, vw=doc.clientWidth;
  const cls=el=>String(el.className||'').split(/\\s+/).map(c=>c.split('__').at(-1)).join(' ');
  const box=el=>{const r=el.getBoundingClientRect();return {class:cls(el),x:+r.x.toFixed(3),y:+(r.y+scrollY).toFixed(3),width:+r.width.toFixed(3),height:+r.height.toFixed(3),right:+r.right.toFixed(3),balance:+Math.abs(r.left-(vw-r.right)).toFixed(3)};};
  const root=document.querySelector('main')?.parentElement;
  const tokens=['inner','aboutInner','narrow','articleReadingGrid','legalGrid','calculatorHeader','calculatorStage'];
  const shells=[...document.querySelectorAll('[class]')].filter(el=>{const c=cls(el).split(' ');return c.some(v=>tokens.includes(v))&&el.getBoundingClientRect().width>0;}).map(box);
  const nav=[...document.querySelectorAll('[class]')].find(el=>cls(el).split(' ').includes('nav')&&el.getBoundingClientRect().width>0);
  const hero=[...document.querySelectorAll('[class]')].find(el=>['homeHeroCopy','blogHeroCopy','toolHeroCopy'].some(v=>cls(el).split(' ').includes(v)));
  const children=hero?[...hero.children].filter(el=>el.getBoundingClientRect().width>0).map(box):[];
  const main=document.querySelector('main');
  const text=[...main.querySelectorAll('h1,h2,h3,p,button,summary,label')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden';}).map(el=>({...box(el),text:el.innerText?.trim().slice(0,120),scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}));
  return {url:location.href,title:document.title,h1:main.querySelector('h1')?.innerText,innerWidth,clientWidth:vw,dpr:devicePixelRatio,scrollWidth:doc.scrollWidth,scrollHeight:doc.scrollHeight,root:root?box(root):null,nav:nav?box(nav):null,hero:hero?box(hero):null,heroChildren:children,shells,textOverflow:text.filter(t=>t.scrollWidth>t.clientWidth+2),robots:document.querySelector('meta[name="robots"]')?.content,images:[...document.images].map(i=>({...box(i),src:i.currentSrc||i.src,nw:i.naturalWidth,complete:i.complete}))};
})()`;

async function main() {
  await mkdir(out,{recursive:true});
  const targetResponse=await fetch(`${cdp}/json/new?about:blank`,{method:'PUT'});
  if(!targetResponse.ok)throw new Error(`Chrome target: ${targetResponse.status}`);
  const target=await targetResponse.json(); const client=new CDP(target.webSocketDebuggerUrl);
  const report={head,deployment,origin:origin.origin,generatedAt:new Date().toISOString(),browser:null,overlayScrollbars,routes:[],unknownRoute:null,summary:{cases:0,failed:0}};
  try {
    await client.connect(); await client.send('Page.enable'); await client.send('Runtime.enable');
    report.browser=await client.send('Browser.getVersion');
    if(overlayScrollbars)await client.send('Emulation.setScrollbarsHidden',{hidden:true});
    await navigate(client,`${origin.origin}${prefix}/blog/`);
    const article=await client.evaluate(`(()=>{const links=[...document.querySelectorAll('a[href]')];return links.find(a=>a.getAttribute('href')?.includes('/blog/')&&a.getAttribute('href')?.includes('/aia-vitality'))?.getAttribute('href')||links.find(a=>a.querySelector('h2')&&a.getAttribute('href')?.split('/').filter(Boolean).length>=6)?.getAttribute('href')})()`);
    if(!article)throw new Error('No real article link found in archive');
    routes[2][1]=article.slice(prefix.length).replace(/\\?$/, '');
    for (const [screen,route] of routes.filter(([s])=>!routeFilter||routeFilter.includes(s))) {
      for (const width of widths) {
        const height=width===390?844:width===820?1180:1000;
        await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<640,screenWidth:width,screenHeight:height});
        const url=`${origin.origin}${prefix}${route.endsWith('/')?route:route+'/'}`;
        await navigate(client,url); const images=await hydrateImages(client);
        const metrics=await client.evaluate(measurement);
        const issues=[];
        if(metrics.innerWidth!==width)issues.push('viewport mismatch');
        if(metrics.scrollWidth>metrics.clientWidth+1)issues.push('root horizontal overflow');
        if(!metrics.h1||(!['S08'].includes(screen)&&metrics.h1.includes('ไม่พบหน้า')))issues.push('page identity mismatch');
        if(!metrics.robots?.includes('noindex'))issues.push('Preview noindex missing');
        if(images.some(i=>!i.complete||!i.naturalWidth))issues.push('visible image not loaded');
        for(const s of metrics.shells)if(s.balance>1.5)issues.push(`unbalanced ${s.class}: ${s.balance}px`);
        if(metrics.hero && metrics.shells.length && width>=1024){const edge=metrics.shells.find(s=>s.class==='inner')?.x;if(edge!==undefined&&Math.abs(metrics.hero.x-edge)>1.5)issues.push(`hero/shell anchor drift: ${(metrics.hero.x-edge).toFixed(2)}px`);}
        if(metrics.hero)for(const child of metrics.heroChildren)if(Math.abs(child.x-metrics.hero.x)>1.5)issues.push(`hero child anchor drift: ${child.class}`);
        const entry={screen,width,height,url,metrics,visibleImages:images,issues};
        if(capture&&canonical.includes(width)){
          const png=await client.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:true,clip:{x:0,y:0,width,height:metrics.scrollHeight,scale:1}});
          const bytes=Buffer.from(png.data,'base64');const name=`${screen}-${width}.png`;
          await writeFile(path.join(out,name),bytes);entry.screenshot={file:name,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),sha256:createHash('sha256').update(bytes).digest('hex')};
        }
        report.routes.push(entry); report.summary.cases++; if(issues.length)report.summary.failed++;
        console.log(JSON.stringify({screen,width,clientWidth:metrics.clientWidth,issues,images:images.length,screenshot:entry.screenshot?.file}));
        await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
      }
    }
    await client.send('Page.navigate',{url:`${origin.origin}${prefix}/qa-unknown-route-pr93/`});await sleep(1500);
    report.unknownRoute=await client.evaluate(`({url:location.href,title:document.title,h1:document.querySelector('h1')?.innerText,body:document.body.innerText.slice(0,240)})`);
    console.log(JSON.stringify(report.summary));
    if(report.summary.failed)process.exitCode=1;
  } finally {
    await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)); client.close();
    await fetch(`${cdp}/json/close/${target.id}`).catch(()=>null);
  }
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
