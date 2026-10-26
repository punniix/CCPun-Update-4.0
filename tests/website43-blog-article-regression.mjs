import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
require('tsx/cjs');
require.extensions['.css'] = (module) => {
  module.exports = { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
};
const countdownArtworkUrl = '/assets/blog-migration/aia-health-happy-describe/featured-01-AIA-Health-Happy-article.lossless.webp';
require.extensions['.webp'] = (module, filename) => {
  assert.equal(filename, fileURLToPath(new URL('../public' + countdownArtworkUrl, import.meta.url)), 'only the countdown public artwork is a fixture asset');
  module.exports = { __esModule: true, default: { src: countdownArtworkUrl } };
};
const { toWebsite43ArticleItem } = require('../features/blog/website-43/blogData.ts');
const { parseProfessionalQualifications } = require('../lib/content/sanity-schema.ts');
const { buildProfessionalQualificationPersonSchema, personSchema } = require('../lib/seo/structured-data/site-schema.ts');
const { buildArticleSchemaGraph } = require('../lib/content/structured-data/article-schema.ts');
const copyRegistry=loadFixtureModule('lib/content/public-copy-registry.ts');
const styles={__esModule:true,default:new Proxy({}, {get:(_,key)=>key})};
const Article=loadFixtureModule('features/blog/website-43/Website43Article.tsx',{mocks:new Map([
  ['next/navigation',{usePathname:()=>null}],
  ['@/lib/content/public-copy',{getPublicCopy:async scope=>copyRegistry.parsePublicCopy(scope,null)}],
  ...['@/components/layout/website-43/Website43.module.css','./Website43.module.css','./Website43Navbar.module.css','./ArticleEngagement.module.css','./ArticleShareActions.module.css','./Website43ArticleOverview.module.css','./ArticleCardEngagement.module.css'].map(id=>[id,styles]),
])}).default;
// Exercise the real pure converter without loading Sanity clients or credentials.
const ts = require('typescript');
const sanitySource = readFileSync(new URL('../lib/content/sanity.ts', import.meta.url), 'utf8');
const sanityAst = ts.createSourceFile('sanity.ts', sanitySource, ts.ScriptTarget.Latest, true);
const converter = sanityAst.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'portableTextToArticleBlocks');
assert.ok(converter, 'Portable Text converter remains available');
const converterExports = {};
const { articleFontSizeFromMarks, articleFontSizeStyle } = loadFixtureModule('lib/content/article-font-size.ts');
new Function('exports', 'articleFontSizeFromMarks', ts.transpileModule(converter.getText(sanityAst), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(converterExports, articleFontSizeFromMarks);
const h4Body = converterExports.portableTextToArticleBlocks([{
  _type: 'block', style: 'h4',
  children: [{ _type: 'span', text: 'หัวข้อย่อยระดับสี่', marks: ['strong', 'em', 'reference'] }],
  markDefs: [{ _key: 'reference', _type: 'link', href: 'https://example.com/h4', openInNewTab: true, nofollow: true, sponsored: true }],
}]);
assert.equal(h4Body[0].type, 'heading', 'Sanity H4 must not normalize to a paragraph');
assert.equal(h4Body[0].level, 4);
assert.deepEqual(h4Body[0].segments, [{ text: 'หัวข้อย่อยระดับสี่', href: 'https://example.com/h4', openInNewTab: true, nofollow: true, sponsored: true, strong: true, emphasis: true }]);
// Article-body font-size marks (Sanity decorators) carry through as a size per segment; the largest wins.
const sizedBody = converterExports.portableTextToArticleBlocks([
  { _type: 'block', style: 'normal', children: [
    { _type: 'span', text: 'ปกติ ', marks: [] },
    { _type: 'span', text: 'เล็ก', marks: ['fontSmall'] },
    { _type: 'span', text: 'ใหญ่', marks: ['strong', 'fontLarge', 'fontXLarge'] },
  ], markDefs: [] },
  { _type: 'block', style: 'normal', children: [{ _type: 'span', text: 'ไม่มีขนาด', marks: ['unknownMark'] }], markDefs: [] },
]);
assert.deepEqual(sizedBody[0].segments, [{ text: 'ปกติ ' }, { text: 'เล็ก', size: 'small' }, { text: 'ใหญ่', strong: true, size: 'xlarge' }]);
assert.equal(sizedBody[1].segments, undefined, 'unknown marks never create sized segments');
assert.deepEqual(articleFontSizeStyle('small'), { fontSize: '0.875em' });
assert.deepEqual(articleFontSizeStyle('large'), { fontSize: '1.2em', lineHeight: 1.5 });
assert.equal(articleFontSizeStyle(undefined), undefined);
const article = {
  id: 'published-fixture', slug: 'fixture-article', category: 'ประกันชีวิต', categorySlug: 'life-insurance',
  title: 'บทความทดสอบ', excerpt: 'ข้อมูลทดสอบ', authorName: 'ผู้เขียนจากเนื้อหา', status: 'published',
  publishedAt: '2026-06-01T17:43:56Z', updatedAt: '2026-06-02T00:00:00Z',
  seoTitle: 'หัวข้อ SEO', seoDescription: 'คำอธิบาย SEO', tags: [],
  featuredImage: { src: '/assets/pun.jpg', alt: 'ภาพเปิด', width: 400, height: 400, caption: 'คำบรรยายภาพเปิด' },
  body: [
    { type: 'paragraph', text: 'บทนำ', segments: [{ text: 'ลิงก์อ้างอิง', href: 'https://example.com/reference', strong: true, emphasis: true, nofollow: true, sponsored: true }] },
    { type: 'heading', level: 2, text: 'หัวข้อหลัก' },
    { type: 'heading', level: 3, text: 'หัวข้อย่อย' },
    ...h4Body,
    { type: 'heading', level: 3, text: 'หัวข้อย่อยถัดไป' },
    { type: 'image', src: '/assets/pun.jpg', alt: 'ภาพเนื้อหา', width: 400, height: 400, credit: 'เจ้าของภาพเดี่ยว' },
    { type: 'gallery', images: [{ src: '/assets/pun.jpg', alt: 'ภาพแกลเลอรี', width: 400, height: 400, caption: 'คำบรรยายแกลเลอรี', credit: 'เจ้าของแกลเลอรี' }] },
    { type: 'bulletList', items: ['รายการหนึ่ง', { text: 'รายการสอง', segments: [{ text: 'ตัวหนา', strong: true }] }] },
    { type: 'numberList', items: ['ขั้นตอนหนึ่ง'] },
    { type: 'quote', text: 'ข้อความอ้าง' },
    { type: 'callout', title: 'ข้อควรรู้', text: 'ข้อความเพิ่มเติม' },
    { type: 'cta', url: 'https://example.com/action', label: 'อ่านเพิ่มเติม', style: 'primary' },
    { type: 'pdf', title: 'เอกสารทดสอบ', description: 'คำอธิบายเอกสาร', url: 'https://example.com/file.pdf', size: 2097152 },
    { type: 'details', summary: 'รายละเอียดเพิ่มเติม', text: 'เนื้อหาซ่อน' },
    { type: 'table', headers: ['หัวตาราง'], rows: [['ข้อมูลตาราง']] },
    { type: 'divider' },
  ],
  sources: [{ label: 'แหล่งต้นทาง', url: 'https://example.com/source' }],
  faq: [{ question: 'คำถามทดสอบ', answer: 'คำตอบทดสอบ' }],
};
async function serverTree(node) {
  if(Array.isArray(node))return Promise.all(node.map(serverTree));
  if(!React.isValidElement(node))return node;
  if(typeof node.type==='function'&&(node.type.constructor.name==='AsyncFunction'||['Website43Article','Website43ArticleToc','Website43Footer','Website43Blog','renderWebsite43Blog','V5Page','V5BlogIndex'].includes(node.type.name)))return serverTree(await node.type(node.props));
  const children=await serverTree(node.props.children);
  return React.cloneElement(node,{},...(Array.isArray(children)?children:[children]));
}
const doc = async(element) => new JSDOM(renderToStaticMarkup(await serverTree(element))).window.document;
const rendered = await doc(React.createElement(Article, { article }));
assert.equal(rendered.querySelectorAll('h1').length, 1);
assert.ok(rendered.querySelector('h2#section-2'), 'preserve legacy block-index + 1 heading IDs');
assert.ok(rendered.querySelector('a[href="#section-2"]'));
assert.ok(rendered.querySelector('h3#section-3'), 'existing H3 keeps its block-index anchor');
assert.ok(rendered.querySelector('h4#section-4 a em strong'), 'H4 preserves inline links and emphasis');
assert.ok(rendered.querySelector('h3#section-5'), 'headings after H4 retain their body index');
const tocLinks = [...rendered.querySelectorAll('.toc a, .tocMobile a')].map((link) => link.getAttribute('href'));
assert.deepEqual(tocLinks, ['#section-2', '#section-3', '#section-4', '#section-5', '#section-2', '#section-3', '#section-4', '#section-5'], 'approved desktop and mobile TOC include H2/H3/H4 without changing body-index anchors');
const h4Link = rendered.querySelector('h4#section-4 a');
assert.equal(h4Link.target, '_blank');
for (const rel of ['noopener', 'noreferrer', 'nofollow', 'sponsored']) assert.ok(h4Link.rel.split(' ').includes(rel));
const h4Only = await doc(React.createElement(Article, { article: { ...article, body: h4Body } }));
assert.ok(h4Only.querySelector('h4#section-1'));
assert.equal(h4Only.querySelectorAll('a[href="#section-1"]').length, 2, 'both TOC variants preserve the H4-only anchor');
for (const text of ['คำบรรยายภาพเปิด', 'เครดิต: เจ้าของภาพเดี่ยว', 'คำบรรยายแกลเลอรี · เครดิต: เจ้าของแกลเลอรี', 'ผู้เขียนจากเนื้อหา', '(2.0 MB)', 'ผลิตภัณฑ์ประกันไม่ใช่เงินฝาก', 'คำถามทดสอบ']) assert.ok(rendered.body.textContent.includes(text), text);
for (const selector of ['ul li', 'ol li', 'blockquote', 'aside', 'details', 'table th', 'table td', 'hr', 'em strong']) assert.ok(rendered.querySelector(selector), selector);
assert.equal(rendered.querySelector('[data-uat-section="article-sources"]'), null, 'approved inline evidence replaces the visible end reference list');
assert.equal(rendered.querySelector('a[href="https://example.com/source"]'), null, 'source metadata is not rendered as an extra end link');
const external = rendered.querySelector('a[href="https://example.com/reference"]');
assert.ok(external, 'the original inline reference remains in the rendered article');
assert.equal(external.target, '_blank');
for (const rel of ['noopener', 'noreferrer', 'nofollow', 'sponsored']) assert.ok(external.rel.split(' ').includes(rel));
assert.equal(rendered.querySelector('a[href="https://example.com/action"]').target, '_blank');
assert.ok(rendered.querySelector('a[href="/#about-ccpun"]'));
assert.ok([...rendered.querySelectorAll('button')].some((button) => button.textContent.includes('ตั้งค่าคุกกี้')));
assert.equal([...rendered.querySelectorAll('a')].filter((a) => !a.getAttribute('href') || a.getAttribute('href').startsWith('/preview/')).length, 0);
const profile = await doc(React.createElement(Article, { article: { ...article, author: { name: 'ชื่อ CMS', profileName: 'ชื่อโปรไฟล์', profileCtaUrl: '#about-ccpun' } } }));
assert.ok(profile.body.textContent.includes('ชื่อโปรไฟล์'));
assert.ok(profile.body.textContent.includes('ที่ปรึกษาทางการเงินและผู้วางแผนการลงทุน'), 'legacy Author data keeps the current visible role before managed qualifications are populated');
assert.ok(profile.querySelector('a[href="/#about-ccpun"]'));

const managedProfile = await doc(React.createElement(Article, { article: { ...article, author: {
  name: 'CCPun',
  profileName: 'ชนาธิป ชิตประเสริฐ',
  profileRole: 'บทบาทจาก Sanity',
  profileBio: 'คำอธิบายจาก Sanity',
  profileCtaUrl: '#about-ccpun',
  professionalQualifications: [{
    _key: 'afpt',
    shortName: 'AFPT™',
    name: 'คุณวุฒิวิชาชีพที่ปรึกษาการเงิน AFPT™',
    identifier: 'AFPT260195',
    issuer: 'สมาคมนักวางแผนการเงินไทย',
    issuerUrl: 'https://www.tfpa.or.th/',
  }],
} } }));
assert.ok(managedProfile.body.textContent.includes('ชนาธิป ชิตประเสริฐ, AFPT™'));
assert.ok(managedProfile.body.textContent.includes('บทบาทจาก Sanity'));
assert.ok(managedProfile.body.textContent.includes('คำอธิบายจาก Sanity'));
assert.ok(!managedProfile.body.textContent.includes('AFPT260195'), 'Article author card must not repeat the credential identifier');


const byline = managedProfile.querySelector('header h1').previousElementSibling;
assert.equal(byline.tagName,'P');
assert.equal(byline.textContent,'โดย ชนาธิป ชิตประเสริฐ, AFPT');
assert.equal(byline.querySelector('a,button'),null,'compact byline stays plain and noninteractive');
assert.equal(managedProfile.querySelectorAll('.authorCard').length,1,'one full profile retained at article end');
assert.equal(managedProfile.querySelector('.authorName').textContent,'ชนาธิป ชิตประเสริฐ, AFPT™','full profile retains real qualification label');
assert.equal(rendered.querySelector('header h1').previousElementSibling.textContent,'โดย ผู้เขียนจากเนื้อหา');
assert.ok(!rendered.querySelector('header h1').previousElementSibling.textContent.includes('AFPT'),'no invented qualification for an author without credentials');
const {renderWebsite43ArticleBody}=require('../features/blog/website-43/Website43ArticleBody.tsx');
const introItems=[{type:'paragraph',text:'บทนำแรก',segments:[{text:'อ้างอิงเดิม',href:'https://example.com/inline'}]},{type:'paragraph',text:'บทนำที่สอง'},{type:'heading',level:2,text:'หัวข้อหลัก'},{type:'paragraph',text:'เนื้อหาปกติ'}];
const introDoc= await doc(React.createElement('article',{className:'prose'},renderWebsite43ArticleBody(introItems,new Map([[2,'section-3']]))));
const paragraphs=[...introDoc.querySelectorAll('p')];
for(const p of paragraphs.slice(0,2)){assert.equal(p.style.fontSize,'19px');assert.equal(p.style.lineHeight,'1.75');assert.equal(p.style.color,'rgba(250, 249, 249, 0.9)');assert.equal(p.style.margin,'','existing paragraph gap remains stylesheet-owned');}
assert.equal(paragraphs[2].getAttribute('style'),null,'body after first nonparagraph keeps existing responsive16/17 typography');
assert.ok(paragraphs[0].querySelector('a[href="https://example.com/inline"]'),'intro adjustment preserves inline citations');
const sizedDoc=await doc(React.createElement('article',{className:'prose'},renderWebsite43ArticleBody([{type:'heading',level:2,text:'หัว'},...sizedBody],new Map([[0,'section-1']]))));
const sizedSpans=[...sizedDoc.querySelectorAll('p')[0].children];
assert.equal(sizedSpans[0].getAttribute('style'),null,'unsized text keeps stylesheet typography');
assert.equal(sizedSpans[1].style.fontSize,'0.875em');
assert.equal(sizedSpans[2].style.fontSize,'1.45em');
assert.equal(sizedSpans[2].style.lineHeight,'1.4');
assert.ok(sizedSpans[2].querySelector('strong'),'size combines with bold');

const parsedQualifications = parseProfessionalQualifications([
  { _key: 'valid', shortName: 'AFPT™', name: 'ที่ปรึกษาการเงิน AFPT™', identifier: 'AFPT260195', issuer: 'สมาคมนักวางแผนการเงินไทย' },
  { _key: 'invalid', shortName: 'BROKEN' },
]);
assert.equal(parsedQualifications.length, 1, 'malformed qualification items are isolated instead of dropping the whole Article');
assert.equal(parsedQualifications[0].identifier, 'AFPT260195');
assert.deepEqual(parseProfessionalQualifications({ not: 'an-array' }), []);

assert.equal(personSchema.name, 'ชนาธิป ชิตประเสริฐ');
assert.deepEqual(personSchema.alternateName, ['ปั้น', 'CCPun']);
const qualificationPersonSchema = buildProfessionalQualificationPersonSchema(parsedQualifications);
assert.equal(qualificationPersonSchema['@id'], 'https://ccpun.com/#person');
assert.equal(qualificationPersonSchema.hasCredential[0].identifier, 'AFPT260195');
assert.equal(qualificationPersonSchema.hasCredential[0].alternateName, 'AFPT™');
assert.equal(qualificationPersonSchema.hasCredential[0].recognizedBy.name, 'สมาคมนักวางแผนการเงินไทย');

const articleSchemaGraph = buildArticleSchemaGraph(article);
const articlePosting = articleSchemaGraph['@graph'].find((node) => node['@type'] === 'BlogPosting');
assert.deepEqual(articlePosting.author, { '@id': 'https://ccpun.com/#person' });
assert.equal('name' in articlePosting.author, false, 'Article JSON-LD must not create a conflicting author name');

const item = toWebsite43ArticleItem(article);
assert.equal(item.id, article.id, 'card engagement uses actual published document ID rather than slug');
assert.match(item.meta, /2 มิ\.ย\. 2569/, 'Bangkok midnight date stays identical in SSR and hydration');
assert.equal(item.href, '/blog/life-insurance/fixture-article/');
assert.doesNotThrow(() => toWebsite43ArticleItem({ ...article, publishedAt: 'invalid' }));

// Exercise real route compositions with a provider that deliberately includes a Draft.
const health = { ...article, id: 'health', slug: 'aia-health-happy-describe', category: 'ประกันสุขภาพ', categorySlug: 'health-insurance', title: 'บทความสุขภาพ', body: [] };
const draft = { ...article, id: 'draft', slug: 'draft-only', title: 'DRAFT MUST NOT LEAK', status: 'draft' };
const calls = [];
const mock = (path, exports) => { require.cache[require.resolve(path)] = { exports }; };
const nextNavigation = require('next/navigation');
const { buildCategoryRegistry } = require('../lib/content/category-registry.ts');
const categoryRegistryFixture = buildCategoryRegistry([
  { _id: 'personal', title: 'การเงินส่วนบุคคล', slug: 'personal-finance', status: 'active' },
  { _id: 'life', title: 'ประกันชีวิต', slug: 'life-insurance', status: 'active' },
  { _id: 'health', title: 'ประกันสุขภาพ', slug: 'health-insurance', status: 'active' },
  { _id: 'investment', title: 'การลงทุน', slug: 'investment', status: 'active' },
  { _id: 'motor', title: 'ประกันรถยนต์', slug: 'motor-insurance', status: 'active' },
]);
mock('../lib/content/public-copy.ts',{getPublicCopy:async scope=>copyRegistry.parsePublicCopy(scope,null)});
mock('../lib/content/category-registry-sanity.ts', { listCategoryRegistry: async () => categoryRegistryFixture });
mock('../lib/content/blog-featured-sanity.ts', { listBlogFeaturedArticleIds: async () => [] });
// v5 /blog/ shows the primary author chip; the server-only Sanity reader is mocked like the other providers.
mock('../lib/content/sanity.ts', { getPrimaryAuthorProfile: async () => null });
mock('../lib/content/provider.ts', { getContentProvider: () => ({
  listArticles: async (options) => { calls.push(options); return [article, health, draft]; },
  getArticleBySlug: async (slug, options) => { calls.push(options); return [article, health, draft].find((entry) => entry.slug === slug) ?? null; },
}) });
mock('next/headers', { draftMode: async () => ({ isEnabled: true }) });
mock('next/navigation', { ...nextNavigation, useRouter: () => ({ replace: () => {} }) });
mock('../lib/deployment-environment.ts', { IS_DRAFT_PREVIEW_ALLOWED: false });
// 2026-10-25: the v5 shell reads the LINE chat config and the Investment flag through server-only
// modules; they are mocked like the other providers (chat defaults, Investment off as in Production).
mock('../lib/content/line-chat-config.ts', { getLineChatConfig: async () => ({ config: { enabled: true, topics: [], placements: [], campaigns: [] }, source: 'default', invalid: false }) });
mock('../lib/runtime/investment-availability.ts', { INVESTMENT_ALLOCATION_ENABLED: false, isInvestmentAllocationEnabled: () => false });
const overview = require('../features/blog/pages/BlogArchivePage.tsx').default;
const category = require('../features/blog/pages/BlogCategoryPage.tsx');
const articleRoute = require('../features/blog/pages/ArticlePage.tsx');
for (const [slug, label, expected] of [['health-insurance', 'ประกันสุขภาพ', 'บทความสุขภาพ'], ['investment', 'การลงทุน', null]]) {
  const markup = await doc(await category.default({ params: Promise.resolve({ category: slug }) }));
  // Website v5 Phase A: the hub renders V5Category; the current hub chip is server-rendered
  // only for categories that own articles (plan T11 hides the empty investment hub).
  const currentChip = markup.querySelector('nav a[aria-current="page"]');
  if (expected) assert.equal(currentChip?.textContent.trim(), label);
  else assert.ok(!markup.querySelector('a[href="/blog/investment/"][aria-current="page"]'));
  assert.equal(markup.querySelectorAll('h1').length, 1);
  assert.equal(markup.querySelector('h1').textContent, label);
  if (expected) assert.ok(markup.body.textContent.includes(expected));
  assert.ok(!markup.body.textContent.includes('DRAFT MUST NOT LEAK'));
  assert.ok(!markup.querySelector('a[href="/blog/life-insurance/fixture-article/"]'), 'category list stays filtered');
  const metadata = await category.generateMetadata({ params: Promise.resolve({ category: slug }) });
  assert.equal(metadata.alternates.canonical, `https://ccpun.com/blog/${slug}/`);
  if (slug === 'investment') assert.equal(metadata.robots.index, false);
}
const archive = await doc(await overview({ searchParams: Promise.resolve({ q: 'ข้อมูล' }) }));
assert.equal(archive.querySelector('input[type="search"]').getAttribute('value'), 'ข้อมูล');
assert.ok(!archive.body.textContent.includes('DRAFT MUST NOT LEAK'));
assert.equal(archive.querySelectorAll('nav[aria-label="หัวข้อบทความหลัก"]').length, 0);
assert.ok(!archive.body.textContent.includes('เลือกหัวข้อที่ต้องการอ่าน'));
await assert.rejects(articleRoute.default({ params: Promise.resolve({ category: 'life-insurance', slug: 'draft-only' }) }), /NEXT_HTTP_ERROR_FALLBACK;404/);
await assert.rejects(articleRoute.default({ params: Promise.resolve({ category: 'life-insurance', slug: health.slug }) }), /NEXT_REDIRECT/);
const draftMetadata = await articleRoute.generateMetadata({ params: Promise.resolve({ category: 'life-insurance', slug: 'draft-only' }) });
assert.equal(draftMetadata.robots.index, false);
assert.equal(draftMetadata.title, 'ไม่พบหน้า | CCPun');
assert.equal(draftMetadata.alternates.canonical, null);
assert.equal((await category.generateMetadata({ params: Promise.resolve({ category: 'missing-category' }) })).alternates.canonical, null);
await articleRoute.generateMetadata({ params: Promise.resolve({ category: 'life-insurance', slug: article.slug }) });
assert.ok(calls.length > 0 && calls.every((call) => call.includeDrafts === false), 'stale draft cookie cannot cross public Production read gate');
const shared = readFileSync(new URL('../components/layout/website-43/Website43Shared.tsx', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
const articleStyles = readFileSync(new URL('../components/layout/website-43/Website43.module.css', import.meta.url), 'utf8');
assert.ok(!shared.includes('Website43ResponsiveStyles'), 'static responsive CSS must not hydrate with the shared navbar');
assert.ok(layout.includes('<Website43ResponsiveStyles />'), 'canonical responsive CSS must remain server-rendered in the public shell');
assert.ok(!layout.includes('Website43TransitionStyles') && !layout.includes('Website43FinalPolishStyles'), 'retired responsive patch owners must stay out of the public shell');
assert.match(articleStyles, /\.prose ol\s*\{[^}]*list-style-type:\s*decimal;/s, 'ordered article lists must restore decimal markers after Tailwind Preflight');
assert.match(articleStyles, /\.prose ul\s*\{[^}]*list-style-type:\s*disc;/s, 'unordered article lists must restore bullet markers after Tailwind Preflight');
assert.match(articleStyles, /\.prose :is\(p, li, h2, h3, h4, blockquote\) a\s*\{[^}]*text-decoration:\s*underline;/s, 'inline references keep an accessible underline');

// Render only the dedicated Blog interaction island as a cached route remount after popstate already fired.
const browserDom = new JSDOM('<div id="app"></div>', { url: 'https://ccpun.com/blog/?q=สุขภาพ' });
const cardReads = [];
const savedGlobals = new Map(['fetch', 'window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame', 'IS_REACT_ACT_ENVIRONMENT'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
Object.defineProperties(globalThis, {
  fetch: { value: async (url, init={}) => { cardReads.push({url, body:init.body}); return Response.json({available:false,views:null,shares:null,hearts:null,liked:false}); }, configurable:true },
  window: { value: browserDom.window, configurable: true },
  document: { value: browserDom.window.document, configurable: true },
  requestAnimationFrame: { value: () => 0, configurable: true },
  cancelAnimationFrame: { value: () => {}, configurable: true },
  IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true },
});
mock('next/link', { __esModule: true, default: ({ children, href, ...props }) => React.createElement('a', { ...props, href }, children) });
mock('next/image', { __esModule: true, default: ({ src, alt }) => React.createElement('img', { src, alt }) });
mock('next/navigation', { ...nextNavigation, useRouter: () => ({
  replace: (href) => browserDom.window.history.replaceState(browserDom.window.history.state, '', href),
}) });
delete require.cache[require.resolve('../features/blog/website-43/Website43BlogInteractive.tsx')];
const BlogClient = require('../features/blog/website-43/Website43BlogInteractive.tsx').default;
const { createRoot } = require('react-dom/client');
const root = createRoot(browserDom.window.document.getElementById('app'));
const classNames = new Proxy({}, { get: (_, key) => String(key) });
const categories = [{ slug: null, title: 'ทุกหมวดหมู่' }];
await React.act(async () => root.render(React.createElement(BlogClient, {
  articles: [toWebsite43ArticleItem(article), toWebsite43ArticleItem(health)],
  initialQuery: '',
  classNames,
  categories,
})));
const six=Array.from({length:8},(_,index)=>({...item,id:`id-${index}`,slug:`slug-${index}`,href:`/blog/life-insurance/slug-${index}/`}));
const sixDoc= await doc(React.createElement(BlogClient,{articles:six,featuredArticles:six,classNames,categories}));
assert.equal(sixDoc.querySelectorAll('.articleGrid > article').length,6);
assert.equal(sixDoc.querySelector('.articleGrid .articleExcerpt').style.textWrap,'balance','only the card excerpt uses the native balance mode verified at nine widths');
assert.equal(sixDoc.querySelector('.articleGrid .articleTitle').style.textWrap,'pretty','card title retains its existing approved wrapping');
assert.equal(sixDoc.querySelectorAll('.articleGrid button[aria-pressed]').length,6,'heart mounts only six visible page cards');
assert.equal(sixDoc.querySelectorAll('.featuredRail button[aria-pressed]').length,0,'three repeated carousel sets have no engagement providers/actions');
assert.equal(sixDoc.querySelectorAll('.articleGrid a button').length,0);
assert.ok([...sixDoc.querySelectorAll('.articleGrid button[aria-pressed]')].every(button=>button.getAttribute('aria-label')==='ถูกใจบทความ: '+item.title),'each card button names the actual article');

const input = browserDom.window.document.querySelector('input[type="search"]');
assert.equal(input.value, 'สุขภาพ', 'cached stale initial props must read the restored browser URL on mount');
assert.equal(browserDom.window.document.querySelectorAll('.articleGrid > article').length, 1);
await React.act(async () => {
  browserDom.window.history.replaceState(null, '', '/blog/');
  browserDom.window.dispatchEvent(new browserDom.window.PopStateEvent('popstate'));
});
assert.equal(input.value, '');
assert.equal(browserDom.window.document.querySelectorAll('.articleGrid > article').length, 2);

const inputValueSetter = Object.getOwnPropertyDescriptor(browserDom.window.HTMLInputElement.prototype, 'value').set;
await React.act(async () => {
  inputValueSetter.call(input, 'abc123');
  input.dispatchEvent(new browserDom.window.Event('input', { bubbles: true }));
});
assert.equal(input.value, 'abc123');
assert.equal(new URL(browserDom.window.location.href).searchParams.get('q'), 'abc123', 'live search must persist q through App Router replace');
assert.equal(browserDom.window.document.querySelectorAll('.articleGrid > article').length, 0);
await React.act(async () => {
  inputValueSetter.call(input, '');
  input.dispatchEvent(new browserDom.window.Event('input', { bubbles: true }));
});
assert.equal(new URL(browserDom.window.location.href).searchParams.has('q'), false, 'clearing live search must remove q from the URL');
assert.equal(browserDom.window.document.querySelectorAll('.articleGrid > article').length, 2);

assert.ok(cardReads.every(request => !request.body), 'listing mounts only read metrics, never record Article views');
assert.equal(browserDom.window.document.querySelectorAll('.articleGrid a button').length,0, 'heart controls are not nested in content navigation');
await React.act(async () => root.unmount());
for (const [key, descriptor] of savedGlobals) {
  if (descriptor) Object.defineProperty(globalThis, key, descriptor);
  else delete globalThis[key];
}
browserDom.window.close();
console.log('PASS: actual Article block/credit/anchor/profile renderer, Bangkok date, public route/filter/metadata/redirect, stale Draft cookie and cached browser query restoration');
const { execFileSync } = await import('node:child_process');
execFileSync(process.execPath, ['--test', fileURLToPath(new URL('./health-happy-blog-preload.test.mjs', import.meta.url))], { stdio: 'inherit' });
