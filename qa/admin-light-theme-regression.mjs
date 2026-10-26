// Local component fixtures with candidate Admin CSS. No login bypass or data/provider requests.
// Run after the local-uat Admin build: PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node qa/admin-light-theme-regression.mjs
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import ts from 'typescript';

const root = process.cwd();
const output = path.resolve('qa/artifacts/c2-theme-20261026');
const source = await readFile('apps/admin/app/(control-plane)/layout.tsx', 'utf8');
const start = source.indexOf('const NAV_ITEMS');
const navSource = source.slice(start, source.indexOf('\n];', start) + 3).replace(/^const NAV_ITEMS:[\s\S]*? = \[/, 'exports.nav = [');
const navModule = { exports: {} };
new Function('exports', ts.transpileModule(navSource, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(navModule.exports);
const sourceFiles = (await Promise.all(['features/admin', 'apps/admin/app/(control-plane)'].map(async (dir) => (await readdir(dir, { recursive: true })).filter((file) => /\.tsx$/.test(file)).map((file) => path.join(dir, file))))).flat();
const colors = new Set();
for (const file of sourceFiles) {
  const text = await readFile(file, 'utf8');
  for (const token of text.match(/(?:text|bg|border)-(?:\[#[0-9a-fA-F]+\]|white|black|(?:navy|gold|amber|emerald|sky|rose|red|violet|cyan)-\d+)(?:\/(?:\[[0-9.]+\]|[0-9]+))?/g) ?? []) colors.add(token);
}
const entry = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { AdminProtectedChrome } from '@/features/admin/components/AdminProtectedChrome';
import LineChatManager from '@/features/admin/line/LineChatManager';
import { LINE_CHAT_DEFAULTS } from '@/lib/line/chat-config';
import { MetaReadOnlyPanel, YouTubeReadOnlyPanel, TikTokReadOnlyPanel } from '@/features/admin/social/provider-readonly-panels';
import planning from '@/features/admin/financial-planning/FinancialPlanning.module.css';
const model = { revision:null, source:'default', storedInvalid:false, writeReady:false, config:LINE_CHAT_DEFAULTS, updatedAt:null, updatedBy:null, history:[], topicClicks30d:null, draft:null, articles:[] };
const kind = new URLSearchParams(location.search).get('fixture') || 'line';
window.fixturePath = kind === 'line' ? '/settings/line-chat/' : '/dashboard/planning/';
const body = kind === 'line' ? <><h1 className="text-3xl font-semibold">ปุ่มแชท LINE</h1><LineChatManager initialModel={model} canEdit={true} categories={[]} /></> : kind === 'providers' ? <><h1 className="text-3xl font-semibold">สถานะการเชื่อมต่อ</h1><MetaReadOnlyPanel ready={true} analyticsReady={false} missing={[]} /><YouTubeReadOnlyPanel ready={true} analyticsReady={false} missing={[]} /><TikTokReadOnlyPanel ready={true} analyticsReady={false} missing={[]} /></> : <><h1 className="text-3xl font-semibold">ตัวอย่างสีห้องวางแผน</h1><div data-planning-header className={planning.header}>รายการตัวอย่าง</div><p data-planning-presenting className={planning.presentingBanner}>ข้อมูลตัวอย่างสำหรับการนำเสนอ</p><p data-planning-alert className={planning.alertBanner}>ตัวอย่างสถานะที่ต้องตรวจ</p><div className={planning.row}>แถวข้อมูลตัวอย่าง</div></>;
createRoot(document.getElementById('root')).render(<AdminProtectedChrome title="ศูนย์จัดการ CCPun" currentEnvironmentLabel="พื้นที่ทดสอบ" identityLabel="local-fixture" role="owner" navItems={${JSON.stringify(navModule.exports.nav)}} showInbox={true} inboxLabel="ลูกค้า LINE" studioLabel="Sanity Studio" showLogout={false} logout={async()=>{}} safety="ข้อมูลจำลองในเครื่อง">{body}</AdminProtectedChrome>);
`;
const bundled = await build({
  stdin: { contents: entry, resolveDir: root, loader: 'tsx' }, outfile: 'fixture.js', bundle: true, write: false, format: 'iife', platform: 'browser', alias: { '@': root }, logLevel: 'silent',
  plugins: [{ name: 'local-ui-only', setup(api) {
    api.onResolve({ filter: /^next\/(?:link|navigation)$|AdminDataRefresh$/ }, ({ path: id }) => ({ path: id, namespace: 'fixture' }));
    api.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path: id }) => ({ loader: 'jsx', resolveDir: root, contents: id === 'next/link' ? 'import React from "react"; export default function Link({children,prefetch,...props}){return <a {...props}>{children}</a>}' : id === 'next/navigation' ? 'export const usePathname=()=>window.fixturePath; export const useRouter=()=>({refresh(){}});' : 'export default ()=>null;' }));
  } }],
});
const script = bundled.outputFiles.find((file) => file.path.endsWith('.js')).text;
const componentCss = bundled.outputFiles.find((file) => file.path.endsWith('.css')).text;
const staticRoot = path.resolve('apps/admin/.ccpun-local/next-uat/static');
const cssFiles = (await readdir(staticRoot, { recursive: true })).filter((file) => file.endsWith('.css'));
assert.ok(cssFiles.length, 'build Admin local-uat before this check');
// ponytail: only shared Admin foundation/fonts; Studio and unrelated route resets are not loaded by these pages.
const builtStyles = (await Promise.all(cssFiles.map((file) => readFile(path.join(staticRoot, file), 'utf8')))).filter((css) => css.includes('.p-5{') || css.includes('--font-kanit:'));
assert.ok(builtStyles.some(css => css.includes('.p-5{')), 'production Tailwind utilities are present');
const fontClasses = builtStyles.flatMap(css => [...css.matchAll(/\.([A-Za-z0-9_]+)\{--font-kanit[^}]+\}/g)].map(match => match[1])).join(' ');
const css = builtStyles.join('\n') + '\n' + componentCss;
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname === '/fixture.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(script); }
  else if (url.pathname === '/fixture.css') { response.setHeader('Content-Type', 'text/css'); response.end(css); }
  // The real server runs the theme boot script in its SSR header; this client-only fixture starts in that settled state.
  else if (url.pathname === '/') { response.setHeader('Content-Type', 'text/html'); response.end(`<!doctype html><html lang="th" class="${fontClasses}" data-admin-theme="light"><head><meta charset="utf-8"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`); }
  else if (/^\/media\/[A-Za-z0-9_.-]+\.woff2$/.test(url.pathname)) { const font = await readFile(path.join(staticRoot, url.pathname.slice(1))).catch(()=>null); response.statusCode=font?200:404; response.setHeader('Content-Type','font/woff2'); response.end(font); }
  else { response.statusCode = 404; response.end(); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const failures = [];
await mkdir(output, { recursive: true });
try {
  const context = await browser.newContext();
  await context.route('**/*', (route) => new URL(route.request().url()).origin === origin && route.request().method() === 'GET' ? route.continue() : route.abort());
  await context.addInitScript(() => localStorage.setItem('ccpun-admin-theme', 'light'));
  const page = await context.newPage();
  for (const fixture of ['line', 'providers', 'planning']) for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${origin}/?fixture=${fixture}`, { waitUntil: 'networkidle' });
    await page.locator('[data-admin-theme-toggle]').waitFor();
    const measured = await page.evaluate(() => {
      const rgba = (color) => { const canvas=document.createElement('canvas'); canvas.width=canvas.height=1; const ctx=canvas.getContext('2d'); ctx.fillStyle=color; ctx.fillRect(0,0,1,1); return [...ctx.getImageData(0,0,1,1).data].map((n,i)=>i===3?n/255:n); };
      const blend = (a,b) => [0,1,2].map(i=>a[i]*a[3]+b[i]*(1-a[3])).concat(1);
      const background = (node) => { const chain=[]; for(let el=node;el;el=el.parentElement)chain.unshift(rgba(getComputedStyle(el).backgroundColor)); return chain.reduce((base,color)=>blend(color,base),[255,255,255,1]); };
      const contrast = (a,b) => {const lum=c=>c.slice(0,3).map(n=>n/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
      const nodes=[...document.querySelectorAll('main button,[data-planning-header],[data-planning-presenting],[data-planning-alert]')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&!el.disabled;});
      const contrasts=nodes.map(el=>({label:el.textContent.trim().slice(0,70),class:el.className,contrast:contrast(blend(rgba(getComputedStyle(el).color),background(el)),background(el))}));
      const bar=document.querySelector('[data-admin-tab-bar]'); const tabs=bar?[...bar.querySelectorAll('a,button')].map(el=>({label:el.textContent.trim(),width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})):[];
      return {theme:document.documentElement.getAttribute('data-admin-theme'),shell:getComputedStyle(document.querySelector('.admin-theme-scope')).backgroundColor,overflow:document.documentElement.scrollWidth-innerWidth,contrasts,tabs};
    });
    if(measured.theme!=='light'||measured.shell!=='rgb(250, 246, 240)') failures.push(`${fixture}/${width}: shell is not light`);
    if(measured.overflow>1) failures.push(`${fixture}/${width}: horizontal overflow`);
    for(const item of measured.contrasts) if(item.contrast<4.5) failures.push(`${fixture}/${width}: ${item.label} contrast ${item.contrast.toFixed(2)}`);
    if(width===390 && (measured.tabs.length!==4||measured.tabs.some(tab=>tab.width<44||tab.height<44))) failures.push(`${fixture}/${width}: bottom tab bar target/count`);
    await page.screenshot({path:path.join(output,`${fixture}-light-${width}.png`),fullPage:true});
    await page.locator('[data-admin-theme-toggle]').click();
    assert.equal(await page.locator('html').getAttribute('data-admin-theme'),'dark');
    await page.locator('[data-admin-theme-toggle]').click();
    assert.equal(await page.locator('html').getAttribute('data-admin-theme'),'light');
    if(fixture==='line') {
      const preview=page.locator('.bg-\\[\\#251818\\].text-\\[\\#faf9f9\\]');
      assert.ok(await preview.count(), 'LINE dark preview is present');
      assert.equal(await preview.first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(37, 24, 24)');
    }
    results.push({fixture,width,...measured});
  }
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); await writeFile(path.join(output,'results.json'),JSON.stringify({sourceFiles:sourceFiles.length,colorUtilities:[...colors].sort(),results,failures,coverage:'Actual Chrome/LINE/provider components; planning CSS specimens; no authenticated pages or provider data'},null,2)+'\n'); }
console.log(`Admin light: ${results.length} component/width cases; ${sourceFiles.length} source files / ${colors.size} color utilities inventoried; ${failures.length} failures`);
assert.deepEqual(failures,[]);
