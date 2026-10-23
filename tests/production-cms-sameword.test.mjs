import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';
const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const registry = loadFixtureModule('lib/content/public-copy-registry.ts');
const copyProvider = loadFixtureModule('components/ui/PublicCopyProvider.tsx');
const digest = value => createHash('sha256').update(value).digest('hex');
const syntheticArticles = Array.from({length: 8}, (_, i) => ({id:`fixture-${i}`, slug:`fixture-${i}`, title:`บทความ ${i}`, excerpt:`รายละเอียด ${i}`, category:'การเงินส่วนบุคคล', categorySlug:'personal-finance', status:'published', publishedAt:'2026-10-01T00:00:00Z', updatedAt:'2026-10-02T00:00:00Z', tags:[], body:[]}));
const files = {
  home:'features/home/website-43/Website43Home.tsx',
  ci:'features/ci-planning/page.tsx',
  fhc:'features/financial-health-check/page.tsx',
  blog:'features/blog/pages/BlogArchivePage.tsx',
  privacy:'features/legal/pages/PrivacyPage.tsx',
  cookies:'features/legal/pages/CookiePolicyPage.tsx',
  moneyStory:'features/money-story/page.tsx',
  site:'components/layout/website-43/Website43Shared.tsx',
};
const serverNames = new Set(['Website43Home','HomeFooter','Website43Footer','Website43Blog','renderWebsite43Blog','Website43Article','Website43ArticleToc','ClientFHC','Website43Navbar','Website43ToolHero','Website43Brand']);
async function resolveServer(node) {
  if (Array.isArray(node)) return Promise.all(node.map(resolveServer));
  if (!React.isValidElement(node)) return node;
  if (typeof node.type === 'function' && serverNames.has(node.type.name) && !['Website43Navbar'].includes(node.type.name)) return resolveServer(await node.type(node.props));
  const children = await resolveServer(node.props.children);
  return React.cloneElement(node, {}, ...(Array.isArray(children) ? children : [children]));
}
export async function renderFixture(scope, props = {}, {sources = new Map(), overrides = {}, article = null} = {}) {
  const mocks = new Map([
    ['@/components/ui/PublicCopyProvider',copyProvider],
    ['@/lib/content/public-copy',{getPublicCopy:async requested=>({...registry.parsePublicCopy(requested,null),...overrides})}],
    ['@/lib/content/sanity',{getPrimaryAuthorProfile:async()=>null}],
    ['@/lib/content/provider',{getContentProvider:()=>({listArticles:async()=>syntheticArticles})}],
    ['@/lib/content/category-registry-sanity',{listCategoryRegistry:async()=>({entries:[]})}],
    ['@/lib/content/blog-featured-sanity',{listBlogFeaturedArticleIds:async()=>null}],
    ['@/lib/deployment-environment',{IS_REVIEW_ENVIRONMENT:false,IS_DRAFT_PREVIEW_ALLOWED:false}],
    ['@/lib/seo/page-seo',{resolvePageSeoMetadata:async(_pathname,defaults)=>defaults}],
    ['@/lib/analytics',{trackEvent:()=>assert.fail('render must not emit analytics')}],
    ['@/lib/cookie-consent',{getConsentData:()=>null}],
    ['next/headers',{draftMode:async()=>({isEnabled:false})}],
    ['next/navigation',{usePathname:()=> '/',notFound:()=>{throw new Error('fixture-not-found')}}],
  ]);
  // Existing fixture loader intentionally does not load assets. Stable named CSS
  // projections retain class identity so a layout change changes these goldens.
  const allFiles = [...new Set([...Object.values(files),'features/ci-planning/components/CILandingIntro.tsx','features/financial-health-check/components/FHCLandingIntro.tsx','features/financial-health-check/components/ClientFHC.tsx','features/home/website-43/Website43HomeStatic.tsx','features/blog/website-43/Website43Blog.tsx','features/blog/website-43/Website43BlogInteractive.tsx','features/blog/website-43/Website43Article.tsx','features/blog/website-43/Website43ArticleBody.tsx','features/money-story/components/MoneyStoryGame.tsx','features/money-story/components/MoneyStoryScreens.tsx','features/money-story/components/MoneyStoryStatusSidebar.tsx','features/ci-planning/components/CIWizard.tsx','features/financial-health-check/components/LifeCoverageWizard.tsx'])];
  for (const file of allFiles) {
    const source = sources.get(file) ?? readFileSync(file,'utf8');
    for (const [,id] of source.matchAll(/from ['"]([^'"]+\.(?:css|svg))['"]/g)) {
      if (id.endsWith('.css')) mocks.set(id,{__esModule:true,default:new Proxy({}, {get:(_,name)=>String(name)})});
      else mocks.set(id,{__esModule:true,default:{src:id,width:32,height:32}});
    }
  }
  const path = article ? 'features/blog/website-43/Website43Article.tsx' : files[scope];
  const fixtureModule = loadFixtureModule(path,{sources,mocks});
  const render = scope === 'site' ? fixtureModule.Website43Footer : fixtureModule.default;
  const tree = await render(article ? {article,...props} : scope === 'home' ? {copy:overrides,...props} : props);
  const Provider = copyProvider.PublicCopyProvider;
  return renderToStaticMarkup(React.createElement(Provider, {values:{...registry.parsePublicCopy("site",null),...registry.parsePublicCopy(scope,null),...overrides}}, await resolveServer(tree)));
}
// Frozen b871b734 public render hashes, captured independently before capability
// implementation. No live data, network, deployments or mutable baseline reseal.
const baseline = {
  "0": "a7d6cc52eaedd5d36e889d8dc534977d9e887f66a11d9e2a1dc16488ec46f733",
  "1": "b0e0f201e07d15ac3c292d8645c664be46edc988a3b3f4e2307fd33b4f09fe63",
  "2": "c81397d413ecb7d87b3543dc87ffcd50cb6988e676bb7be037a8e870bd785cc0",
  "3": "4737df82abf4ef636e87b2e2e09b238faf5d2ecf3f78353b6b78f4489e83d828",
  "4": "1afeaadc78f892948343ef3b03af00f28c8b4d7bbbbd849689cbf6aa15277de4",
  "5": "6239f5a8c1edd0706b3758bff4a38913034bc86ca428aa269c3883bdff9e61a0",
  "6": "5b3fc40d5c75e981b4b959fbc163961a0f585b01fec499fb1e03e9d5db9c3e2d",
  "7": "b3cf68c8290de306ddedc2a9bed9be044f57f64b94d7343e7986c02dfc1d1bba",
  "8": "835a56065253b42e6b9d5b77aa598456baac8982bd623030e3d1dadddc992623",
  "9": "805ccb282a0fae7795b81a28c04a3a098744c1abd59a6357f9c9cf1d2cb1240e",
  "10": "87de95089e85cfe42c209b663df714630386c79dccfea4f80e62e08465e3b717"
};
// Inverse only reviewed canonical href attributes inside their original shell slots.
function inverseCanonicalShellLinks(html, scope) {
  const counts = { nav: 0, footer: 0, learning: 0, breadcrumb: 0 };
  const inverse = (block, entries) => {
    for (const [path, expected] of entries) {
      const attribute = `href="${path}/"`;
      assert.equal(block.split(attribute).length - 1, expected, `${scope}:${path} exact shell link count`);
      block = block.replaceAll(attribute, `href="${path}"`);
    }
    return block;
  };
  html = html.replace(/<nav\b[^>]*aria-label="เมนูหลัก"[^>]*>[\s\S]*?<\/nav>/g, block => { counts.nav++; return inverse(block, [['/blog', 1]]); });
  html = html.replace(/<footer\b[^>]*class="footerWrap(?: [^"]*)?"[^>]*>[\s\S]*?<\/footer>/g, block => {
    counts.footer++;
    return inverse(block, [['/blog',1],['/tools/financial-health-check',2],['/ci-planning',1],['/privacy',1],['/cookie-policy',1],...(scope === 'home' ? [] : [['/play/money-story',1]])]);
  });
  html = html.replace(/<section\b[^>]*data-uat-section="home-learning"[^>]*>[\s\S]*?<\/section>/g, block => { counts.learning++; return inverse(block, [['/blog',1],['/tools/financial-health-check',1],['/ci-planning',1]]); });
  if (scope === 'article') html = html.replace(/<nav\b[^>]*class="breadcrumbs"[^>]*>[\s\S]*?<\/nav>/g, block => { counts.breadcrumb++; return inverse(block, [['/blog',1]]); });
  assert.deepEqual(counts, {nav:scope==='site'?0:1,footer:1,learning:scope==='home'?1:0,breadcrumb:scope==='article'?1:0}, `${scope}: exact original shell blocks`);
  return html;
}
// TESTS
export function metadataFixture(scope, review = false, sources = new Map()) {
  if (scope === 'home') return loadFixtureModule('lib/seo/root-metadata.ts',{sources}).buildSiteRootMetadata({admin:false,review});
  const mocks = new Map([
    ['@/lib/deployment-environment',{IS_REVIEW_ENVIRONMENT:review}],
    ['@/lib/seo/page-seo',{resolvePageSeoMetadata:(_path,defaults)=>defaults}],
    ['next/headers',{draftMode:async()=>({isEnabled:false})}],
  ]);
  const fixtureModule = loadFixtureModule(files[scope],{sources,mocks});
  return fixtureModule.metadata ?? fixtureModule.generateMetadata({},Promise.resolve({}));
}

const metadataBaseline = {
  "home:false": "5875f11d6039e5367fba129180daefac581468bc2f7eb9770629fb8ad0acc7a7",
  "home:true": "9573d0f4f86a36bcf4c1119b21139a8e523269268cc6fcfafa517ba5a95eb4ba",
  "ci:false": "4b1c1fa53d62e6f74a28a9419a02bcc3228b9f6532ca6ab28a4f241b254b4db0",
  "ci:true": "b1d0351fde939bd500bb43657902ec075c112f5af67b59228e14fcceb4e1afd9",
  "fhc:false": "71f3fdf91d8e431e27b6f96cea9e30c25c786dd002042fc3dbea733a70502613",
  "fhc:true": "6399b2cb186fb7fa26b2b58beaaf6eeb2b6f6371e680262e954b35946eb300fd",
  "blog:false": "e787404a7dff8b6a0674ae31a048a830d76d7f5957c2a1e7c0f0485ebdb9e1ff",
  "blog:true": "e787404a7dff8b6a0674ae31a048a830d76d7f5957c2a1e7c0f0485ebdb9e1ff",
  "privacy:false": "1584613e6de3fe8043754e908e7426202d3277949ade7168c0f735083071d6c6",
  "privacy:true": "4732b9c364b4febe7e41af97e93d34c5cc38398873f25f0bd4d22b305247ad68",
  "cookies:false": "5108add8d96e9afa7c2587058f47099baa4121b63838f4adb0c14acbb172af7c",
  "cookies:true": "5108add8d96e9afa7c2587058f47099baa4121b63838f4adb0c14acbb172af7c",
  "moneyStory:false": "720fc53f0e281c75b9551fdf0871f3bd788104da8a01d12d75f859372f5dba78",
  "moneyStory:true": "d8335e6d35b48aa591a457869eec492f2872cd0985474f532049dc1e3c522712"
};
const cases = [
  ['site',{warnings:true}],['home',{}],
  ['home',{authorProfile:{name:'เจ้าของโปรไฟล์',professionalQualifications:[{shortName:'CFP',identifier:'123'}],professionalLicenses:[{name:'ใบอนุญาต',identifier:'456'}],profileRole:'ผู้วางแผน',profileBio:'ประวัติ'}}],
  ['ci',{}],['fhc',{}],['blog',{searchParams:Promise.resolve({})}],
  ['blog',{searchParams:Promise.resolve({q:'ไม่มีผล'})}],['blog',{searchParams:Promise.resolve({page:'2'})}],
  ['privacy',{}],['cookies',{}],['moneyStory',{}],
];
test('eight original scopes retain exact b871 public HTML, current design and six-card archive',async()=>{
  assert.deepEqual(Object.keys(registry.PUBLIC_COPY_SCOPES),['site','home','ci','fhc','blog','privacy','cookies','moneyStory']);
  for (const [index,[scope,props]] of cases.entries()) {
    let html = await renderFixture(scope,props);
    if (scope === 'blog') {
      const hint = '<link rel="preload" href="/assets/blog-migration/aia-health-happy-describe/featured-01-AIA-Health-Happy-article.lossless.webp" as="image" fetchPriority="high"/>';
      const heroHint = '<link rel="preload" as="image" href="/assets/website-43/blog-hero.png" imageSizes="(max-width: 639px) 100vw, 60vw" fetchPriority="high"/>';
      assert.ok(html.startsWith(heroHint + hint), 'Blog retains its Hero hint before the exact approved artwork hint');
      assert.equal(html.split(hint).length, 2, 'Blog emits the approved hint exactly once');
      html = html.replace(hint, '');
    }
    html = inverseCanonicalShellLinks(html, scope);
    assert.equal(digest(html),baseline[index],`${index}:${scope}`);
  }
  assert.equal((await renderFixture('blog',{})).match(/class="articleCard"/g)?.length,6);
});
test('seven original metadata objects preserve every field in ordinary and review lanes',async()=>{
  for (const scope of Object.keys(files).filter(scope=>scope!=='site')) for (const review of [false,true]) assert.equal(digest(JSON.stringify(await metadataFixture(scope,review))),metadataBaseline[scope+':'+review]);
});
test('each scoped CMS edit reaches existing UI while destinations and formulas remain owned by source',async()=>{
  const keys={site:'site.footerDisclaimer',home:'home.hero.eyebrow',ci:'ci.expenses.monthlyIncome.label',fhc:'fhc.wizard.placeholder',blog:'blog.activeCategoryText',privacy:'privacy.h1',cookies:'cookies.h1',moneyStory:'moneyStory.title'};
  for(const[scope,key]of Object.entries(keys)) {
    assert.ok(Object.hasOwn(registry.PUBLIC_COPY_SCOPES[scope].defaults,key),key);
    const value=`ข้อความเจ้าของ ${scope}`;
    const parsed=registry.parsePublicCopy(scope,{_id:registry.publicCopyDocumentId(scope),_type:'publicPageCopy',scope,locale:'th',entries:[{key,text:value}]});
    const html=await renderFixture(scope,{}, {overrides:parsed});assert.ok(html.includes(value),key);
    const before=await renderFixture(scope,{});assert.deepEqual([...html.matchAll(/(?:href|action)="([^"]*)"/g)].map(m=>m[0]),[...before.matchAll(/(?:href|action)="([^"]*)"/g)].map(m=>m[0]),key);
  }
});
test('plain text documents retain exact singleton identity, key ownership and interpolation guards',()=>{
  for(const scope of Object.keys(registry.PUBLIC_COPY_SCOPES)) {
    const entries=registry.publicCopyInitialEntries(scope);const document={_id:registry.publicCopyDocumentId(scope),_type:'publicPageCopy',scope,locale:'th',entries};
    assert.deepEqual(registry.parsePublicCopy(scope,document),registry.parsePublicCopy(scope,null));
    for(const patch of [{_id:'drafts.'+document._id},{_id:document._id+'.private'},{scope:'wrong'},{locale:'en'},{entries:[entries[0],entries[0]]},{entries:[{key:'unowned',text:'แก้'}]},{entries:[{...entries[0],text:'<script>alert(1)</script>'}]},{entries:[{...entries[0],text:''}]}])assert.throws(()=>registry.parsePublicCopy(scope,{...document,...patch}));
    const interpolated=entries.find(entry=>/\{[a-zA-Z0-9_]+\}/.test(entry.text));if(interpolated)assert.throws(()=>registry.parsePublicCopy(scope,{...document,entries:[{...interpolated,text:'missing placeholder'}]}),/PLACEHOLDER/);
  }
  assert.ok(registry.PUBLIC_COPY_SCOPES.cookies.defaults['cookies.p18'].includes('Settings > Privacy'));
  const values=Object.values(loadFixtureModule('lib/content/money-story-copy-defaults.ts').MONEY_STORY_COPY_DEFAULTS);assert.equal(new Set(values).size,values.length,'reverse translation has one canonical key per original value');
});
function seoResolver(data,{environment='production',fail=false}={}) {
  const requests=[];const fixtureModule=loadFixtureModule('lib/seo/page-seo.ts',{mocks:new Map([
    ['@/lib/content/sanity-lane',{resolveContentEnvironment:()=>environment}],
    ['@/lib/content/sanity-fetch',{sanityFetch:async request=>{requests.push(request);if(fail)throw new Error('fixture-unavailable');return{data};}}],
  ])});return{resolve:fixtureModule.resolvePageSeoMetadata,requests};
}
test('SEO null, empty, malformed and unavailable records return the complete original metadata unchanged',async()=>{
  for(const scope of Object.keys(files).filter(s=>s!=='site')) {
    const defaults=await metadataFixture(scope);const pathname=registry.PUBLIC_COPY_SCOPES[scope].pathname;
    for(const data of [null,{}, {_id:'wrong',pathname,seoTitle:'wrong'}, {_id:loadFixtureModule('lib/content/page-seo-registry.ts').pageSeoDocumentId(pathname),pathname,seoTitle:'<script>'}])assert.equal(await seoResolver(data).resolve(pathname,defaults),defaults);
    assert.equal(await seoResolver(null,{fail:true}).resolve(pathname,defaults),defaults);
  }
  const denied=seoResolver({}, {environment:'admin-uat'});assert.equal(await denied.resolve('/',{}).then(v=>Object.keys(v).length),0);assert.equal(denied.requests.length,0);
});
test('SEO edits preserve indexing and canonical controls; only explicit sharing edits inherit sharing data',async()=>{
  const defaults=await metadataFixture('cookies');const record={_id:'pageSeo-cookie-policy',pathname:'/cookie-policy/',seoTitle:'ชื่อเจ้าของ',seoDescription:'คำอธิบายเจ้าของ'};
  const api=seoResolver(record),value=await api.resolve('/cookie-policy/',defaults,Promise.resolve({openGraph:{images:[{url:'https://ccpun.com/parent.webp'}]}}));
  assert.equal(value.title,record.seoTitle);assert.equal(value.description,record.seoDescription);assert.deepEqual(value.robots,{index:false,follow:true});assert.deepEqual(value.alternates,defaults.alternates);assert.equal(value.openGraph,defaults.openGraph);assert.equal(value.openGraph.images,undefined);
  assert.equal(api.requests[0].perspective,'published');assert.deepEqual(api.requests[0].params,{id:'pageSeo-cookie-policy',pathname:'/cookie-policy/'});
  assert.equal(await seoResolver({...record,seoTitle:' ',seoDescription:null}).resolve('/cookie-policy/',defaults),defaults);
  const shared=await seoResolver({...record,ogTitle:'ชื่อแชร์',ogImageUrl:'https://cdn.sanity.io/images/kyfxgjnq/production/asset-1200x630.webp'}).resolve('/cookie-policy/',defaults);
  assert.equal(shared.openGraph.title,'ชื่อแชร์');assert.equal(shared.openGraph.images[0].url,'https://cdn.sanity.io/images/kyfxgjnq/production/asset-1200x630.webp');assert.deepEqual(shared.robots,defaults.robots);
  const image=loadFixtureModule('lib/content/page-seo-registry.ts').isPageSeoImageUrlAllowed;
  assert.equal(image('https://cdn.sanity.io/images/kyfxgjnq/production/asset-1200x630.webp'),true);
  for(const url of ['https://cdn.sanity.io/images/ccb9lnw5/uat/asset-1200x630.webp','https://cdn.sanity.io/images/other/production/asset.webp','https://evil.invalid/asset.webp','https://ccpun.com/assets/%2e%2e/private.webp','https://user@ccpun.com/assets/a.webp'])assert.equal(image(url),false,url);
});
test('Production preview authorizes before reads and refuses wrong lane, scope or data-plane identity',async()=>{
  for(const config of [{denied:true,environment:'production-admin',allowed:true},{environment:'web-uat',allowed:true},{environment:'production-admin',allowed:false},{environment:'production-admin',allowed:true,scope:'investment'}]) {
    const trace=[];let queries=0;const api=loadFixtureModule('lib/admin/public-copy-preview.ts',{mocks:new Map([
      ['@/lib/admin/require-permission',{requireAdminPermission:async permission=>{trace.push(permission);if(config.denied)throw new Error('fixture-denied');}}],
      ['@/lib/admin/environment',{getAdminEnvironment:()=>config.environment,isAdminReadDataPlaneAllowed:()=>config.allowed}],
      ['../content/sanity-fetch',{sanityFetch:async()=>{queries++;assert.fail('unauthorized CMS read');}}],
    ])});await assert.rejects(api.getPublicCopyPreview(config.scope??'home'));assert.deepEqual(trace,['draft:apply']);assert.equal(queries,0,'denied preview cannot issue a query even if its rejection is caught');
  }
});
test('authorized preview reads only fixed original scope and site singletons using draft perspective',async()=>{
  const trace=[],key='ci.expenses.monthlyIncome.label';
  const copy={_id:'publicPageCopy-ci-th',_type:'publicPageCopy',scope:'ci',locale:'th',entries:[{key,text:'DRAFT CI LABEL'}]};
  const site={_id:'publicPageCopy-site-th',_type:'publicPageCopy',scope:'site',locale:'th',entries:[{key:'site.footerDisclaimer',text:'DRAFT SITE FOOTER'}]};
  const records={'publicPageCopy-ci-th':copy,'publicPageCopy-site-th':site,'pageSeo-ci-planning':{seoTitle:'DRAFT CI SEO'}};
  const api=loadFixtureModule('lib/admin/public-copy-preview.ts',{mocks:new Map([
    ['@/lib/admin/require-permission',{requireAdminPermission:async permission=>trace.push(['permission',permission])}],
    ['@/lib/admin/environment',{getAdminEnvironment:()=> 'production-admin',isAdminReadDataPlaneAllowed:(dataset,environment)=>{assert.equal(dataset,'production');assert.equal(environment,'production-admin');return true;}}],
    ['../content/sanity-fetch',{sanityFetch:async request=>{assert.equal(request.perspective,'drafts');assert.ok(Object.hasOwn(records,request.params.id));if(request.params.id==='pageSeo-ci-planning')assert.deepEqual(request.params,{id:'pageSeo-ci-planning',pathname:'/ci-planning/'});else assert.deepEqual(request.params,{id:request.params.id});trace.push(['read',request.params.id]);return{data:records[request.params.id]};}}],
  ])});const result=await api.getPublicCopyPreview('ci');assert.deepEqual(trace,[['permission','draft:apply'],['read','publicPageCopy-ci-th'],['read','publicPageCopy-site-th'],['read','pageSeo-ci-planning']]);assert.deepEqual(result.copy,registry.parsePublicCopy('ci',copy));assert.deepEqual(result.site,registry.parsePublicCopy('site',site));assert.equal(result.copy[key],'DRAFT CI LABEL');assert.equal(result.seo.seoTitle,'DRAFT CI SEO');
});

test('money labels translate presentation only and retain original identifiers and numerical game state',()=>{
  const domain=loadFixtureModule('lib/content/money-story-copy-defaults.ts');const engine=loadFixtureModule('features/money-story/engine.ts');const game=engine.createGame('same-word-copy','gam'),before=JSON.stringify(game);
  const key=Object.keys(domain.MONEY_STORY_COPY_DEFAULTS).find(key=>domain.MONEY_STORY_COPY_DEFAULTS[key]==='แก้ม');const values={...domain.MONEY_STORY_COPY_DEFAULTS,[key]:'ชื่อที่แก้ผ่าน Sanity'};
  assert.equal(domain.moneyStoryLabel('แก้ม',key=>values[key]),'ชื่อที่แก้ผ่าน Sanity');assert.equal(domain.moneyStoryLabel('gam',key=>values[key]),'gam');assert.equal(JSON.stringify(game),before);
});

const articleBaseline = [
  "34c4e1c52d8f5d3f3c7d25ec6eae0f32a9b38e40d5c7f6680d575c4bb990efc5",
  "c45cd0aefd771abec6e8b8503711d3ec2711c88074b27936f8785ac010904c55",
  "5c84973604db5c04095c4e1c59340d7c6c4fd11ec745f8174400f75761b4886c"
];
test('original article fallback and managed author branches retain complete b871 rendering',async()=>{
  const base={id:'article-fixture',slug:'article-fixture',title:'บทความเจ้าของ',excerpt:'คำอธิบาย',category:'การเงินส่วนบุคคล',categorySlug:'personal-finance',status:'published',publishedAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-02T00:00:00Z',tags:[],body:[{type:'heading',level:2,text:'หัวข้อ'},{type:'paragraph',text:'เนื้อหา'}]};
  const articles=[base,{...base,authorName:'ผู้เขียนภายนอก'},{...base,author:{name:'ผู้เขียนจัดการ',professionalQualifications:[{shortName:'CFP',identifier:'123'}],profileRole:'บทบาท',profileBio:'ประวัติ',profileCtaLabel:'อ่านประวัติ',profileCtaUrl:'#about-ccpun',profileAvatar:{src:'/assets/ccpun.webp',alt:'ชื่อผู้เขียน',width:96,height:96}}}];
  for(const[index,article]of articles.entries()) {
    const html = await renderFixture('blog',{preview:index===2},{article});
    assert.equal(digest(inverseCanonicalShellLinks(html,'article')),articleBaseline[index]);
    if(index===0){
      const breadcrumb=html.match(/<nav\b[^>]*class="breadcrumbs"[^>]*>[\s\S]*?<\/nav>/g);assert.equal(breadcrumb?.length,1);
      assert.equal(breadcrumb[0].split('href="/blog/"').length-1,1,'actual Article breadcrumb links directly to canonical Blog URL');
      for(const mutant of ['',breadcrumb[0].replace('href="/blog/"','href="https://foreign.invalid/blog/"')])assert.throws(()=>inverseCanonicalShellLinks(html.replace(breadcrumb[0],mutant),'article'));
    }
  }
});
test('public reader transmits only validated published edits independently of draft flags and cookies',async()=>{
  const key='home.hero.eyebrow',document={_id:'publicPageCopy-home-th',_type:'publicPageCopy',scope:'home',locale:'th',entries:[{key,text:'ข้อความที่แก้'}]};
  for(const previewAllowed of [false,true])for(const cookieEnabled of [false,true])for(const data of [null,document,{...document,_id:'private.document'},{...document,entries:[{key,text:'<script>'}]},'unavailable']) {
    let draftReads=0;const requests=[];const api=loadFixtureModule('lib/content/public-copy.ts',{mocks:new Map([
      ['react',{cache:fn=>fn}],['next/headers',{draftMode:async()=>{draftReads++;return{isEnabled:cookieEnabled};}}],
      ['../deployment-environment',{IS_DRAFT_PREVIEW_ALLOWED:previewAllowed}],
      ['./sanity-fetch',{sanityFetch:async request=>{requests.push(request);if(data==='unavailable')throw new Error('fixture-unavailable');return{data};}}],
    ])});const result=await api.getPublicCopy('home');assert.deepEqual(result,data===document?{[key]:'ข้อความที่แก้'}:{});assert.equal(requests.length,1);assert.equal(requests[0].perspective,'published');assert.deepEqual(requests[0].params,{id:'publicPageCopy-home-th'});assert.equal(requests[0].query,'*[_id == $id && _type == "publicPageCopy"][0]{_id, _type, scope, locale, entries[]{_key, key, text}}');assert.equal(draftReads,0,`generic reader must not consult draft cookies: ${previewAllowed}/${cookieEnabled}`);assert.equal(registry.publicCopyText(result)('home.hero.description'),registry.PUBLIC_COPY_SCOPES.home.defaults['home.hero.description']);
  }
});

test('fixed SEO singleton drafts initialize their read-only pathname without a Production seed migration',()=>{
  const schema=loadFixtureModule('cms/sanity/schema/documents/page-seo.ts',{mocks:new Map([['sanity',{defineType:value=>value,defineField:value=>value}]])}).pageSeo;
  const pages=loadFixtureModule('lib/content/page-seo-registry.ts').PAGE_SEO_PAGES;assert.equal(pages.length,7);
  for(const page of pages)assert.deepEqual(schema.initialValue({pathname:page.pathname}),{pathname:page.pathname});
  assert.deepEqual(schema.initialValue({pathname:'/tools/investment-allocation/'}),{});assert.deepEqual(schema.initialValue({}),{});
  assert.equal(schema.fields.find(field=>field.name==='pathname').readOnly,true);
  assert.ok(readFileSync('cms/sanity/config/structure.ts','utf8').includes('.documentId(page.documentId).initialValueTemplate("pageSeo", { pathname: page.pathname })'));
});
test('protected preview page cannot start its author query before scoped authorization finishes',async()=>{
  let authorReads=0;const mocks=new Map([
    ['@/lib/admin/public-copy-preview',{getPublicCopyPreview:async()=>{throw new Error('fixture-denied');}}],
    ['@/lib/content/sanity',{getPrimaryAuthorPreviewProfile:async()=>{authorReads++;return null;}}],
    ['@/features/home/website-43/Website43Home',{__esModule:true,default:()=>null}],
    ['@/features/ci-planning/page',{renderCiPlanningPage:()=>null}],
    ['@/features/financial-health-check/page',{renderFinancialHealthCheckPage:()=>null}],
    ['@/features/blog/pages/BlogArchivePage',{renderBlogPage:()=>null}],
    ['@/features/legal/pages/PrivacyPage',{renderPrivacyPage:()=>null}],
    ['@/features/legal/pages/CookiePolicyPage',{renderCookiePolicyPage:()=>null}],
    ['@/features/money-story/page',{renderMoneyStoryPage:()=>null}],
  ]);const page=loadFixtureModule('apps/admin/app/(control-plane)/content/website-preview/page.tsx',{mocks});await assert.rejects(page.default({searchParams:Promise.resolve({scope:'home'})}),/fixture-denied/);assert.equal(authorReads,0);
});
test('copy and SEO preview links require registered page and matching fixed published or draft ID',()=>{
  const config=loadFixtureModule('cms/sanity/config/presentation.ts',{mocks:new Map([['sanity/presentation',{defineLocations:value=>value,presentationTool:value=>value}]])}).createStudioPresentationPlugin();
  const pages=loadFixtureModule('lib/content/page-seo-registry.ts');
  for(const[scope,page]of Object.entries(registry.PUBLIC_COPY_SCOPES)) {
    for(const prefix of ['', 'drafts.'])assert.equal(config.resolve.locations.publicPageCopy.resolve({id:prefix+registry.publicCopyDocumentId(scope),scope}).locations[0].href,'/content/website-preview/'+scope+'/');
    assert.deepEqual(config.resolve.locations.publicPageCopy.resolve({id:'wrong',scope}).locations,[]);
    if(scope==='site')continue;
    for(const prefix of ['', 'drafts.'])assert.deepEqual(config.resolve.locations.pageSeo.resolve({id:prefix+pages.pageSeoDocumentId(page.pathname),pathname:page.pathname}).locations,[{title:'ดูฉบับร่างหน้าเว็บไซต์และ SEO',href:'/content/website-preview/seo-'+scope+'/'}]);
    assert.deepEqual(config.resolve.locations.pageSeo.resolve({id:'wrong',pathname:page.pathname}).locations,[]);
  }
  for(const pathname of ['*','/tools/investment-allocation/','https://evil.invalid/','/new-page/'])assert.deepEqual(config.resolve.locations.pageSeo.resolve({id:'pageSeo-home',pathname}).locations,[]);
  assert.deepEqual(config.resolve.locations.pageSeo.resolve(null).locations,[]);assert.deepEqual(config.resolve.locations.publicPageCopy.resolve({scope:'investment',id:'publicPageCopy-investment-th'}).locations,[]);
});
test('fixed singletons initialize validated editable drafts and authorize only exact Production page publishing',()=>{
  const definitions=new Map([['sanity',{defineType:value=>value,defineField:value=>value,defineArrayMember:value=>value}]]);
  const copy=loadFixtureModule('cms/sanity/schema/documents/public-page-copy.ts',{mocks:definitions}).publicPageCopy;
  for(const scope of Object.keys(registry.PUBLIC_COPY_SCOPES)) {
    const draft={...copy.initialValue({scope}),_type:'publicPageCopy',_id:'drafts.'+registry.publicCopyDocumentId(scope)};
    assert.equal(copy.validation({custom:fn=>fn})(draft),true);assert.notEqual(copy.validation({custom:fn=>fn})({...draft,_id:'wrong'}),true);
  }
  assert.equal(copy.fields.find(field=>field.name==='scope').readOnly,true);assert.equal(copy.fields.find(field=>field.name==='entries').of[0].fields.find(field=>field.name==='text').type,'text');
  const policy=loadFixtureModule('cms/sanity/policy/studio-policy.ts',{mocks:new Map([['../../../lib/admin/environment',{isStudioDataPlaneAllowed:()=>true}]])});
  const actions=['publish','delete','unpublish','unpublishVersion','discardChanges'].map(action=>({action}));
  for(const type of ['publicPageCopy','pageSeo']) {
    assert.deepEqual(policy.filterStudioDocumentActions(actions,'production','production-admin',type,'kyfxgjnq',type==='publicPageCopy'?'publicPageCopy-home-th':'pageSeo-home').map(item=>item.action),['publish','discardChanges']);
    for (const [dataset,environment,project] of [['uat','production-admin','kyfxgjnq'],['production','production-admin','ccb9lnw5'],['production','local-production','kyfxgjnq']]) assert.deepEqual(policy.filterStudioDocumentActions(actions,dataset,environment,type,project),[]);
    const allowed=policy.filterStudioDocumentActions(actions,'uat','admin-uat',type,'ccb9lnw5');assert.ok(allowed.some(item=>item.action==='publish'));assert.ok(!allowed.some(item=>['delete','unpublish','unpublishVersion'].includes(item.action)));
  }
  const items=[{getId:()=> 'publicPageCopy'},{getId:()=> 'pageSeo'}];assert.deepEqual(policy.filterStudioStructureItems(items,'production-admin'),items);assert.deepEqual(policy.filterStudioNewDocumentOptions(items.map(item=>({templateId:item.getId()})),'production','production-admin','kyfxgjnq'),[]);
});
test('the same curated code supports authorized UAT acceptance through its exact UAT bindings',async()=>{
  const defaults=await metadataFixture('home');const seo=seoResolver({_id:'pageSeo-home',pathname:'/',seoTitle:'UAT verification'}, {environment:'web-uat'});assert.equal((await seo.resolve('/',defaults)).title,'UAT verification');assert.equal(seo.requests[0].perspective,'published');
  const trace=[];const api=loadFixtureModule('lib/admin/public-copy-preview.ts',{mocks:new Map([
    ['@/lib/admin/require-permission',{requireAdminPermission:async permission=>trace.push(permission)}],
    ['@/lib/admin/environment',{getAdminEnvironment:()=> 'admin-uat',isAdminReadDataPlaneAllowed:(dataset,environment)=>{assert.equal(dataset,'uat');assert.equal(environment,'admin-uat');return true;}}],
    ['../content/sanity-fetch',{sanityFetch:async request=>{assert.equal(request.perspective,'drafts');trace.push(request.params.id);return{data:null};}}],
  ])});assert.deepEqual((await api.getPublicCopyPreview('home')).copy,registry.parsePublicCopy('home',null));assert.equal(trace[0],'draft:apply');assert.equal(trace.length,4);
});
test('Sanity OG uploads stay in the matching fixed UAT or Production image pair',async()=>{
  const image=loadFixtureModule('lib/content/page-seo-registry.ts').isPageSeoImageUrlAllowed;
  const prod='https://cdn.sanity.io/images/kyfxgjnq/production/image-1200x630.webp',uat='https://cdn.sanity.io/images/ccb9lnw5/uat/image-1200x630.webp';
  assert.equal(image(prod,'production'),true);assert.equal(image(uat,'uat'),true);assert.equal(image(uat,'production'),false);assert.equal(image(prod,'uat'),false);assert.equal(image('https://test.ccpun.com/assets/image.webp','production'),false);
  const defaults=await metadataFixture('home'),record={_id:'pageSeo-home',pathname:'/',ogImageUrl:uat};assert.equal((await seoResolver(record,{environment:'web-uat'}).resolve('/',defaults)).openGraph.images[0].url,uat);assert.equal(await seoResolver(record,{environment:'production'}).resolve('/',defaults),defaults);
  const schema=loadFixtureModule('cms/sanity/schema/documents/page-seo.ts',{mocks:new Map([['sanity',{defineType:value=>value,defineField:value=>value}]]),globals:{process:{env:{NEXT_PUBLIC_SANITY_PROJECT_ID:'ccb9lnw5',NEXT_PUBLIC_SANITY_DATASET:'uat'}}}}).pageSeo;
  const rule={uri(){return this},custom(fn){return fn}};const check=schema.fields.find(field=>field.name==='ogImageUrl').validation(rule);assert.equal(check(uat),true);assert.notEqual(check(prod),true);
});

// Native Presentation preserves calculator state by refreshing server data, not reloading the iframe.
test('native Presentation mutation refresh remains preview-only and starts on the full Home preview',async()=>{
  const callbacks=[];let refreshes=0;const component=loadFixtureModule('components/preview/LiveVisualEditing.tsx',{mocks:new Map([
    ['next/navigation',{useRouter:()=>({refresh:()=>refreshes++})}],
    ['next-sanity/visual-editing',{VisualEditing:props=>{callbacks.push(props.refresh);return null;}}],
  ])}).default;renderToStaticMarkup(React.createElement(component));
  for(const source of ['mutation','manual'])await callbacks[0]({source});assert.equal(refreshes,2);
  const plugin=loadFixtureModule('cms/sanity/config/presentation.ts',{mocks:new Map([['sanity/presentation',{defineLocations:v=>v,presentationTool:v=>v}]])}).createStudioPresentationPlugin();
  assert.equal(plugin.previewUrl.initial,'/content/website-preview/home/');
  assert.ok(readFileSync('components/preview/DraftPreviewRuntime.tsx','utf8').includes('import("./LiveVisualEditing")'));
  for(const path of ['lib/content/sanity-fetch.ts','lib/content/public-copy.ts','apps/web/app/layout.tsx'])assert.ok(!/LiveVisualEditing|next-sanity\/visual-editing/.test(readFileSync(path,'utf8')),path);
});
test('all original fully populated SEO records preserve original sharing fields including deliberately absent images',async()=>{
  const pages=loadFixtureModule('lib/content/page-seo-registry.ts').PAGE_SEO_PAGES;
  const root=await metadataFixture('home');
  for(const page of pages){
    const scope=Object.entries(registry.PUBLIC_COPY_SCOPES).find(([s,p])=>s!=='site'&&p.pathname===page.pathname)[0];
    const defaults=await metadataFixture(scope);
    const record={_id:page.documentId,pathname:page.pathname,...page.defaults};
    const value=await seoResolver(record).resolve(page.pathname,defaults,Promise.resolve(root));
    assert.equal(value.title,defaults.title,page.pathname);assert.equal(value.description,defaults.description,page.pathname);
    assert.deepEqual(value.openGraph,defaults.openGraph,page.pathname);assert.deepEqual(value.twitter,defaults.twitter,page.pathname);
    assert.deepEqual(value.robots,defaults.robots);assert.deepEqual(value.alternates,defaults.alternates);
  }
});

test('fully seeded original copy adds zero browser override payload while actual edits still transmit',async()=>{
  for(const scope of Object.keys(registry.PUBLIC_COPY_SCOPES)){
    const entries=registry.publicCopyInitialEntries(scope);
    for(const changed of [false,true]){
      const edited=entries.map((entry,index)=>changed&&index===0?{...entry,text:entry.text+' · ตัวอย่าง'}:entry);
      const data={_id:registry.publicCopyDocumentId(scope),_type:'publicPageCopy',scope,locale:'th',entries:edited};
      const api=loadFixtureModule('lib/content/public-copy.ts',{mocks:new Map([['react',{cache:fn=>fn}],['./sanity-fetch',{sanityFetch:async()=>({data})}]])});
      const values=await api.getPublicCopy(scope);
      assert.deepEqual(values,changed?{[edited[0].key]:edited[0].text}:{},scope);
      assert.equal(registry.publicCopyText(values)(edited.at(-1).key),entries.at(-1).text);
    }
  }
});

test('Production page actions admit only the fixed original singleton IDs and leave articles unchanged',()=>{
  const policy=loadFixtureModule('cms/sanity/policy/studio-policy.ts',{mocks:new Map([['../../../lib/admin/environment',{isStudioDataPlaneAllowed:()=>true}]])});
  const actions=['publish','delete','unpublish','unpublishVersion','discardChanges','restore'].map(action=>({action}));
  const pages=loadFixtureModule('lib/content/page-seo-registry.ts').PAGE_SEO_PAGES;
  for(const[type,ids]of [['publicPageCopy',Object.keys(registry.PUBLIC_COPY_SCOPES).map(registry.publicCopyDocumentId)],['pageSeo',pages.map(p=>p.documentId)]]){
    for(const id of ids)for(const prefix of ['', 'drafts.'])assert.deepEqual(policy.filterStudioDocumentActions(actions,'production','production-admin',type,'kyfxgjnq',prefix+id).map(a=>a.action),['publish','discardChanges','restore']);
    for(const id of [undefined,'unknown','publicPageCopy-investment-th','pageSeo-investment-allocation','versions.release.publicPageCopy-home-th',type==='publicPageCopy'?'pageSeo-home':'publicPageCopy-home-th'])assert.deepEqual(policy.filterStudioDocumentActions(actions,'production','production-admin',type,'kyfxgjnq',id),[]);
  }
  assert.deepEqual(policy.filterStudioDocumentActions(actions,'production','production-admin','article','kyfxgjnq','existing-article').map(a=>a.action),['publish','delete','unpublish','discardChanges','restore']);
  assert.deepEqual(policy.filterStudioDocumentActions(actions,'production','production-admin','author','kyfxgjnq','ccpun-author-ccpun-profile').map(a=>a.action),['publish','discardChanges','restore']);
  const author=loadFixtureModule('cms/sanity/schema/documents/author.ts',{mocks:new Map([['sanity',{defineType:v=>v,defineField:v=>v,defineArrayMember:v=>v}]])}).author;
  for(const name of ['profileName','profileRole','professionalQualifications','professionalLicenses'])assert.notEqual(author.fields.find(field=>field.name===name).readOnly,true,name);
  assert.equal(author.fields.find(field=>field.name==='credentials').readOnly,true,'deprecated credential field stays protected');
  assert.ok(readFileSync('sanity.config.ts','utf8').includes('context.schemaType, projectId, context.documentId)'));
});
test('private full-width preview omits Admin chrome only on its exact route after server authorization',()=>{
  for(const pathname of ['/content/website-preview/','/content/website-preview',...Object.keys(registry.PUBLIC_COPY_SCOPES).flatMap(scope=>['/content/website-preview/'+scope+'/']),...Object.keys(registry.PUBLIC_COPY_SCOPES).filter(s=>s!=='site').map(scope=>'/content/website-preview/seo-'+scope+'/'),'/content/website-preview/author-home/','/content/website-preview/seo-site/','/content/website-preview/home/evil','/content/website-preview/evil','/content/website-preview-evil/','/dashboard/','/studio/']){
    const component=loadFixtureModule('features/admin/components/AdminProtectedChrome.tsx',{mocks:new Map([
      ['next/navigation',{usePathname:()=>pathname}],['./AdminDataRefresh',{__esModule:true,default:()=>null}],['./AdminNavigation',{__esModule:true,default:()=>null}],
    ])}).AdminProtectedChrome;
    const html=renderToStaticMarkup(React.createElement(component,{title:'ADMIN CHROME',currentEnvironmentLabel:'Production',identityLabel:'Owner',role:'owner',navItems:[],showInbox:false,showLogout:false,logout:async()=>{},safety:null},React.createElement('section',null,'PUBLIC PAGE PREVIEW')));
    if(['/content/website-preview/','/content/website-preview',...Object.keys(registry.PUBLIC_COPY_SCOPES).map(scope=>'/content/website-preview/'+scope+'/'),...Object.keys(registry.PUBLIC_COPY_SCOPES).filter(s=>s!=='site').map(scope=>'/content/website-preview/seo-'+scope+'/'),'/content/website-preview/author-home/'].includes(pathname))assert.equal(html,'<section>PUBLIC PAGE PREVIEW</section>');else assert.ok(html.includes('ADMIN CHROME'),pathname);
  }
  const layout=readFileSync('apps/admin/app/(control-plane)/layout.tsx','utf8');assert.ok(layout.indexOf('await auth()')<layout.indexOf('return <AdminProtectedChrome'));assert.ok(layout.includes('if (!role) redirect("/login/")'));
});

test('native Presentation selects the exact page copy or SEO form for every private preview URL',async()=>{
  const plugin=loadFixtureModule('cms/sanity/config/presentation.ts',{mocks:new Map([['sanity/presentation',{defineLocations:v=>v,presentationTool:v=>v}]])}).createStudioPresentationPlugin();
  const resolve=plugin.resolve.mainDocuments[0].resolve;const pages=loadFixtureModule('lib/content/page-seo-registry.ts');
  for(const[scope,config]of Object.entries(registry.PUBLIC_COPY_SCOPES)){
    assert.deepEqual(resolve({params:{scope}}),{filter:'_id == $id && _type == $type',params:{id:registry.publicCopyDocumentId(scope),type:'publicPageCopy'}});
    const page=pages.getPageSeoPage(config.pathname);
    assert.deepEqual(resolve({params:{scope:'seo-'+scope}}),page?{filter:'_id == $id && _type == $type',params:{id:page.documentId,type:'pageSeo'}}:undefined);
  }
  assert.deepEqual(resolve({params:{scope:'author-home'}}),{filter:'_type == "author" && _id in ["ccpun-author-ccpun-profile", "ccpun-prod-mirror-author-ccpun"]'});
  for(const id of ['ccpun-author-ccpun-profile','ccpun-prod-mirror-author-ccpun'])for(const prefix of ['', 'drafts.'])assert.equal(plugin.resolve.locations.author.resolve({id:prefix+id}).locations[0].href,'/content/website-preview/author-home/');assert.deepEqual(plugin.resolve.locations.author.resolve({id:'unowned-author'}).locations,[]);
  for(const scope of ['investment','seo-investment','unknown','home/evil','seo-site'])assert.equal(resolve({params:{scope}}),undefined);
  const route=loadFixtureModule('apps/admin/app/(control-plane)/content/website-preview/[scope]/page.tsx',{mocks:new Map([['next/navigation',{notFound:()=>{throw Error('fixture404')}}],['../page',{__esModule:true,default:()=>null}]])}).default;
  const authorRoute=await route({params:Promise.resolve({scope:'author-home'})});assert.equal((await authorRoute.props.searchParams).scope,'home');
  for(const requested of ['home','ci','site','seo-home','seo-moneyStory'])assert.equal((await(await route({params:Promise.resolve({scope:requested})})).props.searchParams).scope,requested.replace(/^seo-/,''));
  const filtered=await route({params:Promise.resolve({scope:'blog'}),searchParams:Promise.resolve({scope:'investment',q:'คำค้น',page:'2'})});assert.deepEqual(await filtered.props.searchParams,{scope:'blog',q:'คำค้น',page:'2'});
  for(const requested of ['investment','seo-site','unknown','home/evil'])await assert.rejects(route({params:Promise.resolve({scope:requested})}),/fixture404/);
});
