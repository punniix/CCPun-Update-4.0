import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadFixtureModule} from '../qa/phase1-fixture-loader.mjs';
const require=createRequire(import.meta.url);
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {JSDOM}=require('jsdom');
const registry=loadFixtureModule('lib/content/public-copy-registry.ts');
const seoRegistry=loadFixtureModule('lib/content/page-seo-registry.ts');
const category=require('tsx/cjs/api').require('../lib/content/category-registry.ts',import.meta.url);
const css={__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
const cssMocks=new Map([['./V5.module.css',css],['./V5Blog.module.css',css],['./V5ChatDock.module.css',css],['@/components/layout/v5/V5.module.css',css]]);
function seoReader(data,environment='web-uat') {
 const calls=[];
 const api=loadFixtureModule('lib/seo/page-seo.ts',{mocks:new Map([
  ['@/lib/content/sanity-lane',{resolveContentEnvironment:()=>environment}],
  ['@/lib/content/sanity-fetch',{sanityFetch:async request=>{calls.push(request);return{data:typeof data==='function'?data(request):data};}}],
 ])});return{api,calls};
}
function previewReader({response,environment='admin-uat',allowed=true,denied=false}={}) {
 const calls=[];
 const api=loadFixtureModule('lib/admin/public-copy-preview.ts',{mocks:new Map([
  ['./require-permission',{requireAdminPermission:async permission=>{calls.push(['permission',permission]);if(denied)throw Error('denied');}}],
  ['./environment',{getAdminEnvironment:()=>environment,isAdminReadDataPlaneAllowed:()=>allowed}],
  ['../content/sanity-fetch',{sanityFetch:async request=>{calls.push(['read',request]);return{data:response?response(request):null};}}],
 ])});return{api,calls};
}
test('all fixed/fallback SEO owners keep prior identities/defaults and have one bounded private editor target',()=>{
 // Frozen Production identities/defaults; runnable in a shallow CI checkout.
 const prior={
  '/':'07d40ae86133b33e5e9b797fe6b4d59839fed6b39b9cdd21c359d1008aadb4a1',
  '/blog/':'b1eabbc55a6a55bb8c4e4ddf491e2d2af70370adac0e2b6d5bb56480128f71f3',
  '/ci-planning/':'de5a51ec335b3c306bea0dd46d63186f0141de52dd4845d0726c1045c33f6760',
  '/tools/financial-health-check/':'c62beec697a076eedb721313f0ed4c6979e0af4078b2e29ac6617896d0cc2034',
  '/play/money-story/':'c17ecb620bf307e7e3a03663f9bf448bf4b6562f113a43d7037fae237357103f',
  '/privacy/':'b8c2622309f39d3585c2ce39a54919510e5152378864d3dd8a3d2430e5d2aed9',
  '/cookie-policy/':'a1e1a8757546f4bc7b55e5865c6fd93487d32e50c81ea0e79a65c36f30c10ad3',
 };
 for(const [path,digest]of Object.entries(prior))assert.equal(createHash('sha256').update(JSON.stringify(seoRegistry.getPageSeoPage(path))).digest('hex'),digest,path+': all original properties and default words');
 assert.equal(seoRegistry.PAGE_SEO_PAGES.length,19);
 assert.equal(new Set(seoRegistry.PAGE_SEO_PAGES.map(p=>p.documentId)).size,19);
 for(const page of seoRegistry.PAGE_SEO_PAGES){assert.ok(seoRegistry.pageSeoPreviewScope(page));assert.equal(seoRegistry.getPageSeoPreviewPage(seoRegistry.pageSeoPreviewScope(page)),page);}
 for(const key of ['site','unknown','investment/evil','../home'])assert.equal(seoRegistry.getPageSeoPreviewPage(key),undefined);
 assert.ok(seoRegistry.getPageSeoPreviewPage('investment').metadataOnly);
 assert.ok(seoRegistry.getPageSeoPreviewPage('aiaFund').metadataOnly);
 assert.ok(seoRegistry.getPageSeoPreviewPage('comingSoon').metadataOnly);
 const tools=seoRegistry.getPageSeoPage('/tools/').defaults;
 assert.equal(tools.seoTitle,'เครื่องมือวางแผนการเงิน ประกัน และการลงทุน | CCPun');
 assert.equal(tools.seoDescription,'รวมเครื่องมือของ CCPun ไว้ที่เดียว ทั้งวางแผนเงินก้อนโรคร้ายแรง ตรวจทุนประกันชีวิต เกมจำลองชีวิตการเงิน 12 เดือน ลองใช้เองก่อน แล้วค่อยคุยกับปั้นทาง LINE');
 assert.doesNotMatch(tools.seoDescription,/จัดพอร์ต|กองทุน|AIA/);
});
test('published SEO overrides title/description for every owner without changing canonical/robots/URLs',async()=>{
 for(const page of seoRegistry.PAGE_SEO_PAGES){
  const defaults={title:'Original title',description:'Original description',alternates:{canonical:page.pathname==='__not_found__'?null:'https://ccpun.com'+page.pathname},robots:{index:false,follow:true},openGraph:{url:'https://ccpun.com/original/',images:['https://ccpun.com/og-image.webp']}};
  const {api,calls}=seoReader(req=>({_id:req.params.id,pathname:req.params.pathname,seoTitle:'Owner title',seoDescription:'Owner description'}));
  const actual=await api.resolvePageSeoMetadata(page.pathname,defaults);
  assert.equal(actual.title,'Owner title');assert.equal(actual.description,'Owner description');assert.deepEqual(actual.alternates,defaults.alternates);assert.deepEqual(actual.robots,defaults.robots);assert.equal(actual.openGraph.url,defaults.openGraph.url);
  assert.deepEqual(calls[0].params,{id:page.documentId,pathname:page.pathname});assert.equal(calls[0].perspective,'published');assert.equal(calls[0].stega,false);
  for(const bad of [null,{_id:'wrong',pathname:page.pathname,seoTitle:'Wrong'}, {_id:page.documentId,pathname:page.pathname,seoTitle:'<script>x</script>'},{_id:page.documentId,pathname:page.pathname,seoDescription:'x'.repeat(321)},{_id:page.documentId,pathname:page.pathname,unknown:'x'}])assert.deepEqual(await seoReader(bad).api.resolvePageSeoMetadata(page.pathname,defaults),defaults);
 }
 const invalid=seoReader(null,'unknown');assert.deepEqual(await invalid.api.resolvePageSeoMetadata('/about/',{title:'Fallback'}),{title:'Fallback'});assert.equal(invalid.calls.length,0);
});
test('private fixed SEO preview checks permission/lane/identity, displays missing draft defaults, and reads no renderer or article',async()=>{
 for(const page of seoRegistry.PAGE_SEO_PAGES){
  const {api,calls}=previewReader();const result=await api.getPageSeoPreview(seoRegistry.pageSeoPreviewScope(page));assert.deepEqual(result.seo,page.defaults);assert.equal(result.schemaType,'pageSeo');assert.equal(calls[0][0],'permission');assert.equal(calls.filter(c=>c[0]==='read').length,1);assert.equal(calls[1][1].perspective,'drafts');assert.equal(calls[1][1].params.id,page.documentId);
 }
 for(const opts of [{denied:true},{allowed:false},{environment:'web-uat'}]){const {api,calls}=previewReader(opts);await assert.rejects(api.getPageSeoPreview('investment'));assert.equal(calls.filter(c=>c[0]==='read').length,0);}
 const bad=previewReader({response:()=>({_id:'wrong',pathname:'/about/',seoTitle:'Wrong'})});await assert.rejects(bad.api.getPageSeoPreview('about'),/IDENTITY/);
 const unknown=previewReader();await assert.rejects(unknown.api.getPageSeoPreview('unknown'));assert.equal(unknown.calls.filter(c=>c[0]==='read').length,0);
});
test('Category optional SEO is independent, invalid SEO falls back without losing category route, and private preview targets same document',async()=>{
 const raw={_id:'category-life-insurance',title:'ประกันชีวิต',slug:'life-insurance',status:'active',description:'Visible category description',seoTitle:'Owner category title',seoDescription:'Owner category description'};
 const ctx={routeOwnerSlugs:[],canonicalOwnerUrls:[],referencedCategoryIds:[]};
 const actual=category.buildCategoryRegistry([raw],ctx);const entry=[...actual.entries??actual.categories??[]][0];
 assert.ok(actual.available);const resolved=category.resolveCategoryRoute(actual,'life-insurance',{includeDrafts:false});assert.equal(resolved.kind,'category');assert.equal(resolved.category.seoTitle,'Owner category title');assert.equal(resolved.category.description,'Visible category description');
 const invalid=category.resolveCategoryRoute(category.buildCategoryRegistry([{...raw,seoTitle:'<script>',seoDescription:'x'.repeat(321)}],ctx),'life-insurance',{includeDrafts:false});assert.equal(invalid.kind,'category');assert.equal(invalid.category.seoTitle,undefined);assert.equal(category.getCategoryCanonical(invalid.category.slug),category.getCategoryCanonical(resolved.category.slug));void entry;
 const {api,calls}=previewReader({response:req=>req.params.id===raw._id?{...raw}:null});const preview=await api.getCategorySeoPreview('category-doc-'+raw._id);assert.equal(preview.schemaType,'category');assert.ok(preview.displaySeo.seoTitle.startsWith('Owner category title'));assert.equal(calls[1][1].params.id,raw._id);assert.equal(calls[1][1].perspective,'drafts');assert.equal(calls[2][1].params.id,'publicPageCopy-blog-th');
 const bad=previewReader();await assert.rejects(bad.api.getCategorySeoPreview('category-doc-../article'));assert.equal(bad.calls.filter(c=>c[0]==='read').length,0);
});
test('actual Category page receives editable hub prose/featured wording and retains original destinations/full content',async()=>{
 const hub=loadFixtureModule('lib/content/taxonomy.ts').BLOG_TOPIC_HUBS.find(h=>h.featuredLink);
 const edits={};for(const [suffix,value]of Object.entries({title:'Owner hub title',intro1:'Owner complete introduction', 'featured.title':'Owner tool title','featured.description':'Owner tool description','featured.label':'Owner tool action'}))edits[`blog.hub.${hub.slug}.${suffix}`]=value;
 const mocks=new Map([...cssMocks,
 ['@/components/layout/v5/V5Page',{__esModule:true,default:({children})=>React.createElement('main',null,children)}],
 ['./V5ArticleCardEngagement',{__esModule:true,default:()=>null,V5CardMetricsProvider:({children})=>children}],
 ['./V5GroupPager',{__esModule:true,default:()=>null}],
 ]);
 const api=loadFixtureModule('features/blog/v5/V5Category.tsx',{mocks});const html=renderToStaticMarkup(await api.default({slug:hub.slug,title:hub.title,description:hub.description,hub,articles:[],topics:[],copy:edits}));const doc=new JSDOM(html).window.document;
 assert.equal(doc.querySelector('h1').textContent,'Owner hub title');assert.ok(doc.body.textContent.includes('Owner complete introduction'));assert.ok(doc.body.textContent.includes(hub.intro[1]));assert.ok(doc.body.textContent.includes('Owner tool description'));assert.equal([...doc.querySelectorAll('a')].find(a=>a.textContent==='Owner tool action').getAttribute('href'),hub.featuredLink.href);
});
test('shared Header labels receive actual Site edits; old defaults/persisted keys and invalid-copy guards remain',async()=>{
 const edits={'site.theme.light':'Owner light','site.theme.systemSwitch':'Owner system','site.chat.trigger':'Owner LINE','site.tools.all':'Owner tools'};
 const mocks=new Map([...cssMocks,['./shell-data',{getShellTopics:async()=>[]}],['./V5HeaderEnhancer',{__esModule:true,default:()=>null}],['./V5ChatLink',{__esModule:true,default:({children,href})=>React.createElement('a',{href},children)}],['@/lib/runtime/investment-availability',{INVESTMENT_ALLOCATION_ENABLED:false}]]);
 const api=loadFixtureModule('components/layout/v5/V5Header.tsx',{mocks});const doc=new JSDOM(renderToStaticMarkup(await api.default({siteCopy:edits}))).window.document;for(const value of Object.values(edits))assert.ok(doc.body.textContent.includes(value));assert.ok(doc.querySelector('[aria-label="Owner light"]'));
 for(const scope of Object.keys(registry.PUBLIC_COPY_SCOPES)){const entries=registry.publicCopyInitialEntries(scope);const original=registry.parsePublicCopy(scope,{_id:registry.publicCopyDocumentId(scope),_type:'publicPageCopy',scope,locale:'th',entries:[]});assert.deepEqual(original,registry.PUBLIC_COPY_SCOPES[scope].defaults);assert.throws(()=>registry.parsePublicCopy(scope,{_id:registry.publicCopyDocumentId(scope),_type:'publicPageCopy',scope,locale:'th',entries:[{...entries[0],text:'<script>'}]}));}
 assert.ok(registry.isPublicCopyScopeAvailable('about','production'));assert.ok(registry.isPublicCopyScopeAvailable('toolsHub','production'));assert.equal(registry.isPublicCopyScopeAvailable('investment','production'),false);
});
test('all registered copy fields have generated placements including complete new About, category and shared labels',()=>{
 const map=JSON.parse(readFileSync('lib/content/public-copy-locations.json','utf8'));
 for(const [scope,config]of Object.entries(registry.PUBLIC_COPY_SCOPES)){assert.deepEqual(Object.keys(map[scope].entries).sort(),Object.keys(config.defaults).sort());assert.deepEqual(Object.values(map[scope].entries).map(e=>e.order),Object.keys(map[scope].entries).map((_,i)=>i));}
 assert.equal(Object.keys(registry.PUBLIC_COPY_SCOPES.about.defaults).length,85);
 for(const key of ['about.hero.heading','about.how.step4.body','about.faq2.answer'])assert.ok(map.about.entries[key]);
});
test('About owner actual native-copy regression stays part of the common runner',()=>{
 execFileSync(process.execPath,['--import','tsx','--test','tests/about-native-copy.test.ts'],{stdio:'pipe',env:process.env});
});

test('actual Category metadata gives its document independent precedence; semantic fallback alone reads its bounded SEO owner',async()=>{
 const raw={_id:'category-life-insurance',title:'Visible title',slug:'life-insurance',status:'active',description:'Visible description',seoTitle:'Independent SEO title',seoDescription:'Independent SEO description'};
 const calls=[];
 const make=registryValue=>loadFixtureModule('features/blog/pages/BlogCategoryPage.tsx',{mocks:new Map([
  ['@/features/blog/v5/V5Category',{__esModule:true,default:()=>null}],
  ['@/lib/content/public-copy',{getPublicCopy:async()=>({})}],
  ['@/components/layout/v5/shell-data',{getPublishedCategoryRegistry:async()=>registryValue,getPublishedArticles:async()=>[]}],
  ['@/lib/content/category-registry-sanity',{listCategoryRegistry:async()=>registryValue}],
  ['@/lib/content/category-registry',category],
  ['@/lib/content/provider',{getContentProvider:()=>({listArticles:async()=>[]})}],
  ['@/lib/deployment-environment',{IS_DRAFT_PREVIEW_ALLOWED:false}],
  ['next/headers',{draftMode:async()=>({isEnabled:false})}],
  ['@/lib/seo/page-seo',{resolvePageSeoMetadata:async(path,defaults)=>{calls.push(path);return{...defaults,title:'Semantic owner title',description:'Semantic owner description'};}}],
 ])});
 const metadata=await make(category.buildCategoryRegistry([raw])).generateMetadata({params:Promise.resolve({category:raw.slug})});
 assert.equal(metadata.title,raw.seoTitle);assert.equal(metadata.description,raw.seoDescription);assert.deepEqual(metadata.alternates,{canonical:'https://ccpun.com/blog/life-insurance/'});assert.deepEqual(calls,[]);
 const fallback=await make(category.buildCategoryRegistry([])).generateMetadata({params:Promise.resolve({category:'life-insurance'})});
 assert.equal(fallback.title,'Semantic owner title');assert.equal(fallback.description,'Semantic owner description');assert.deepEqual(fallback.alternates,metadata.alternates);assert.deepEqual(fallback.robots,metadata.robots);assert.deepEqual(calls,['/blog/life-insurance/']);
});
