import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
process.env.NODE_ENV='production';
const root=process.cwd(), require=createRequire(path.join(root,'package.json'));
const React=require('react'), {renderToStaticMarkup}=require('react-dom/server'), {JSDOM}=require('jsdom'), sharp=require('sharp'), jsQR=require('jsqr');
const {loadFixtureModule}=await import(path.join(root,'qa/phase1-fixture-loader.mjs'));
const css={__esModule:true,default:new Proxy({},{get:(_,k)=>String(k)})};
function options(articles=[],review=true){
 const mocks=new Map([
 ['@/lib/content/public-copy',{getPublicCopy:async()=>({})}],
 ['@/lib/deployment-environment',{IS_REVIEW_ENVIRONMENT:review}],
 ['@/components/layout/v5/shell-data',{getPublishedArticles:async()=>articles,getShellTopics:async()=>[]}],
 ['@/components/layout/v5/V5Page',{__esModule:true,default:({children})=>React.createElement('main',{},children)}],
 ['@/components/layout/v5/V5CredentialCards',{__esModule:true,default:()=>null}],
 ['@/components/layout/v5/V5HealthHappyCountdownLabels',{__esModule:true,default:()=>null}],
 ['@/components/layout/v5/V5LegacyBridge',{__esModule:true,default:({children})=>children}],
 ['@/features/investment-allocation/InvestmentAllocationTool',{__esModule:true,default:()=>React.createElement('div',{'data-unchanged-calculator':true})}],
 ['@/components/ui/PublicCopyProvider',{PublicCopyProvider:({children})=>children}],
 ['@/lib/runtime/investment-availability',{INVESTMENT_ALLOCATION_ENABLED:true}],
 ]);
 for(const folder of ['features/home/v5','features/blog/v5','features/tools-hub','features/investment-allocation','components/layout/v5','components/ui']) for(const file of fs.readdirSync(folder).filter(f=>/\.tsx?$/.test(f))){
 const s=fs.readFileSync(path.join(folder,file),'utf8');for(const [,id] of s.matchAll(/from ["']([^"']+\.(?:css|svg))["']/g)) mocks.set(id,id.endsWith('.css')?css:{__esModule:true,default:{src:id,width:100,height:100}});
 }
 return {mocks};
}
async function resolved(node){
 if(node==null||typeof node!=='object')return node;
 if(Array.isArray(node))return Promise.all(node.map(resolved));
 if(typeof node.type==='function')return resolved(await node.type(node.props));
 const children=await resolved(node.props?.children);return React.cloneElement(node,{},children);
}
async function doc(file,args=[],opts=options()){
 const page=loadFixtureModule(file,opts);const node=await page.default(...(file.includes("V5Home") && args.length===0 ? [{}] : args));return new JSDOM(renderToStaticMarkup(await resolved(node))).window.document;
}
const registry=loadFixtureModule('lib/content/public-copy-registry.ts');
const fallback=await doc('features/home/v5/V5Home.tsx');
const start=fallback.querySelector('[aria-labelledby="home-start"]');
assert.equal(start.querySelectorAll('article').length,4);
const expected=['https://ccpun.com/blog/health-insurance/aia-health-happy-describe/','https://ccpun.com/blog/critical-illness-insurance/what-is-critical-illness-insurance/','https://ccpun.com/blog/personal-finance/tax-deduction/','https://ccpun.com/blog/personal-finance/financial-pyramid/'];
assert.deepEqual([...start.querySelectorAll('.guideTitle a')].map(a=>a.href),expected);
for(const a of start.querySelectorAll('.guideTitle a')){assert.equal(a.textContent,'อ่านคู่มือบนเว็บไซต์หลัก');assert.equal(a.target,'_blank');assert.equal(a.rel,'noopener noreferrer');}
assert.equal(start.querySelector('.pairedGuide').href,'https://ccpun.com/blog/health-insurance/aia-health-ci-hero-guide/');
assert.equal(start.querySelectorAll('.guidePlaceholder').length,4);
assert.ok(!start.textContent.includes('{deadline}'));
const countdown=loadFixtureModule('components/layout/v5/V5HealthHappyCountdown.tsx',options());
const date=new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Bangkok'}).format(new Date(countdown.V5_HEALTH_HAPPY_DEADLINE));
assert.ok(start.querySelector('.guideCampaign.countdownSlot').textContent.includes(date));
const expired={document:{documentElement:{setAttribute:(key)=>{assert.equal(key,'data-v5-countdown-ended');expired.marked=true}}},Date:{now:()=>new Date(countdown.V5_HEALTH_HAPPY_DEADLINE).getTime(),parse:Date.parse}};
new Function('document','Date',countdown.V5_HEALTH_HAPPY_ENDED_CHECK)(expired.document,expired.Date);assert.equal(expired.marked,true);
for(const key of ['home.p','home.p2','home.p3'])assert.ok(fallback.body.textContent.includes(registry.HOME_COPY_DEFAULTS[key]),key);
const records=[['aia-health-happy-describe','health-insurance'],['aia-health-ci-hero-guide','health-insurance'],['critical-illness-insurance','critical-illness-insurance'],['tax-deduction','personal-finance'],['financial-pyramid','personal-finance'],['fresh-a','personal-finance'],['fresh-b','personal-finance'],['fresh-c','personal-finance']].map(([slug,categorySlug],i)=>({id:slug,slug,categorySlug,category:categorySlug,title:'ACTUAL '+slug,excerpt:'Actual excerpt '+slug,status:'published',noindex:false,publishedAt:'2026-10-30T00:00:00Z',updatedAt:'2026-10-30T00:00:00Z',tags:[],featuredImage:i===0?{src:'/actual-cover.webp',alt:'Actual cover',width:800,height:420}:undefined}));
const current=await doc('features/home/v5/V5Home.tsx',[],options(records));
assert.equal(current.querySelectorAll('.guideTitle a[target="_blank"]').length,0);
assert.ok(current.querySelector('.guideTitle a').textContent.includes('ACTUAL aia-health-happy-describe'));
assert.equal(current.querySelector('.guideCover').getAttribute('src'),'/actual-cover.webp');
const latest=current.querySelector('[aria-labelledby="home-latest"]');
for(const article of records.slice(0,5))assert.ok(!latest.textContent.includes(article.title),article.slug);
for(const article of records.slice(5))assert.ok(latest.textContent.includes(article.title),article.slug);
const offOptions=options();offOptions.mocks.set('@/lib/runtime/investment-availability',{INVESTMENT_ALLOCATION_ENABLED:false});
const toolsOff=await doc('features/tools-hub/page.tsx',[],offOptions);
for(const href of ['/tools/investment-allocation/','/tools/aia-fund-allocation/'])assert.equal(toolsOff.querySelectorAll(`h2 a[href="${href}"]`).length,0);
await assert.rejects(()=>doc('features/investment-allocation/page.tsx',[],offOptions),e=>e.code==='not-found');
const site=loadFixtureModule('components/layout/v5/constants.ts').V5_ACCOUNT_LINKS.find(a=>a.id==='phillip');
for(const file of ['features/tools-hub/page.tsx','features/investment-allocation/page.tsx']){
 const d=await doc(file);const section=d.querySelector('[aria-labelledby="phillip-account-title"]');assert.ok(section,file);assert.equal(d.querySelectorAll('[aria-labelledby="phillip-account-title"]').length,1);assert.equal(section.querySelector('a').href,site.href);assert.equal(section.querySelector('img').width,200);assert.equal(section.querySelector('img').height,200);
 if(file.includes('tools-hub')){for(const href of ['/tools/investment-allocation/','/tools/aia-fund-allocation/'])assert.equal(d.querySelectorAll(`h2 a[href="${href}"]`).length,1);}else assert.equal(d.querySelectorAll('.heroProofs li').length,4);
}
if(fs.existsSync('features/investment-allocation/aia-page.tsx')){
 const d=await doc('features/investment-allocation/aia-page.tsx');assert.equal(d.querySelectorAll('.heroProofs li').length,4);assert.ok(d.querySelector('h1').textContent.includes(registry.PUBLIC_COPY_SCOPES.investment.defaults['investment.aia.text267']));assert.equal(d.querySelectorAll('[aria-labelledby="phillip-account-title"]').length,0);
}else assert.equal(path.basename(root),'admin');
const digest=b=>createHash('sha256').update(b).digest('hex');
const hero='public/assets/website-v5/home-hero-white-outline-bottom-flush-f548ab58.png',old='public/assets/website-v5/home-hero-white-outline-8e7f5dc2.png',qr='public/assets/website-v5/phillip-account-qr-84935a14.png';
assert.equal(digest(fs.readFileSync(hero)),'f548ab5855042dbf8454efdaab71cce822d8d6721368230c618a7687fa4fbeec');
const original=await sharp(old).ensureAlpha().raw().toBuffer({resolveWithObject:true}),trim=await sharp(hero).ensureAlpha().raw().toBuffer({resolveWithObject:true});
assert.equal(trim.info.width,1088);assert.equal(trim.info.height,1602);assert.equal(original.info.height,1632);assert.deepEqual(original.data.subarray(0,trim.data.length),trim.data);for(let i=trim.data.length+3;i<original.data.length;i+=4)assert.equal(original.data[i],0);
assert.equal(digest(fs.readFileSync(qr)), '84935a144e87d79a316292c6ac259b7c006562d4bea247fe00c08dadb47f62c8');
const qrdata=await sharp(qr).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(qrdata.info.width,200);assert.equal(qrdata.info.height,200);assert.equal(jsQR(new Uint8ClampedArray(qrdata.data),200,200).data,site.href);
const accountCss=fs.readFileSync('components/layout/v5/V5PhillipAccount.module.css','utf8');assert.match(accountCss,/\.qr \{[^}]*padding: 24px; background: #fff;/);assert.match(fs.readFileSync('components/layout/v5/V5PhillipAccount.tsx','utf8'),/unoptimized loading="lazy"/);
for(const [file,key] of [['lib/content/public-copy-registry.ts','HOME_COPY_DEFAULTS'],['lib/content/site-copy-defaults.ts','SITE_COPY_DEFAULTS'],['lib/content/investment-copy-defaults.ts','INVESTMENT_COPY_DEFAULTS']]){
 const base=path.basename(root)==='web'?'fb5eee8655d141587c5df46476e2dd38a3bd1be6':'eb160cca36d5e603fcfca98fc6f0a5d01d6c1f34';const source=execFileSync('git',['show',base+':'+file],{encoding:'utf8'});const before=loadFixtureModule(file,{sources:new Map([[file,source]])})[key],after=loadFixtureModule(file)[key];for(const [k,v]of Object.entries(before))assert.equal(after[k],v,k);
}
console.log(JSON.stringify({root,result:'PASS',checks:['T01 four permanent situations','canonical outbound fallbacks','current lane article/cover preferred','all five T01 guide articles excluded from Latest','all Home biography paragraphs retained','deadline substitution + exact existing expiry script','ToolsHub/Main single Phillip + flag controlled fund cards','four fund pills/AIA H1','retained RGBA exact; only30transparent rows removed','QR decoded approvedURL;original200x200;white24pxquietzone;unoptimized','all prior Home/site/investment defaults exact'],heroSHA:digest(fs.readFileSync(hero)),qrSHA:digest(fs.readFileSync(qr))},null,2));

const blogOptions = (review=true) => { const opts=options([], review); opts.mocks.delete('@/components/ui/PublicCopyProvider'); return opts; };
const {default: Blog} = loadFixtureModule('features/blog/v5/V5BlogIndex.tsx', blogOptions());
const blog = new JSDOM(renderToStaticMarkup(React.createElement(Blog, { articles: records, featured: records.slice(0,3), topics: [], copy: {}, author: null }))).window.document;
assert.equal(blog.querySelectorAll('.featuredGrid article').length, 3);
assert.ok(blog.querySelector('#v5-blog-scope').classList.contains('nativeBlog'));
assert.ok(blog.querySelectorAll('.compactCard').length > 0);
const legacyBlog = loadFixtureModule('features/blog/v5/V5BlogIndex.tsx', blogOptions(false)).default;
assert.ok(!renderToStaticMarkup(React.createElement(legacyBlog, { articles: records, featured: records.slice(0,3), topics: [], copy: {}, author: null })).includes('compactCard'));
if (fs.existsSync('features/blog/v5/V5Category.tsx')) {
  const {default: Category} = loadFixtureModule('features/blog/v5/V5Category.tsx', blogOptions());
  const intro = ['Complete editorial introduction one.', 'Complete editorial introduction two.'];
  const categoryNode = await Category({ slug: 'personal-finance', title: 'Personal finance', hub: { slug: 'personal-finance', title: 'Personal finance', intro }, articles: records.slice(0,6), topics: [{ slug: 'personal-finance', title: 'This category', count: 6, href: '/blog/personal-finance/' }, { slug: 'investment', title: 'Related category', count: 3, href: '/blog/investment/' }], copy: {} });
  const html = renderToStaticMarkup(categoryNode);
  const category = new JSDOM(html).window.document;
  assert.equal(category.querySelectorAll('#v5-category-grid > div').length, 6);
  const containsPager = node => Array.isArray(node) ? node.some(containsPager) : Boolean(node && typeof node === 'object' && ((node.type?.name === 'V5GroupPager' && node.props.total === 6) || containsPager(node.props?.children)));
  assert.ok(containsPager(categoryNode), 'Five/six cards mount the responsive pager; desktop server render correctly returns no controls');
  for (const paragraph of intro) assert.ok(category.body.textContent.includes(paragraph));
  assert.deepEqual([...category.querySelectorAll('[aria-labelledby="category-related"] a')].map(a => a.getAttribute('href')), ['/blog/investment/']);
}
for (const review of [true, false]) {
  const opts=options([], review);
  const FooterStub = () => null;
  opts.mocks.delete('@/components/layout/v5/V5Page');
  for (const [name, component] of [['V5Footer', FooterStub], ['V5Header', () => null], ['V5ChatDockServer', () => null]]) opts.mocks.set('./'+name, { __esModule: true, default: component });
  const Page=loadFixtureModule('components/layout/v5/V5Page.tsx',opts).default;
  for (const current of ['/', '/blog/', '/blog/personal-finance/', '/blog/personal-finance/article/', '/about/', '/tools/', '/privacy/', undefined]) {
    // Private previews provide the exact same explicit physical current value.
    const footer=Page({current,children:null}).props.children.find(child => child.type === FooterStub);
    assert.equal(footer.props.compactMobile, review && Boolean(current === '/' || current?.startsWith('/blog/')), String(current));
  }
}
console.log('PASS: current Blog/Category full-content composition, mobile pager mounting, and explicit Review-only footer context');

const footerOptions=options();
footerOptions.mocks.set('@/components/layout/CookieSettingsButton', { __esModule: true, default: () => React.createElement('button', { 'data-cookie-settings': true }, 'Cookie settings') });
const Footer=loadFixtureModule('components/layout/v5/V5Footer.tsx', footerOptions).default;
const expandedHtml=renderToStaticMarkup(await Footer({siteCopy:{},compactMobile:false}));
const previousFooter=execFileSync('git',['show','HEAD:components/layout/v5/V5Footer.tsx'],{encoding:'utf8'});
const PriorFooter=loadFixtureModule('components/layout/v5/V5Footer.tsx',{...footerOptions,sources:new Map([['components/layout/v5/V5Footer.tsx',previousFooter]])}).default;
assert.equal(expandedHtml, renderToStaticMarkup(await PriorFooter({siteCopy:{}})), 'Every legacy footer DOM byte remains exact');
const expandedFooter=new JSDOM(expandedHtml).window.document;
const compactFooter=new JSDOM(renderToStaticMarkup(await Footer({siteCopy:{},compactMobile:true}))).window.document;
assert.deepEqual([...compactFooter.querySelectorAll('a')].map(a=>[a.getAttribute('href'),a.textContent]),[...expandedFooter.querySelectorAll('a')].map(a=>[a.getAttribute('href'),a.textContent]));
assert.equal(compactFooter.querySelector('.footerLegal').textContent,expandedFooter.querySelector('.footerLegal').textContent);
assert.equal(compactFooter.querySelector('.footerCopyright').textContent,expandedFooter.querySelector('.footerCopyright').textContent);
assert.equal(compactFooter.querySelectorAll('details > summary').length,3);
assert.equal(compactFooter.querySelectorAll('[data-cookie-settings]').length,1);
console.log('PASS: legacy footer exact DOM; compact variant retains every link, full legal text and cookie control');
