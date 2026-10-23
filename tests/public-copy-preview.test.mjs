import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const registry = loadFixtureModule('lib/content/public-copy-registry.ts');
const { cleanCopyText } = loadFixtureModule('lib/content/public-copy-text.ts');
// Decodes the @vercel/stega v1 payload Sanity Visual Editing reads.
function editTarget(value) {
  const digits = { '\u200B': 0, '\u200C': 1, '\u200D': 2, '\uFEFF': 3 };
  const start = value.indexOf('\u200B'.repeat(4));
  if (start === -1) return null;
  const marks = [...value.slice(start + 4)].filter(char => Object.hasOwn(digits, char));
  const bytes = [];
  for (let index = 0; index + 3 < marks.length; index += 4) bytes.push(marks.slice(index, index + 4).reduce((byte, char) => byte * 4 + digits[char], 0));
  return JSON.parse(new TextDecoder().decode(new Uint8Array(bytes)));
}

// Resolve async RSCs before React renders the real synchronous client components,
// so context/hooks execute inside React rather than through a manual function call.
async function resolveServer(node) {
  if (Array.isArray(node)) return Promise.all(node.map(resolveServer));
  if (!React.isValidElement(node)) return node;
  if (typeof node.type === 'function' && ['Website43Footer', 'ClientFHC'].includes(node.type.name)) return resolveServer(await node.type(node.props));
  const children = await resolveServer(node.props.children);
  return React.cloneElement(node, {}, ...(Array.isArray(children) ? children : [children]));
}

for (const [scope, key] of [['ci', 'ci.expenses.monthlyIncome.label'], ['fhc', 'fhc.wizard.placeholder']]) {
  test(`authenticated ${scope} preview renders draft client wizard, shared controls and server footer together`, async () => {
    const reads = [];
    const copy = { ...registry.parsePublicCopy(scope, null), [key]: `DRAFT ${scope} INPUT` };
    const site = { ...registry.parsePublicCopy('site', null), 'site.footerDisclaimer': 'DRAFT SITE FOOTER', 'site.cookie.settings': 'DRAFT COOKIE BUTTON' };
    const mocks = new Map([
      ['@/lib/admin/public-copy-preview', { getUatPublicCopyPreview: async requested => { assert.equal(requested, scope); return { copy, site, seo: {} }; } }],
      ['@/lib/content/sanity', { getPrimaryAuthorPreviewProfile: async () => null }],
      ['@/lib/content/public-copy', { getPublicCopy: async requested => { reads.push(requested); return { ...registry.parsePublicCopy(requested, null), 'site.footerDisclaimer': 'PUBLISHED FOOTER' }; } }],
      ['@/features/home/website-43/Website43Home', { __esModule: true, default: () => null }],
      ['@/features/blog/pages/BlogArchivePage', { renderBlogPage: () => null }],
      ['@/features/investment-allocation/page', { renderInvestmentAllocationPage: () => null }],
      ['@/features/legal/pages/PrivacyPage', { renderPrivacyPage: () => null }],
      ['@/features/legal/pages/CookiePolicyPage', { renderCookiePolicyPage: () => null }],
      ['@/features/money-story/page', { renderMoneyStoryPage: () => null }],
      ['@/features/financial-health-check/article-availability', { getFhcPyramidHref: async () => '/blog/' }],
      ['@/lib/content/article-availability', { getFinancialPyramidHref: async () => '/blog/' }],
      ['@/components/layout/website-43/Website43Navbar', { Website43Navbar: () => null }],
      ['@/lib/analytics', { trackEvent: () => assert.fail('SSR must never emit analytics') }],
    ]);
    const page = loadFixtureModule('apps/admin/app/(control-plane)/content/website-preview/page.tsx', { mocks });
    const tree = await page.default({ searchParams: Promise.resolve({ scope }) });
    const html = renderToStaticMarkup(await resolveServer(tree));
    assert.ok(html.includes(`DRAFT ${scope} INPUT`), 'real client wizard receives the authenticated scoped draft');
    assert.ok(html.includes('DRAFT SITE FOOTER'), 'server footer receives explicit site draft');
    assert.ok(html.includes('DRAFT COOKIE BUTTON'), 'real client shared controls inherit the same site draft');
    assert.ok(!html.includes('PUBLISHED FOOTER'));
    assert.ok(!reads.includes('site'), 'draft footer must not independently fetch published site copy');
  });
}

test('draft preview authorization and exact UAT lane fail before any content query', async () => {
  for (const config of [{ denied: true, environment: 'admin-uat', allowed: true }, { environment: 'production-admin', allowed: true }, { environment: 'admin-uat', allowed: false }]) {
    const trace = [];
    const helper = loadFixtureModule('lib/admin/public-copy-preview.ts', { mocks: new Map([
      ['@/lib/admin/require-permission', { requireAdminPermission: async permission => { trace.push(['permission', permission]); if (config.denied) throw new Error('fixture-forbidden'); } }],
      ['@/lib/admin/environment', { getAdminEnvironment: () => config.environment, isAdminReadDataPlaneAllowed: () => config.allowed }],
      ['@/lib/content/sanity-fetch', { sanityFetch: async () => { trace.push('query'); assert.fail('forbidden draft query'); } }],
    ]) });
    await assert.rejects(helper.getUatPublicCopyPreview('ci'), config.denied ? /fixture-forbidden/ : /fixture-not-found/);
    assert.deepEqual(trace, [['permission', 'draft:apply']]);
  }
});

test('authorized scoped UAT draft preview queries only the selected copy, site and matching SEO singletons', async () => {
  const trace = [], key = 'ci.expenses.monthlyIncome.label';
  const copy = { _id: 'publicPageCopy-ci-th', _type: 'publicPageCopy', scope: 'ci', locale: 'th', entries: [{ key, text: 'DRAFT CI LABEL' }] };
  const site = { _id: 'publicPageCopy-site-th', _type: 'publicPageCopy', scope: 'site', locale: 'th', entries: [{ key: 'site.footerDisclaimer', text: 'DRAFT SITE FOOTER' }] };
  const records = { 'publicPageCopy-ci-th': copy, 'publicPageCopy-site-th': site, 'pageSeo-ci-planning': { seoTitle: 'DRAFT CI SEO' } };
  const helper = loadFixtureModule('lib/admin/public-copy-preview.ts', { mocks: new Map([
    ['@/lib/admin/require-permission', { requireAdminPermission: async permission => trace.push(['permission', permission]) }],
    ['@/lib/admin/environment', { getAdminEnvironment: () => 'admin-uat', isAdminReadDataPlaneAllowed: (dataset, environment) => { assert.equal(dataset, 'uat'); assert.equal(environment, 'admin-uat'); return true; } }],
    ['@/lib/content/sanity-fetch', { sanityFetch: async request => {
      assert.equal(request.perspective, 'drafts');
      assert.ok(Object.hasOwn(records, request.params.id), 'only the fixed selected-scope/site/SEO records are queried');
      if (request.params.id === 'pageSeo-ci-planning') assert.deepEqual(request.params, { id: 'pageSeo-ci-planning', pathname: '/ci-planning/' });
      else assert.deepEqual(request.params, { id: request.params.id });
      trace.push(['query', request.params.id]); return { data: records[request.params.id] };
    } }],
  ]) });
  const result = await helper.getUatPublicCopyPreview('ci');
  assert.deepEqual(trace, [['permission', 'draft:apply'], ['query', 'publicPageCopy-ci-th'], ['query', 'publicPageCopy-site-th'], ['query', 'pageSeo-ci-planning']]);
  // Every preview value is the parsed draft plus a zero-width Visual Editing target
  // that opens exactly its own Studio field; the readable text is unchanged.
  const clean = values => Object.fromEntries(Object.entries(values).map(([name, value]) => [name, cleanCopyText(value)]));
  assert.deepEqual(clean(result.copy), registry.parsePublicCopy('ci', copy));
  assert.deepEqual(clean(result.site), registry.parsePublicCopy('site', site));
  assert.equal(cleanCopyText(result.copy[key]), 'DRAFT CI LABEL'); assert.equal(result.seo.seoTitle, 'DRAFT CI SEO');
  for (const [scope, values, name] of [['ci', result.copy, key], ['site', result.site, 'site.footerDisclaimer']]) {
    for (const [entry, value] of Object.entries(values)) assert.ok(editTarget(value), `${entry} carries an edit target`);
    const path = `entries[_key=="${name.replaceAll('.', '-')}"].text`;
    assert.deepEqual(editTarget(values[name]), { origin: 'sanity.io', href: `/studio/intent/edit/id=publicPageCopy-${scope}-th;type=publicPageCopy;path=${encodeURIComponent(path)}` });
  }
});

test('shared education availability keeps Production untouched and UAT missing articles on a working archive', async () => {
  const canonical = '/blog/personal-finance/financial-pyramid/';
  for (const [environment, article, expected] of [
    ['production', null, canonical], ['web-uat', null, '/blog/'],
    ['admin-uat', { status: 'draft', pathname: canonical }, '/blog/'],
    ['web-uat', { status: 'published', pathname: '/wrong/' }, '/blog/'],
    ['web-uat', { status: 'published', pathname: canonical }, canonical],
  ]) {
    let reads = 0;
    const helper = loadFixtureModule('lib/content/article-availability.ts', { mocks: new Map([
      ['@/lib/content/sanity-lane', { resolveContentEnvironment: () => environment }],
      ['@/lib/content/provider', { getContentProvider: () => ({ getArticleBySlug: async (slug, options) => { reads++; assert.equal(slug, 'financial-pyramid'); assert.deepEqual(options, { includeDrafts: false }); return article; } }) }],
      ['@/lib/content/url', { getArticlePath: article => article.pathname }],
    ]) });
    assert.equal(await helper.getFinancialPyramidHref(), expected);
    assert.equal(reads, environment === 'production' ? 0 : 1);
  }
});

test('Money Story result renders a truthful working fallback while keeping the original default destination', () => {
  const entry = 'tests/synthetic-money-preview.tsx';
  const source = `import { PublicCopyProvider } from "@/components/ui/PublicCopyProvider";
import { MoneyStoryResult } from "@/features/money-story/components/MoneyStoryScreens";
export default function Preview(props) { return <PublicCopyProvider values={{"site.extra.blogRecovery":"ดูบทความ"}}><MoneyStoryResult {...props}/></PublicCopyProvider>; }`;
  const fixture = loadFixtureModule(entry, { sources: new Map([[entry, source]]) });
  const engine = loadFixtureModule('features/money-story/engine.ts');
  const game = { ...engine.createGame('preview-link', 'gam'), status: 'win' };
  const props = { game, character: engine.characterFor(game), bars: engine.statusBars(game), rootRef: { current: null }, canUndo: false, undo() {}, replay() {}, share() {}, shareStatus: '', onPyramidClick() {}, onLineClick() {} };
  const fallback = renderToStaticMarkup(React.createElement(fixture.default, { ...props, pyramidHref: '/blog/' }));
  const original = renderToStaticMarkup(React.createElement(fixture.default, props));
  assert.match(fallback, /href="\/blog\/">ดูบทความ<\/a>/);
  assert.match(original, /href="\/blog\/personal-finance\/financial-pyramid\/">พีระมิดทางการเงินคืออะไร\?<\/a>/);
});

test('fixed UAT SEO singleton drafts initialize only their registered read-only pathname', () => {
  const schema = loadFixtureModule('cms/sanity/schema/documents/page-seo.ts', { mocks: new Map([['sanity', { defineType: value => value, defineField: value => value }]]) }).pageSeo;
  const pages = loadFixtureModule('lib/content/page-seo-registry.ts').PAGE_SEO_PAGES;
  assert.equal(pages.length, 8);
  assert.ok(pages.some(page => page.pathname === '/tools/investment-allocation/'));
  for (const page of pages) assert.deepEqual(schema.initialValue({ pathname: page.pathname }), { pathname: page.pathname });
  for (const pathname of [undefined, null, '', '/arbitrary/', 'https://ccpun.com/', 'pageSeo-home']) assert.deepEqual(schema.initialValue({ pathname }), {});
  assert.equal(schema.fields.find(field => field.name === 'pathname').readOnly, true);
  assert.ok(readFileSync(new URL('../cms/sanity/config/structure.ts', import.meta.url), 'utf8').includes('.documentId(page.documentId).initialValueTemplate("pageSeo", { pathname: page.pathname })'));
});

test('actual UAT preview page does not start its author query when scoped authorization fails', async () => {
  let authorReads = 0;
  const mocks = new Map([
    ['@/lib/admin/public-copy-preview', { getUatPublicCopyPreview: async () => { throw new Error('fixture-denied'); } }],
    ['@/lib/content/sanity', { getPrimaryAuthorPreviewProfile: async () => { authorReads++; return null; } }],
    ['@/features/home/website-43/Website43Home', { __esModule: true, default: () => null }],
    ['@/features/ci-planning/page', { renderCiPlanningPage: () => null }],
    ['@/features/financial-health-check/page', { renderFinancialHealthCheckPage: () => null }],
    ['@/features/investment-allocation/page', { renderInvestmentAllocationPage: () => null }],
    ['@/features/blog/pages/BlogArchivePage', { renderBlogPage: () => null }],
    ['@/features/legal/pages/PrivacyPage', { renderPrivacyPage: () => null }],
    ['@/features/legal/pages/CookiePolicyPage', { renderCookiePolicyPage: () => null }],
    ['@/features/money-story/page', { renderMoneyStoryPage: () => null }],
  ]);
  const page = loadFixtureModule('apps/admin/app/(control-plane)/content/website-preview/page.tsx', { mocks });
  await assert.rejects(page.default({ searchParams: Promise.resolve({ scope: 'home' }) }), /fixture-denied/);
  assert.equal(authorReads, 0);
});

test('UAT presentation copy and SEO links require registered pages and matching fixed document IDs', () => {
  const config = loadFixtureModule('cms/sanity/config/presentation.ts', { mocks: new Map([['sanity/presentation', { defineLocations: value => value, presentationTool: value => value }]]) }).createStudioPresentationPlugin();
  const pages = loadFixtureModule('lib/content/page-seo-registry.ts').PAGE_SEO_PAGES;
  assert.equal(Object.keys(registry.PUBLIC_COPY_SCOPES).length, 9);
  assert.equal(pages.length, 8);
  for (const scope of Object.keys(registry.PUBLIC_COPY_SCOPES)) {
    const id = registry.publicCopyDocumentId(scope);
    for (const prefix of ['', 'drafts.']) assert.deepEqual(config.resolve.locations.publicPageCopy.resolve({ id: prefix + id, scope }).locations, [{ title: 'ดูฉบับร่างหน้าเว็บไซต์', href: '/content/website-preview/' + scope + '/' }]);
    for (const invalid of ['wrong', 'drafts.drafts.' + id, 'https://evil.invalid/' + id]) assert.deepEqual(config.resolve.locations.publicPageCopy.resolve({ id: invalid, scope }).locations, []);
  }
  for (const page of pages) {
    const scope = Object.entries(registry.PUBLIC_COPY_SCOPES).find(([scope, config]) => scope !== 'site' && config.pathname === page.pathname)[0];
    for (const prefix of ['', 'drafts.']) assert.deepEqual(config.resolve.locations.pageSeo.resolve({ id: prefix + page.documentId, pathname: page.pathname }).locations, [{ title: 'ดูฉบับร่างหน้าเว็บไซต์และ SEO', href: '/content/website-preview/seo-' + scope + '/' }]);
    for (const id of ['wrong', 'drafts.drafts.' + page.documentId, 'https://evil.invalid/' + page.documentId]) assert.deepEqual(config.resolve.locations.pageSeo.resolve({ id, pathname: page.pathname }).locations, []);
  }
  for (const pathname of ['*', '', '/new-page/', 'https://evil.invalid/', undefined, null]) assert.deepEqual(config.resolve.locations.pageSeo.resolve({ id: 'pageSeo-home', pathname }).locations, []);
  for (const scope of ['unknown', 'https://evil.invalid/', undefined, null]) assert.deepEqual(config.resolve.locations.publicPageCopy.resolve({ id: 'publicPageCopy-home-th', scope }).locations, []);
  assert.deepEqual(config.resolve.locations.pageSeo.resolve(null).locations, []);
  assert.deepEqual(config.resolve.locations.publicPageCopy.resolve(null).locations, []);
});

test('UAT presentation retains the protected preview configuration and existing article locations', () => {
  const config = loadFixtureModule('cms/sanity/config/presentation.ts', { mocks: new Map([['sanity/presentation', { defineLocations: value => value, presentationTool: value => value }]]) }).createStudioPresentationPlugin();
  assert.deepEqual(config.previewUrl, { initial: '/content/website-preview/home/', previewMode: { enable: '/api/preview/enable' } });
  const article = config.resolve.locations.article;
  assert.deepEqual(article.select, { title: 'title', slug: 'slug.current', categorySlug: 'category.slug.current' });
  assert.deepEqual(article.resolve({ title: 'บทความตัวอย่าง', slug: 'sample', categorySlug: 'health-insurance' }).locations, [{ title: 'บทความตัวอย่าง', href: '/blog/health-insurance/sample/' }, { title: 'รวมบทความ', href: '/blog/' }]);
  assert.deepEqual(article.resolve({ slug: 'sample' }).locations, [{ title: 'บทความใหม่', href: '/blog/personal-finance/sample/' }, { title: 'รวมบทความ', href: '/blog/' }]);
  assert.deepEqual(article.resolve(null).locations, [{ title: 'รวมบทความ', href: '/blog/' }]);
});

// Native Presentation changes selected forms with private preview navigation.
test('all existing UAT scopes and SEO forms retain their strict fixed IDs in native Presentation',async()=>{
  const config=loadFixtureModule('cms/sanity/config/presentation.ts',{mocks:new Map([['sanity/presentation',{defineLocations:v=>v,presentationTool:v=>v}]])}).createStudioPresentationPlugin();
  const pages=loadFixtureModule('lib/content/page-seo-registry.ts');const resolve=config.resolve.mainDocuments[0].resolve;
  assert.equal(Object.keys(registry.PUBLIC_COPY_SCOPES).length,9);assert.equal(pages.PAGE_SEO_PAGES.length,8);
  assert.equal(Object.values(registry.PUBLIC_COPY_SCOPES).reduce((n,s)=>n+Object.keys(s.defaults).length,0),1798);
  for(const[scope,entry]of Object.entries(registry.PUBLIC_COPY_SCOPES)){
    assert.deepEqual(resolve({params:{scope}}),{filter:'_id == $id && _type == $type',params:{id:registry.publicCopyDocumentId(scope),type:'publicPageCopy'}});
    const page=pages.getPageSeoPage(entry.pathname);assert.deepEqual(resolve({params:{scope:'seo-'+scope}}),page?{filter:'_id == $id && _type == $type',params:{id:page.documentId,type:'pageSeo'}}:undefined);
    const doc={_id:registry.publicCopyDocumentId(scope),_type:'publicPageCopy',scope,locale:'th',entries:registry.publicCopyInitialEntries(scope)};assert.deepEqual(registry.parsePublicCopy(scope,doc),registry.parsePublicCopy(scope,null));
    assert.throws(()=>registry.parsePublicCopy(scope,{...doc,entries:[...doc.entries,{key:'unowned.anything',text:'wrong'}]}));
  }
  assert.deepEqual(resolve({params:{scope:'author-home'}}),{filter:'_type == "author" && _id in ["ccpun-author-ccpun-profile", "ccpun-prod-mirror-author-ccpun"]'});
  for(const scope of ['unknown','seo-site','home/evil'])assert.equal(resolve({params:{scope}}),undefined);
  const route=loadFixtureModule('apps/admin/app/(control-plane)/content/website-preview/[scope]/page.tsx',{mocks:new Map([['next/navigation',{notFound:()=>{throw Error('fixture404')}}],['../page',{__esModule:true,default:()=>null}]])}).default;
  for(const scope of Object.keys(registry.PUBLIC_COPY_SCOPES)){
    const node=await route({params:Promise.resolve({scope}),searchParams:Promise.resolve({scope:'unknown',q:'คำค้น',page:'2'})});assert.deepEqual(await node.props.searchParams,{scope,q:'คำค้น',page:'2'});
  }
  for(const scope of ['unknown','seo-site','home/evil'])await assert.rejects(route({params:Promise.resolve({scope})}),/fixture404/);
});
test('native Presentation refreshes saved mutations without public SDK imports or iframe reloads',async()=>{
  let refreshes=0;const callbacks=[];const Component=loadFixtureModule('components/preview/LiveVisualEditing.tsx',{mocks:new Map([['next/navigation',{useRouter:()=>({refresh:()=>refreshes++})}],['next-sanity/visual-editing',{VisualEditing:props=>{callbacks.push(props.refresh);return null;}}]])}).default;
  renderToStaticMarkup(React.createElement(Component));for(const source of ['manual','mutation'])await callbacks[0]({source});assert.equal(refreshes,2);
  for(const file of ['lib/content/sanity-fetch.ts','lib/content/public-copy.ts','apps/web/app/layout.tsx'])assert.doesNotMatch(readFileSync(file,'utf8'),/LiveVisualEditing|next-sanity\/visual-editing/);
});
test('native all-page UAT preview uses full viewport only on fixed private paths after server auth',()=>{
  const pages=loadFixtureModule('lib/content/page-seo-registry.ts');const paths=['/content/website-preview','/content/website-preview/author-home',...Object.keys(registry.PUBLIC_COPY_SCOPES).flatMap(scope=>['/content/website-preview/'+scope,...(pages.getPageSeoPage(registry.PUBLIC_COPY_SCOPES[scope].pathname)?['/content/website-preview/seo-'+scope]:[])])];
  for(const path of [...paths,'/dashboard','/content/website-preview/unknown','/content/website-preview/home/evil','/content/website-preview/seo-site']){
    const Component=loadFixtureModule('features/admin/components/AdminProtectedChrome.tsx',{mocks:new Map([['next/navigation',{usePathname:()=>path+'/'}],['./AdminDataRefresh',{__esModule:true,default:()=>null}],['./AdminNavigation',{__esModule:true,default:()=>null}]])}).AdminProtectedChrome;
    const html=renderToStaticMarkup(React.createElement(Component,{title:'ADMIN CHROME',currentEnvironmentLabel:'UAT',identityLabel:'Owner',role:'owner',navItems:[],showInbox:false,showLogout:false,logout:async()=>{},safety:null},React.createElement('section',null,'PUBLIC PREVIEW')));
    if(paths.includes(path))assert.equal(html,'<section>PUBLIC PREVIEW</section>');else assert.ok(html.includes('ADMIN CHROME'));
  }
  const layout=readFileSync('apps/admin/app/(control-plane)/layout.tsx','utf8');assert.ok(layout.indexOf('await auth()')<layout.indexOf('return <AdminProtectedChrome'));assert.ok(layout.includes('if (!role) redirect("/login/")'));
});
test('full UAT defaults add zero browser overrides while one validated edit still reaches its original key',async()=>{
  for(const scope of Object.keys(registry.PUBLIC_COPY_SCOPES))for(const changed of [false,true]){
    const entries=registry.publicCopyInitialEntries(scope).map((e,i)=>changed&&i===0?{...e,text:e.text+' · ตัวอย่าง'}:e);const data={_id:registry.publicCopyDocumentId(scope),_type:'publicPageCopy',scope,locale:'th',entries};
    const reader=loadFixtureModule('lib/content/public-copy.ts',{mocks:new Map([['react',{cache:fn=>fn}],['./sanity-fetch',{sanityFetch:async()=>({data})}]])});assert.deepEqual(await reader.getPublicCopy(scope),changed?{[entries[0].key]:entries[0].text}:{});
  }
});
