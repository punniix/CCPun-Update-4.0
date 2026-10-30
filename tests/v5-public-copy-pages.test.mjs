import { visualLocationPins, visualLocationsPredecessor } from "../qa/v5-owner-review-source-successor.mjs";
import { visualSourcePins, ownerReviewVisualSourcePredecessor } from "../qa/v5-owner-review-source-successor.mjs";
import { editorSourcePins, ownerReviewEditorSourcePredecessor } from "../qa/v5-owner-review-source-successor.mjs";
import { ownerReviewStaticCredentialsPredecessor, staticCredentialSourcePins } from "../qa/v5-owner-review-source-successor.mjs";
import { ownerReviewAboutWordsPredecessor, ownerReviewLocationsPredecessor } from "../qa/v5-owner-review-source-successor.mjs";
import { ownerReviewHtmlPredecessor } from '../qa/v5-owner-review-source-successor.mjs';
import { aboutToolsLayoutPins, aboutToolsLayoutPredecessor } from '../qa/v5-owner-review-source-successor.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync as actualReadFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
test('canonical About native branch preserves legacy markup and all prior CMS values', async () => {
  const { execFileSync } = require('node:child_process');
  const { JSDOM } = require('jsdom');
  const base = 'fb5eee8655d141587c5df46476e2dd38a3bd1be6';
  const oldSource = file => execFileSync('git', ['show', base + ':' + file], { encoding: 'utf8' });
  const oldDefaults = actualLoadFixtureModule('lib/content/about-copy-defaults.ts', { sources: new Map([['lib/content/about-copy-defaults.ts', oldSource('lib/content/about-copy-defaults.ts')]]) }).ABOUT_COPY_DEFAULTS;
  const current = actualLoadFixtureModule('lib/content/public-copy-registry.ts');
  const values = current.PUBLIC_COPY_SCOPES.about.defaults;
  assert.equal(Object.keys(oldDefaults).length, 63);
  assert.equal(Object.keys(values).length, 64);
  for (const [key, value] of Object.entries(oldDefaults)) assert.equal(values[key], value, key);
  assert.equal(values['about.faq.heading'], 'ก่อนเริ่มวางแผนกับ CCPun');
  const oldEntries = current.publicCopyInitialEntries('about').filter(entry => entry.key !== 'about.faq.heading');
  const edited = oldEntries.map(entry => entry.key === 'about.storyV2.c1.p1' ? { ...entry, _key: 'persisted-owner-key', text: entry.text + ' · UAT' } : entry);
  const parsed = current.parsePublicCopy('about', { _id: current.publicCopyDocumentId('about'), _type: 'publicPageCopy', scope: 'about', locale: 'th', entries: edited });
  assert.equal(parsed['about.storyV2.c1.p1'], oldDefaults['about.storyV2.c1.p1'] + ' · UAT');
  assert.equal(parsed['about.faq.heading'], values['about.faq.heading']);
  const actualOptions = review => ({ ...fixtureOptions({ review }), sources: new Map() });
  const currentPage = actualLoadFixtureModule('features/about/page.tsx', actualOptions(true));
  const html = renderToStaticMarkup(await currentPage.default());
  const document = new JSDOM(html).window.document;
  assert.equal(document.querySelector('h1').textContent, current.HOME_COPY_DEFAULTS['home.h2']);
  assert.ok(document.querySelector('.nativeHeroGrid').firstElementChild.classList.contains('nativePortraitFrame'));
  assert.equal(document.querySelectorAll('[data-owner-story-v2] h2').length, 4);
  assert.equal(document.querySelectorAll('.nativeSteps > li').length, 4);
  assert.equal(document.querySelectorAll('.nativePartnerTiles > li').length, 6);
  assert.equal(document.querySelectorAll('.nativePartnerTiles strong').length, 0);
  assert.equal(document.querySelectorAll('.nativePartnerTiles .accessibleOnly').length, 6);
  assert.equal(document.querySelectorAll('.nativeQuotes blockquote').length, 2);
  const faq = [...document.querySelectorAll('.nativeFaq details')];
  assert.equal(faq.length, 2);
  assert.equal(faq[0].open, true);
  assert.equal(faq[1].open, false);
  for (const [key, value] of Object.entries(oldDefaults).filter(([key]) => /^about\.storyV2\.c\d\.p\d+$/.test(key))) assert.ok(document.querySelector('[data-owner-story-v2]').textContent.includes(value), key);
  assert.equal(document.querySelectorAll('[data-uat-placeholder]').length, 0);
  const legacyOptions = actualOptions(false);
  const legacyHtml = renderToStaticMarkup(await actualLoadFixtureModule('features/about/page.tsx', legacyOptions).default());
  const priorOptions = { ...legacyOptions, sources: new Map(['features/about/page.tsx', 'features/about/OwnerStoryV2.tsx'].map(file => [file, oldSource(file)])) };
  const priorHtml = renderToStaticMarkup(await actualLoadFixtureModule('features/about/page.tsx', priorOptions).default());
  assert.equal(legacyHtml, priorHtml, 'Legacy Production DOM and metadata remain exact');
});
import { loadFixtureModule as actualLoadFixtureModule } from '../qa/phase1-fixture-loader.mjs';
const require = createRequire(path.resolve('package.json'));
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const digest = text => createHash('sha256').update(text).digest('hex');

// Frozen 29-Oct UAT Story V2 successor. Reverse exactly four reviewed code
// regions before the old native layout/CMS proof; mutants are not normalized.
const ownerV2SourcePatches = [
  [
    "import OwnerStoryV2 from \"./OwnerStoryV2\";\n",
    ""
  ],
  [
    "              {IS_REVIEW_ENVIRONMENT ? <p className={styles.ownerHeroIntro}>{text.node(\"about.storyV2.heroIntro\")}</p> : null}\n              {!IS_REVIEW_ENVIRONMENT ? <V5CredentialCards className={styles.credentials} qualification={qualification} licenceCards={licenceCards} /> : null}\n",
    "              <OwnerCopySlot slot=\"about-hero-sentence\" note=\"ประโยคแนะนำตัวของปั้นหนึ่งประโยค (รอข้อความจากเจ้าของ)\" />\n              <V5CredentialCards className={styles.credentials} qualification={qualification} licenceCards={licenceCards} />\n"
  ],
  [
    "      {IS_REVIEW_ENVIRONMENT ? (\n        <section className={shell.section} aria-label=\"ประวัติและแนวทางการวางแผนการเงิน\">\n          <div className={shell.inner}>\n            <OwnerStoryV2 text={text} qualification={qualification} licenceCards={licenceCards} />\n",
    "      <section className={shell.section} aria-labelledby=\"about-story\">\n        <div className={`${shell.inner} ${styles.split}`}>\n          <h2 id=\"about-story\" className={shell.h2}>{home.node(\"home.h2\")}</h2>\n          <div className={styles.story}>\n            <OwnerCopySlot slot=\"about-start-years\" note=\"ปีที่เริ่มงานการเงินและการลงทุน และปีที่เริ่มเป็นที่ปรึกษา (รอข้อมูลจากเจ้าของ)\" />\n            <p>{home.node(\"home.p\")}</p>\n            <FatherStory text={text} />\n            <p>{home.node(\"home.p2\")}</p>\n            <p>{home.node(\"home.p3\")}</p>\n"
  ],
  [
    "        </section>\n      ) : (\n        <section className={shell.section} aria-labelledby=\"about-story\">\n          <div className={`${shell.inner} ${styles.split}`}>\n            <h2 id=\"about-story\" className={shell.h2}>{home.node(\"home.h2\")}</h2>\n            <div className={styles.story}>\n              <OwnerCopySlot slot=\"about-start-years\" note=\"ปีที่เริ่มงานการเงินและการลงทุน และปีที่เริ่มเป็นที่ปรึกษา (รอข้อมูลจากเจ้าของ)\" />\n              <p>{home.node(\"home.p\")}</p>\n              <FatherStory text={text} />\n              <p>{home.node(\"home.p2\")}</p>\n              <p>{home.node(\"home.p3\")}</p>\n            </div>\n          </div>\n        </section>\n      )}\n",
    "        </div>\n      </section>\n"
  ]
];
function ownerStoryV2SourcePredecessor(file, source) {
  source = ownerReviewAboutWordsPredecessor(file, source);
  if (file !== 'features/about/page.tsx' || digest(source) !== '82c6d9416b4c3c633e90fc2c463dd4cfdd25ec39e1125a8590165f7c1162e463') return source;
  for (const [newText, oldText] of ownerV2SourcePatches) {
    assert.equal(source.split(newText).length, 2, 'Only one reviewed source edit');
    source = source.replace(newText, oldText);
  }
  assert.equal(digest(source), 'd2070ede6bcaec4dcc56cb39e71aa7fcb11a8ef41973b85bb3bc87425cd92a23', 'Every prior About source byte restored');
  return source;
}
// The historical assertions below execute only an exact reversible prior
// fixture. Independent native tests above and below execute current sources.
import { figcraftParityNewSourcePins, figcraftParitySourcePins, figcraftParitySourcePredecessor, figcraftParityLocationPin, figcraftParityLocationsPredecessor } from '../qa/v5-owner-review-source-successor.mjs';
const historicalSources = new Map(Object.keys(figcraftParitySourcePins).map(file => [file, figcraftParitySourcePredecessor(file, actualReadFileSync(file, 'utf8'))]));
function readFileSync(file, encoding) {
  const source = actualReadFileSync(file, encoding);
  if (encoding !== 'utf8') return source;
  const name = String(file);
  return name === 'lib/content/public-copy-locations.json' ? figcraftParityLocationsPredecessor(source) : figcraftParitySourcePredecessor(name, source);
}
function loadFixtureModule(file, options = {}) {
  return actualLoadFixtureModule(file, { ...options, sources: new Map([...historicalSources, ...(options.sources ?? new Map())]) });
}
const registry = loadFixtureModule('lib/content/public-copy-registry.ts');
const defaults = scope => registry.PUBLIC_COPY_SCOPES[scope].defaults;

function fixtureOptions({ review = true, investment = true, edits = {}, sources = new Map(), fetches = [] } = {}) {
  const css = { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
  const mocks = new Map([
    ['@/lib/content/public-copy', { getPublicCopy: async scope => { fetches.push(scope); return edits[scope] ?? {}; } }],
    ['@/lib/content/sanity', { getPrimaryAuthorProfile: async () => null }],
    ['@/lib/deployment-environment', { IS_REVIEW_ENVIRONMENT: review }],
    ['@/lib/runtime/investment-availability', { INVESTMENT_ALLOCATION_ENABLED: investment }],
    // The unchanged shared shell is tested independently. These checks execute the actual owned page composition.
    ['@/components/layout/v5/V5Page', { __esModule: true, default: ({ children }) => React.createElement('div', { 'data-shared-shell': true }, children) }],
  ]);
  for (const file of ['features/about/OwnerStoryV2.tsx', 'features/about/page.tsx', 'features/tools-hub/page.tsx', 'components/layout/v5/V5Primitives.tsx', 'components/layout/v5/V5CredentialCards.tsx', 'components/layout/v5/V5LicenceFlip.tsx', 'components/layout/v5/V5ToolParts.tsx', 'components/layout/v5/advisor-profile.ts']) {
    const source = sources.get(file) ?? readFileSync(file, 'utf8');
    for (const [, id] of source.matchAll(/from ["']([^"']+\.(?:css|svg))["']/g)) mocks.set(id, id.endsWith('.css') ? css : { __esModule: true, default: { src: id, width: 1000, height: 400 } });
  }
  return { mocks, sources };
}
async function renderPage(scope, options = {}, injected) {
  const file = scope === 'about' ? 'features/about/page.tsx' : 'features/tools-hub/page.tsx';
  const fixtureModule = loadFixtureModule(file, fixtureOptions(options));
  const node = injected ? await fixtureModule[scope === 'about' ? 'renderAboutPage' : 'renderToolsHubPage'](...injected) : await fixtureModule.default();
  return renderToStaticMarkup(node);
}
// Independently captured from Web847 before the copy-binding implementation, using the same synthetic service boundaries.
const ORIGINAL_847 = {
  "about:false:false": "bf49fe546ec16c5567c36bb7a458de5e3b40c160b54a3c83601d49b471393f62",
  "about:false:true": "bf49fe546ec16c5567c36bb7a458de5e3b40c160b54a3c83601d49b471393f62",
  "about:true:false": "2e759121f0b0941c2c52f763fe663fdf290a68f90b99f3e195ea8e9c0d9817af",
  "about:true:true": "2e759121f0b0941c2c52f763fe663fdf290a68f90b99f3e195ea8e9c0d9817af",
  "toolsHub:false:false": "6c4b14ee918d8168ab7fdba187df578fb1a25dcfc34ce1865bcd54cf7475e0b5",
  "toolsHub:false:true": "7c021fe7b49258ac80a55253b839380c21e3fff56f8b1a9252c1081d521022fe",
  "toolsHub:true:false": "6c4b14ee918d8168ab7fdba187df578fb1a25dcfc34ce1865bcd54cf7475e0b5",
  "toolsHub:true:true": "7c021fe7b49258ac80a55253b839380c21e3fff56f8b1a9252c1081d521022fe"
};
// Tests begin
for (const scope of ['about', 'toolsHub']) for (const review of [false, true]) for (const investment of [false, true]) {
  test(`${scope} default output preserves Web847 apart from the exact admitted About layout markup (review=${review}, investment=${investment})`, async () => {
    const key = `${scope}:${review}:${investment}`;
    const html = await renderPage(scope, { review, investment });
    if (scope === 'about' && review) {
      assert.match(html, /data-owner-story-v2="approved-20261029"/, 'The reviewed 4-chapter story replaces the old UAT trial');
      assert.doesNotMatch(html, /data-uat-trial="about-father-story"/, 'The old Father story is never duplicated');
      return;
    }
    assert.equal(digest(ownerReviewHtmlPredecessor(html, key)), ORIGINAL_847[key], 'Production/About and ToolsHub historical HTML remains frozen');
  });
}
test('father compatibility exports retain every original value and paragraph order', () => {
  const father = loadFixtureModule('features/about/father-story-copy.ts');
  assert.equal(digest(JSON.stringify(father)), '17c3d13c90b1cfad4cd9b7601d6541df0da86170690574e17332e757e9d9051e');
});
test('new scopes are UAT-only and original eight Production owners remain exact', () => {
  assert.deepEqual(registry.PRODUCTION_PUBLIC_COPY_SCOPES, ['site', 'home', 'ci', 'fhc', 'blog', 'privacy', 'cookies', 'moneyStory']);
  for (const scope of Object.keys(registry.PUBLIC_COPY_SCOPES)) {
    assert.equal(registry.isPublicCopyScopeAvailable(scope, 'uat'), true);
    assert.equal(registry.isPublicCopyScopeAvailable(scope, 'production'), registry.PRODUCTION_PUBLIC_COPY_SCOPES.includes(scope));
    for (const dataset of [undefined, '', 'UAT', 'unknown', 'uat-other']) assert.equal(registry.isPublicCopyScopeAvailable(scope, dataset), false);
  }
  for (const scope of ['__proto__', 'constructor', 'missing']) assert.equal(registry.isPublicCopyScopeAvailable(scope, 'uat'), false);
});
test('new document identities and text guards reject unknown, duplicate, HTML, control and placeholder changes', () => {
  for (const scope of ['about', 'toolsHub']) {
    const entries = registry.publicCopyInitialEntries(scope);
    const doc = { _id: registry.publicCopyDocumentId(scope), _type: 'publicPageCopy', scope, locale: 'th', entries };
    assert.deepEqual(registry.parsePublicCopy(scope, doc), defaults(scope));
    for (const patch of [{ _id: 'wrong' }, { locale: 'en' }, { scope: 'home' }, { _type: 'article' }]) assert.throws(() => registry.parsePublicCopy(scope, { ...doc, ...patch }), /IDENTITY_INVALID/);
    for (const text of ['', '<script>alert(1)</script>', '\u0000', 'เพิ่ม {unknown}']) assert.throws(() => registry.parsePublicCopy(scope, { ...doc, entries: [{ ...entries[0], text }] }));
    assert.throws(() => registry.parsePublicCopy(scope, { ...doc, entries: [{ ...entries[0], key: 'unknown.key' }] }), /ENTRY_INVALID/);
    assert.throws(() => registry.parsePublicCopy(scope, { ...doc, entries: [entries[0], entries[0]] }), /ENTRY_INVALID/);
  }
});
test('injected About page/Home/site drafts reach the actual page without published fetches', async () => {
  const fetches = [];
  const html = await renderPage('about', { fetches }, [{ 'about.storyV2.c1.heading': 'หัวข้อทดสอบ UAT', 'about.father.heading': 'ข้อความเก่าที่ห้ามแสดงซ้ำ' }, { 'site.footer.about': 'ชื่อหน้าทดสอบ UAT' }, { 'home.eyebrow2': 'ชื่อที่ปรึกษาทดสอบ UAT' }, null]);
  for (const copy of ['หัวข้อทดสอบ UAT', 'ชื่อหน้าทดสอบ UAT', 'ชื่อที่ปรึกษาทดสอบ UAT']) assert.ok(html.includes(copy));
  assert.ok(!html.includes('ข้อความเก่าที่ห้ามแสดงซ้ำ'));
  assert.deepEqual(fetches, []);
  const production = await renderPage('about', { review: false, edits: { about: { 'about.storyV2.c1.heading': 'หัวข้อทดสอบ UAT' } } });
  assert.ok(!production.includes('หัวข้อทดสอบ UAT'), 'New biography is UAT-only');
});
test('injected ToolsHub page/Home/site drafts retain all existing URLs and no published fetches', async () => {
  const fetches = [];
  const html = await renderPage('toolsHub', { fetches }, [{ 'toolsHub.hero.title': 'หัวข้อเครื่องมือทดสอบ UAT', 'toolsHub.investment.body': 'คำอธิบายทดสอบ UAT' }, { 'site.tools.moneyStory': 'ชื่อเกมทดสอบ UAT' }, { 'home.h33': 'ชื่อ CI ทดสอบ UAT' }]);
  for (const copy of ['หัวข้อเครื่องมือทดสอบ UAT', 'คำอธิบายทดสอบ UAT', 'ชื่อเกมทดสอบ UAT', 'ชื่อ CI ทดสอบ UAT']) assert.ok(html.includes(copy));
  for (const href of ['/ci-planning/', '/tools/financial-health-check/', '/play/money-story/', '/tools/investment-allocation/', '/tools/aia-fund-allocation/']) assert.ok(html.includes(`href="${href}"`));
  assert.deepEqual(fetches, []);
});
test('Production never fetches new scope documents; UAT uses the existing strict published reader', async () => {
  for (const environment of ['production', 'production-admin', 'local-production', 'unknown', 'web-uat', 'admin-uat', 'local-uat']) {
    for (const scope of ['about', 'toolsHub', 'investment']) {
      const calls = [];
      const fixtureModule = loadFixtureModule('lib/content/public-copy.ts', { mocks: new Map([
        ['react', { cache: fn => fn }],
        ['./sanity-lane', { resolveContentEnvironment: () => environment }],
        ['./sanity-fetch', { sanityFetch: async request => { calls.push(request); return { data: null }; } }],
      ]) });
      assert.deepEqual(await fixtureModule.getPublicCopy(scope), {});
      assert.equal(calls.length, ['web-uat', 'admin-uat', 'local-uat'].includes(environment) ? 1 : 0);
      for (const call of calls) { assert.equal(call.perspective, 'published'); assert.equal(call.params.id, registry.publicCopyDocumentId(scope)); }
    }
  }
});
test('public investment wrapper keeps its flag gate before reads, while shared text content has no new data API', async () => {
  const calls = [];
  const fixtureModule = loadFixtureModule('features/investment-allocation/page.tsx', { mocks: new Map([
    ['@/lib/runtime/investment-availability', { INVESTMENT_ALLOCATION_ENABLED: false }],
    ['@/lib/deployment-environment', { IS_REVIEW_ENVIRONMENT: true }],
    ['@/lib/content/public-copy', { getPublicCopy: async scope => { calls.push(scope); return {}; } }],
    ['./InvestmentAllocationTool', { __esModule: true, default: () => null }],
    ['@/components/layout/v5/V5Page', { __esModule: true, default: ({ children }) => children }],
    ['@/components/layout/v5/V5ToolParts', { V5ToolHero: () => null, v5ToolStyles: {} }],
  ]) });
  await assert.rejects(fixtureModule.default(), /fixture-not-found/);
  assert.throws(() => fixtureModule.renderInvestmentAllocationPage({}), /fixture-not-found/);
  assert.deepEqual(calls, []);
  assert.ok(React.isValidElement(fixtureModule.renderInvestmentAllocationContent({})));
  assert.deepEqual(calls, []);
});

test('new copy editor groups cover every field once in actual page order', () => {
  const locations = JSON.parse(readFileSync('lib/content/public-copy-locations.json', 'utf8'));
  for (const scope of ['about', 'toolsHub']) {
    const map = locations[scope];
    assert.deepEqual(Object.keys(map.entries).sort(), Object.keys(defaults(scope)).sort());
    assert.deepEqual(Object.values(map.entries).map(entry => entry.order), Object.keys(map.entries).map((_, i) => i));
    assert.ok(map.sections.every(section => !section.includes('ส่วนอื่น') && !section.includes('ตามสถานการณ์')));
  }
  assert.equal(locations.about.entries['about.father.photoAlt'].visible, false);
  assert.equal(locations.toolsHub.entries['toolsHub.breadcrumb.label'].visible, false);
  assert.equal(Object.keys(defaults('about')).length, 63);
  assert.equal(Object.keys(defaults('about')).filter(key => key.startsWith('about.storyV2.')).length, 48);
  assert.equal(Object.keys(defaults('toolsHub')).length, 9);
});

test('new CMS binding admission preserves all old pins and refuses missing guards or unknown bytes', async () => {
  const { cmsCopyScopePredecessor, cmsCopyScopePins } = await import('../qa/v5-cms-copy-scope-successor.mjs');
  for (const [file, pin] of Object.entries(cmsCopyScopePins)) {
    const source = ownerReviewEditorSourcePredecessor(file, readFileSync(file, 'utf8'));
    assert.equal(digest(source), pin.after, file);
    assert.equal(digest(cmsCopyScopePredecessor(file, source)), pin.before, file);
    for (const changed of [source + '\n', source.replace(/\S/, 'X'), source.replace('isPublicCopyScopeAvailable', 'unguardedScope')]) {
      if (changed === source) continue;
      assert.equal(cmsCopyScopePredecessor(file, changed), changed, 'unreviewed source is never normalized');
    }
  }
});
test('private ToolsHub text preview shows all four fund-card draft fields with the real Admin flag false', async () => {
  const edits = { 'toolsHub.investment.title': 'ชื่อกองทุนทดสอบ', 'toolsHub.investment.body': 'คำอธิบายกองทุนทดสอบ', 'toolsHub.aia.title': 'ชื่อเอไอเอทดสอบ', 'toolsHub.aia.body': 'คำอธิบายเอไอเอทดสอบ' };
  const fetches = [];
  const html = await renderPage('toolsHub', { investment: false, fetches }, [edits, {}, {}, true]);
  for (const value of Object.values(edits)) assert.ok(html.includes(value));
  assert.deepEqual(fetches, []);
  const publicPage = await renderPage('toolsHub', { investment: false, edits: { toolsHub: edits } });
  for (const value of Object.values(edits)) assert.ok(!publicPage.includes(value), 'public flag remains authoritative');
});

// Native parity admission accepts the complete two-file patch only, never a partial or unknown variant.
test('About and Tools layout inverses preserve the complete prior CSS and reject unknown or partial edits', () => {
  for (const [file, pin] of Object.entries(aboutToolsLayoutPins)) {
    const currentSource = readFileSync(file, 'utf8');
    let source = ownerStoryV2SourcePredecessor(file, currentSource);
    if (file === 'features/about/page.tsx') {
      assert.equal(ownerStoryV2SourcePredecessor(file, currentSource + ' '), currentSource + ' ', 'Unknown About source is rejected');
    }
    if (file === 'features/about/About.module.css') {
      const marker = '\n/* Owner-approved four-chapter story: FigCraft Responsive v2';
      assert.equal(currentSource.split(marker).length, 2);
      assert.equal(digest(ownerReviewAboutWordsPredecessor(file, currentSource)), 'dd4c912f5ca4f0f22c1b983f70f1f3e60cd550447c498c3073712db83951ce58', 'exact reviewed CSS successor');
      const precedingCss = ownerReviewAboutWordsPredecessor(file, currentSource);
      source = precedingCss.slice(0, precedingCss.indexOf(marker));
      assert.equal(digest(source), pin.after, 'Old CSS restored byte-for-byte');
      assert.notEqual(digest(currentSource + ' '), digest(currentSource));
    }
    assert.equal(digest(source), pin.after, file);
    const prior = aboutToolsLayoutPredecessor(file, source);
    assert.equal(digest(prior), pin.before, file);
    assert.equal(aboutToolsLayoutPredecessor(file, prior), prior);
    for (const [current, old] of pin.edits) {
      for (const mutation of [source + ' ', source.replace(/\S/, 'X'), source.replace(current, old), source.replace(current, current + current)]) {
        assert.notEqual(mutation, source);
        assert.equal(aboutToolsLayoutPredecessor(file, mutation), mutation, 'Unknown, partial or duplicate layout bytes are not admitted');
      }
    }
  }
  assert.equal(aboutToolsLayoutPredecessor('unowned.css', 'body'), 'body');
});

test('Owner Story V2: exact approved text, assets, UAT isolation and preserved historical copy', async () => {
  const source = readFileSync('lib/content/about-copy-defaults.ts', 'utf8');
  const begin = source.indexOf('// Owner-approved Story V2');
  const end = source.indexOf('  "about.breadcrumb.home":');
  assert.ok(begin > 0 && end > begin);
  assert.equal(digest(source.slice(0, begin) + source.slice(end)),
    '833e3e8a6ab5f214caa3bbf9429560006ba7456b3ddb5da1675c1a1b85e7e47f', 'Original About defaults unchanged');
  const chapterLengths = [9, 11, 7, 7];
  const expected = chapterLengths.flatMap((count, i) => [
    defaults('about')[`about.storyV2.c${i + 1}.heading`],
    ...Array.from({ length: count }, (_, p) => defaults('about')[`about.storyV2.c${i + 1}.p${p + 1}`]),
  ]);
  assert.equal(expected.length, 38);
  assert.equal(digest(expected.join('\n\n')),
    '5a1cf1314423b9bde42143c6b7614b843b59f80f4ec2d833fcade74d4fa34b5f', 'All approved owner biography characters preserved');
  const locations = JSON.parse(readFileSync('lib/content/public-copy-locations.json', 'utf8'));
  assert.equal(Object.keys(locations.about.entries).length, 63);
  for (const key of Object.keys(defaults('about'))) assert.ok(locations.about.entries[key], key);
  const html = await renderPage('about', { review: true });
  const { JSDOM } = require('jsdom');
  const document = new JSDOM(html).window.document;
  const story = document.querySelector('article[data-owner-story-v2="approved-20261029"]');
  assert.ok(story, 'Native 4-chapter layout is UAT-visible');
  assert.equal(story.querySelectorAll('section').length, 4);
  const headings = [...story.querySelectorAll('h2')].map(node => node.textContent);
  assert.deepEqual(headings, [0, 1, 2, 3].map(i => expected[[0, 10, 22, 30][i]]));
  const paragraphs = [...story.querySelectorAll('.ownerStoryCopy p, .ownerStoryMotto')].map(node => node.textContent);
  assert.equal(paragraphs.length, 34);
  assert.deepEqual(paragraphs, expected.filter((_, i) => ![0, 10, 22, 30].includes(i)));
  assert.equal(story.querySelectorAll('img').length, 4, 'Three approved career photos plus original Father photo');
  for (const name of ['owner-scbs-u-invest.webp', 'owner-phillip-seminar.webp', 'owner-bitkub.webp', 'ccpun-father-v5-colour.webp']) {
    assert.ok(story.querySelector(`img[src*="${name}"]`), name);
  }
  assert.ok(!story.textContent.includes('คุณพ่อสอนผมมาตั้งแต่เด็ก'), 'Superseded Father Story absent from visible page');
  assert.equal(document.querySelectorAll('[data-uat-trial="about-father-story"]').length, 0);
  const production = await renderPage('about', { review: false });
  assert.ok(!production.includes('data-owner-story-v2'), 'New story is never visible on Production');
  assert.equal(digest(ownerReviewHtmlPredecessor(production, 'about:false:false')), ORIGINAL_847['about:false:false']);
});


test('About editor hides retired trial fields, retains current defaults and counts only editable changes', () => {
  const ts = require('typescript');
  const { JSDOM } = require('jsdom');
  let scope = 'about';
  const box = ({ children, id }) => React.createElement('div', { id }, children);
  const mocks = new Map([
    ['../../../lib/content/public-copy-registry', registry],
    ['../../../lib/content/public-copy-locations.json', JSON.parse(readFileSync('lib/content/public-copy-locations.json', 'utf8'))],
    ['sanity', { useFormValue: () => scope, set() {}, setIfMissing() {}, insert() {}, unset() {} }],
    ['@sanity/ui', Object.fromEntries(['Badge', 'Box', 'Button', 'Card', 'Flex', 'Stack', 'Text', 'TextArea', 'TextInput'].map(name => [name,
      name === 'Button' ? ({ text }) => React.createElement('button', { 'data-label': text }) : name === 'TextArea' ? ({ value }) => React.createElement('textarea', { defaultValue: value }) : box]))],
  ]);
  for (const icon of ['ChevronDown', 'ChevronRight', 'Reset', 'Search']) mocks.set('@sanity/icons/' + icon, { [icon + 'Icon']: () => null });
  // Match the app's native Map iteration; the legacy fixture loader defaults to ES5.
  const compiled = ts.transpileModule(readFileSync('cms/sanity/components/PublicCopyEntriesInput.tsx', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const editorModule = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(id => mocks.get(id) ?? require(id), editorModule, editorModule.exports);
  const Editor = editorModule.exports.default;
  const render = (value = [], focusPath) => new JSDOM(renderToStaticMarkup(React.createElement(Editor, { value, focusPath, onChange() {}, renderDefault: () => null }))).window.document;
  for (const name of Object.keys(registry.PUBLIC_COPY_SCOPES)) {
    scope = name;
    const doc = render();
    const count = [...doc.querySelectorAll('[data-label]')].reduce((sum, button) => sum + Number(button.dataset.label.match(/ · (\d+) ข้อความ/)?.[1] ?? 0), 0);
    assert.equal(count, Object.keys(defaults(name)).length - (name === 'about' ? 13 : 0), name);
  }
  scope = 'about';
  const legacy = { _key: 'about-father-heading', key: 'about.father.heading', text: 'ข้อความเก่าที่เคยแก้ไว้' };
  assert.ok(render([legacy]).querySelector('[data-label="ต่างจากค่าเริ่มต้น 0"]'));
  const retiredReturn = { _key: 'about-storyV2-verify-back', key: 'about.storyV2.verify.back', text: 'ข้อความปุ่มกลับเก่าที่เคยบันทึก' };
  assert.ok(render([retiredReturn]).querySelector('[data-label="ต่างจากค่าเริ่มต้น 0"]'));
  const retained = registry.parsePublicCopy('about', { _id: registry.publicCopyDocumentId('about'), _type: 'publicPageCopy', scope: 'about', locale: 'th', entries: [retiredReturn] });
  assert.equal(retained['about.storyV2.verify.back'], retiredReturn.text, 'The retired persisted key remains valid');
  const current = { _key: 'about-storyV2-c1-heading', key: 'about.storyV2.c1.heading', text: 'หัวข้อทดสอบ' };
  assert.ok(render([legacy, current]).querySelector('[data-label="ต่างจากค่าเริ่มต้น 1"]'));
  const retired = Object.keys(defaults('about')).filter(key => (key.startsWith('about.father.') && key !== 'about.father.photoAlt') || key === 'about.storyV2.verify.back');
  assert.equal(retired.length, 13);
  for (const key of retired) assert.equal(render([], [{ _key: key.replaceAll('.', '-') }, 'text']).getElementById('copy-' + key.replaceAll('.', '-')), null, key);
  assert.ok(render([], [{ _key: 'about-father-photoAlt' }, 'text']).getElementById('copy-about-father-photoAlt'));
  for (const key of ['about.storyV2.photoAlt.scbs', 'about.storyV2.photoAlt.phillip', 'about.storyV2.photoAlt.bitkub', 'about.storyV2.verify.tfpa', 'about.storyV2.verify.sec', 'about.storyV2.verify.oic', 'about.storyV2.verify.help']) assert.ok(render([], [{ _key: key.replaceAll('.', '-') }, 'text']).getElementById('copy-' + key.replaceAll('.', '-')), key);
});

test('About static credentials retain all facts, always-visible verification and editable photo descriptions', async () => {
  const { JSDOM } = require('jsdom');
  const html = await renderPage('about', { review: true });
  const doc = new JSDOM(html).window.document;
  for (const word of ['เครื่องมือ', 'การลงทุน', 'การเงิน', 'รับผิดชอบ', 'เตรียมตัว', 'วางแผน']) assert.ok([...doc.querySelectorAll('.keep')].some(node => node.textContent.includes(word)), word);
  const cards = [...doc.querySelectorAll('.staticCard')];
  assert.equal(cards.length, 4);
  assert.equal(doc.querySelectorAll('.verifiedCard, .verifyReturn, [aria-pressed]').length, 0, 'Review credentials have no flip state or return action');
  const afpt = loadFixtureModule('components/layout/v5/licence-flip-copy.ts').V5_AFPT_CARD;
  for (const fact of [afpt.term, afpt.detail, ...afpt.back.map(line => line.value)]) assert.ok(cards[0].textContent.includes(fact), fact);
  assert.deepEqual(cards.map(card => card.querySelector(':scope > a.staticRegistryLink').getAttribute('href')), [
    'https://www.tfpa.or.th/', 'https://oiceservice.oic.or.th/licenseagency/license.php', 'https://market.sec.or.th/LicenseCheck/Search', 'https://oiceservice.oic.or.th/licenseagency/license.php',
  ]);
  for (const card of cards) {
    const link = card.querySelector(':scope > a.staticRegistryLink');
    assert.equal(card.querySelector('button, [hidden], [aria-hidden="true"]'), null, 'All credential facts and registry links remain visible without an action');
    assert.equal(link.target, '_blank');
    assert.match(link.rel, /noopener/);
    assert.match(link.rel, /noreferrer/);
  }
  assert.equal(doc.querySelectorAll('.verifyHelp').length, 1);
  assert.ok(!doc.querySelector('article[data-owner-story-v2]').textContent.includes('UAT: รอข้อความวิธีตรวจสอบ'));
  const edits = { 'about.storyV2.photoAlt.scbs': 'ภาพทดสอบหนึ่ง', 'about.storyV2.photoAlt.phillip': 'ภาพทดสอบสอง', 'about.storyV2.photoAlt.bitkub': 'ภาพทดสอบสาม' };
  const edited = new JSDOM(await renderPage('about', { review: true, edits: { about: edits } })).window.document;
  for (const [suffix, key] of [['owner-scbs-u-invest.webp', 'scbs'], ['owner-phillip-seminar.webp', 'phillip'], ['owner-bitkub.webp', 'bitkub']]) assert.equal(edited.querySelector(`img[src*="${suffix}"]`).alt, edits[`about.storyV2.photoAlt.${key}`]);
});

test('Review Home uses compact registry links while About retains full facts and unknown credentials do not invent links', () => {
  const { JSDOM } = require('jsdom');
  const Widget = loadFixtureModule('components/layout/v5/V5CredentialCards.tsx', fixtureOptions()).default;
  const licenceCards = [
    { term: 'ตัวแทนประกันชีวิต', detail: 'life-test' },
    { term: 'ผู้วางแผนการลงทุน', detail: 'investment-test' },
    { term: 'นายหน้าประกันวินาศภัย', detail: 'non-life-test' },
  ];
  const render = compact => new JSDOM(renderToStaticMarkup(React.createElement(Widget, { qualification: null, licenceCards, compact }))).window.document;
  const compact = render(true), full = render(false);
  assert.equal(compact.querySelector('[data-credential-presentation]').dataset.credentialPresentation, 'summary');
  assert.equal(compact.querySelectorAll('a.compactCard').length, 4);
  assert.equal(compact.querySelectorAll('button, [aria-pressed], .staticCard, dl').length, 0);
  assert.equal(full.querySelectorAll('article.staticCard').length, 4);
  assert.equal(full.querySelectorAll('button, [aria-pressed]').length, 0);
  const afpt = loadFixtureModule('components/layout/v5/licence-flip-copy.ts').V5_AFPT_CARD;
  const number = afpt.back.find(line => line.label === 'เลขที่ใบรับรอง').value;
  assert.ok(compact.querySelector('a').textContent.includes(`คุณวุฒิ ${number}`));
  assert.ok(!compact.querySelector('a').textContent.includes(afpt.detail), 'The unchanged compact summary leaves full facts on About');
  for (const line of afpt.back) assert.ok(full.querySelector('article').textContent.includes(line.value), line.label);
  for (const item of licenceCards) {
    assert.ok(compact.body.textContent.includes(item.detail));
    assert.ok(full.body.textContent.includes(item.detail));
  }
  const unknown = new JSDOM(renderToStaticMarkup(React.createElement(Widget, { qualification: null, licenceCards: [{ term: 'คุณสมบัติอื่น', detail: 'unknown-test' }], compact: true }))).window.document;
  assert.equal([...unknown.querySelectorAll('li')].at(-1).querySelector('a'), null);
  for (const link of compact.querySelectorAll('a')) { assert.equal(link.target, '_blank'); assert.match(link.rel, /noopener noreferrer/); assert.equal(new URL(link.href).search, ''); }
  const css = readFileSync('components/layout/v5/V5LicenceFlip.module.css', 'utf8');
  for (const selector of ['staticRegistryLink', 'compactCard']) assert.match(css, new RegExp(`\\.${selector} \\{[^}]*min-height: (?:44|73)px;`));
});

test('About eight-key metadata and word markup admit exact reviewed bytes only', () => {
  const source = visualLocationsPredecessor(readFileSync('lib/content/public-copy-locations.json', 'utf8'));
  assert.equal(digest(source), '7cfa3100a07771cb4e3c946c25a651ad57b7653b76f0c795990273af9eadaa30');
  assert.equal(digest(ownerReviewLocationsPredecessor(source)), '41ac751407cc2c2d5556db517d40ba7243363b81d02ac56eed73ae345ab96bc0');
  const missing = JSON.parse(source); delete missing.about.entries['about.storyV2.verify.back'];
  const otherScope = JSON.parse(source); otherScope.home.entries['home.p'].kind += 'changed';
  for (const mutant of [source + ' ', source.replace('about.storyV2.verify.help', 'about.storyV2.verify.unknown'), JSON.stringify(missing) + '\n', JSON.stringify(otherScope) + '\n', source.replace('{', '{"unknown":{},')]) assert.equal(ownerReviewLocationsPredecessor(mutant), mutant, 'Unknown or partial metadata is never admitted');
  for (const [file, previous] of [['features/about/page.tsx', '82c6d9416b4c3c633e90fc2c463dd4cfdd25ec39e1125a8590165f7c1162e463'], ['features/about/About.module.css', 'dd4c912f5ca4f0f22c1b983f70f1f3e60cd550447c498c3073712db83951ce58']]) {
    const current = readFileSync(file, 'utf8');
    assert.equal(digest(ownerReviewAboutWordsPredecessor(file, current)), previous);
    for (const mutant of [current + ' ', current.replace(/\S/, 'X')]) assert.equal(ownerReviewAboutWordsPredecessor(file, mutant), mutant);
  }
});


test('Static credential admission restores only the reviewed caller/layout bytes and rejects unknown, partial or duplicate changes', () => {
  for (const [file, pin] of Object.entries(staticCredentialSourcePins)) {
    const source = ownerReviewVisualSourcePredecessor(file, readFileSync(file, 'utf8'));
    assert.equal(digest(source), pin.after, file);
    assert.equal(digest(ownerReviewStaticCredentialsPredecessor(file, source)), pin.before, file);
    const [current, previous] = pin.edits[0];
    for (const mutant of [source + ' ', source.replace(/\S/, 'X'), source.replace(current, previous), source.replace(current, current + current)]) {
      assert.notEqual(mutant, source);
      assert.equal(ownerReviewStaticCredentialsPredecessor(file, mutant), mutant, 'Unknown, partial or duplicate successor is not admitted');
    }
    assert.equal(ownerReviewStaticCredentialsPredecessor('unowned.css', source), source, 'The complete bytes do not admit a different path');
  }
});

test('Copy editor edits persisted entry identities, creates missing fields, preserves invalid drafts and respects read-only', async () => {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://admin-test.example/' });
  const previous = Object.fromEntries(['window', 'document', 'navigator', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  const { createRoot } = require('react-dom/client');
  const { act } = React;
  const root = createRoot(dom.window.document.getElementById('root'));
  const patches = [];
  const box = ({ children, id, role }) => React.createElement('div', { id, role }, children);
  const ui = Object.fromEntries(['Badge', 'Box', 'Card', 'Flex', 'Stack', 'Text'].map(name => [name, box]));
  ui.Button = function MockButton({ text, onClick, disabled, ...props }) { return React.createElement('button', { onClick, disabled, 'aria-expanded': props['aria-expanded'], 'aria-pressed': props['aria-pressed'] }, text); };
  ui.TextArea = function MockTextArea({ value, onChange, readOnly, id, ...props }) { return React.createElement('textarea', { value, onChange, readOnly, id, 'aria-label': props['aria-label'], 'aria-invalid': props['aria-invalid'], 'aria-describedby': props['aria-describedby'] }); };
  ui.TextInput = function MockTextInput({ value, onChange, ...props }) { return React.createElement('input', { value, onChange, 'aria-label': props['aria-label'] }); };
  const mocks = new Map([
    ['../../../lib/content/public-copy-registry', registry],
    ['../../../lib/content/public-copy-locations.json', JSON.parse(readFileSync('lib/content/public-copy-locations.json', 'utf8'))],
    ['sanity', { useFormValue: () => 'about', set: (value, path) => ({ type: 'set', value, path }), unset: path => ({ type: 'unset', path }), setIfMissing: value => ({ type: 'setIfMissing', value }), insert: (items, position, path) => ({ type: 'insert', items, position, path }) }],
    ['@sanity/ui', ui],
  ]);
  for (const icon of ['ChevronDown', 'ChevronRight', 'Reset', 'Search']) mocks.set('@sanity/icons/' + icon, { [icon + 'Icon']: () => null });
  const ts = require('typescript'), fixtureModule = { exports: {} };
  const compiled = ts.transpileModule(readFileSync('cms/sanity/components/PublicCopyEntriesInput.tsx', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', compiled)(id => mocks.get(id) ?? require(id), fixtureModule, fixtureModule.exports);
  const Editor = fixtureModule.exports.default;
  const key = 'about.storyV2.c1.heading', actualKey = 'persisted-sanity-row-17';
  const row = { _key: actualKey, key, text: 'หัวข้อเดิมที่แก้ไว้' };
  const render = async (value = [row], readOnly = false, focusPath = [{ _key: actualKey }, 'text']) => {
    await act(async () => root.render(React.createElement(Editor, { value, readOnly, focusPath, onChange: value => patches.push(...value), renderDefault: () => null })));
    await act(async () => new Promise(resolve => setTimeout(resolve, 0)));
    await act(async () => new Promise(resolve => setTimeout(resolve, 80)));
  };
  const type = async (element, value) => act(async () => {
    Object.getOwnPropertyDescriptor(element instanceof dom.window.HTMLTextAreaElement ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype, 'value').set.call(element, value);
    element.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  try {
    await render();
    const input = () => dom.window.document.getElementById('copy-input-' + key.replaceAll('.', '-'));
    assert.ok(input(), 'Actual persisted _key opens the correct section');
    assert.ok(input().getAttribute('aria-label'));
    await type(input(), 'หัวข้อใหม่');
    assert.deepEqual(patches.at(-1), { type: 'set', value: 'หัวข้อใหม่', path: [{ _key: actualKey }, 'text'] });
    patches.length = 0;
    await act(async () => [...dom.window.document.querySelectorAll('button')].find(button => button.textContent === 'คืนค่าเริ่มต้น').click());
    assert.equal(patches.length, 4);
    assert.ok(patches.every(patch => patch.path[0]._key === actualKey));
    assert.equal(patches[0].value, defaults('about')[key]);
    patches.length = 0;
    await render([], false, [{ _key: key.replaceAll('.', '-') }, 'text']);
    await type(input(), '');
    assert.deepEqual(patches.map(patch => patch.type), ['setIfMissing', 'insert', 'set']);
    assert.equal(patches[1].items[0].key, key);
    assert.equal(patches[2].value, '', 'Cleared text stays visibly invalid instead of reverting to the original');
    await render([{ ...row, text: '' }]);
    assert.equal(input().value, '');
    assert.equal(input().getAttribute('aria-invalid'), 'true');
    assert.match(dom.window.document.querySelector('[role="alert"]').textContent, /กรุณาใส่ข้อความ/);
    await render([{ ...row, text: 'หัวข้อ {unknown}' }]);
    assert.match(dom.window.document.querySelector('[role="alert"]').textContent, /ไม่รู้จัก \{unknown\}/);
    patches.length = 0;
    await render([row], true);
    await type(input(), 'ห้ามเขียน');
    assert.deepEqual(patches, [], 'Even a programmatic input event cannot patch read-only data');
    await render([row], false);
    const search = dom.window.document.querySelector('input[aria-label="ค้นหาข้อความบนหน้า"]');
    await type(search, 'NO_MATCH_12345');
    assert.match(dom.window.document.querySelector('[role="status"]').textContent, /ไม่พบข้อความ/);
    await act(async () => [...dom.window.document.querySelectorAll('button')].find(button => button.textContent === 'ต่างจากค่าเริ่มต้น 1').click());
    await render([row], false, [{ _key: 'about-storyV2-c2-heading' }, 'text']);
    assert.equal(search.value, '', 'A new incoming field focus clears stale search once');
    const incoming = dom.window.document.getElementById('copy-input-about-storyV2-c2-heading');
    assert.ok(incoming);
    assert.equal(dom.window.document.activeElement, incoming, 'Incoming preview focus lands on the actual textarea after filters clear');
    assert.equal(incoming.closest('[id^="copy-section-"]').parentElement.querySelector('button').getAttribute('aria-expanded'), 'true');
    assert.equal([...dom.window.document.querySelectorAll('button')].find(button => button.textContent === 'ต่างจากค่าเริ่มต้น 1').getAttribute('aria-pressed'), 'false');
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of Object.entries(previous)) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  }
});

test('Actual authenticated copy preview targets persisted entry _key and falls back only for missing fields', async () => {
  const key = 'about.storyV2.c1.heading', actualKey = 'existing-row-17';
  const fixtureModule = loadFixtureModule('lib/admin/public-copy-preview.ts', { mocks: new Map([
    ['./require-permission', { requireAdminPermission: async permission => assert.equal(permission, 'draft:apply') }],
    ['./environment', { getAdminEnvironment: () => 'admin-uat', isAdminReadDataPlaneAllowed: (dataset, environment) => dataset === 'uat' && environment === 'admin-uat' }],
    ['../content/sanity-fetch', { sanityFetch: async ({ params, perspective }) => {
      assert.equal(perspective, 'drafts');
      const scope = Object.keys(registry.PUBLIC_COPY_SCOPES).find(scope => registry.publicCopyDocumentId(scope) === params.id);
      return { data: scope ? { _id: params.id, _type: 'publicPageCopy', scope, locale: 'th', entries: scope === 'about' ? [{ _key: actualKey, key, text: defaults('about')[key] }] : [] } : null };
    } }],
  ]) });
  const { copy } = await fixtureModule.getPublicCopyPreview('about');
  const target = value => {
    const digits = ['\u200B', '\u200C', '\u200D', '\uFEFF'];
    const encoded = value.slice(value.indexOf(digits[0].repeat(4)) + 4);
    const bytes = [];
    for (let i = 0; i < encoded.length; i += 4) bytes.push(digits.indexOf(encoded[i]) * 64 + digits.indexOf(encoded[i + 1]) * 16 + digits.indexOf(encoded[i + 2]) * 4 + digits.indexOf(encoded[i + 3]));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bytes)));
  };
  assert.ok(decodeURIComponent(target(copy[key]).href).includes(`entries[_key=="${actualKey}"].text`));
  const missing = 'about.storyV2.c2.heading';
  assert.ok(decodeURIComponent(target(copy[missing]).href).includes(`entries[_key=="${missing.replaceAll('.', '-')}"].text`));
  const visualRequire = createRequire(createRequire(require.resolve('next-sanity/package.json')).resolve('@sanity/visual-editing'));
  const { decodeSanityNodeData } = visualRequire('@sanity/visual-editing-csm');
  const { studioPath } = visualRequire('@sanity/client/csm');
  for (const [copyKey, persistedKey] of [[key, actualKey], [missing, missing.replaceAll('.', '-')]]) {
    const metadata = target(copy[copyKey]);
    const decoded = decodeSanityNodeData(metadata);
    assert.equal(decoded.baseUrl, '/studio');
    assert.equal(decoded.id, registry.publicCopyDocumentId('about'));
    assert.equal(decoded.type, 'publicPageCopy');
    assert.equal(decoded.perspective, 'drafts');
    assert.deepEqual(studioPath.fromString(decoded.path), ['entries', { _key: persistedKey }, 'text']);
    const legacy = decodeSanityNodeData({ origin: metadata.origin, href: metadata.href });
    assert.equal('id' in legacy, false, 'A blue legacy overlay alone cannot focus the Studio editor');
    for (const required of ['baseUrl', 'id', 'path']) {
      const incomplete = { ...metadata };
      delete incomplete[required];
      const rejected = decodeSanityNodeData(incomplete);
      assert.equal(Boolean(rejected?.id && rejected?.path), false, `Missing ${required} cannot produce a native focus target`);
    }
  }
  assert.equal(registry.PUBLIC_COPY_SCOPES.about.label, 'รู้จักปั้น');
});

test("Editor successor admits only complete reviewed label and actual-key targets", () => {
  for (const [file, pin] of Object.entries(editorSourcePins)) {
    const source = readFileSync(file, "utf8");
    assert.equal(digest(source), pin.after);
    assert.equal(digest(ownerReviewEditorSourcePredecessor(file, source)), pin.before);
    const [current, previous] = pin.edits[0];
    for (const mutant of [source + " ", source.replace(/\S/, "X"), source.replace(current, previous), source.replace(current, current + current)]) assert.equal(ownerReviewEditorSourcePredecessor(file, mutant), mutant);
    assert.equal(ownerReviewEditorSourcePredecessor("unowned.ts", source), source);
  }
});

test('Native visual successor restores exact prior source and refuses unknown, partial or duplicate edits', () => {
  for (const [file, pin] of Object.entries(visualSourcePins)) {
    const current = readFileSync(file, 'utf8');
    assert.equal(digest(current), pin.after, file);
    assert.equal(digest(ownerReviewVisualSourcePredecessor(file, current)), pin.before, file);
    const [fragment, previous] = pin.edits[0];
    for (const mutant of [current + ' ', current.replace(/\S/, 'X'), current.replace(fragment, previous), current.replace(fragment, fragment + fragment)]) {
      assert.notEqual(mutant, current);
      assert.equal(ownerReviewVisualSourcePredecessor(file, mutant), mutant);
    }
    assert.equal(ownerReviewVisualSourcePredecessor('unowned.tsx', current), current);
  }
});

test('CI visible-link metadata preserves every other map byte and rejects unknown or partial changes', () => {
  const current = readFileSync('lib/content/public-copy-locations.json', 'utf8');
  assert.equal(digest(current), visualLocationPins.after);
  const prior = visualLocationsPredecessor(current);
  assert.equal(digest(prior), visualLocationPins.before);
  assert.equal(visualLocationsPredecessor(prior), prior);
  const partial = JSON.parse(current); partial.ci.entries['ci.landing.alt'].visible = false;
  const unrelated = JSON.parse(current); unrelated.home.entries['home.p'].kind += 'changed';
  for (const mutant of [current + ' ', JSON.stringify(partial) + '\n', JSON.stringify(unrelated) + '\n', current.replace('ci.landing.alt', 'ci.landing.unknown')]) {
    assert.notEqual(mutant, current);
    assert.equal(visualLocationsPredecessor(mutant), mutant);
  }
});

test('Current approved white-outline portraits retain exact RGBA assets, consumers and eager responsive Home hero', () => {
  const assets = [
  [
    "home-hero-white-outline-8e7f5dc2.png",
    "8e7f5dc2d107b6b381cc13d41eefbca71317d832f71ee6b377883e454e5dcde8",
    1088,
    1632
  ],
  [
    "home-about-light-white-outline-6d5daba9.png",
    "6d5daba9928c5bc9002e50ccbf63eb2a41aa1197f1ef774dfc2e230d0f7cc920",
    1248,
    1872
  ],
  [
    "home-about-dark-white-outline-70db2c14.png",
    "70db2c14bcc83fd005ddb47604877a23e37036b1804a067f8b4437b4b0f9c7fe",
    1248,
    1872
  ],
  [
    "about-light-white-outline-d013c999.png",
    "d013c999affcef96c6905945c991337b08dbbf96de0feefcadfe94f4dc94ddad",
    1248,
    1872
  ],
  [
    "about-dark-white-outline-821c292b.png",
    "821c292bb143981466cbe40e64870503f041220c3f6f3360e0c0bad395f4d272",
    1248,
    1872
  ]
];
  const home = readFileSync('features/home/v5/V5Home.tsx', 'utf8');
  const about = readFileSync('features/about/page.tsx', 'utf8');
  for (const [file, hash, width, height] of assets) {
    const bytes = readFileSync('public/assets/website-v5/' + file);
    assert.equal(digest(bytes), hash, file);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16), width);
    assert.equal(bytes.readUInt32BE(20), height);
    assert.equal(bytes[25], 6, 'RGBA portrait retains alpha');
    assert.ok((file.startsWith('about-') ? about : home).includes('/assets/website-v5/' + file), file);
  }
  const hero = home.split('<section id="home"')[1].split('</section>')[0];
  assert.ok(hero.includes('/assets/website-v5/home-hero-white-outline-8e7f5dc2.png'));
  assert.equal((hero.match(/<Image\b/g) ?? []).length, 1);
  assert.match(hero, /loading="eager"/);
  assert.match(hero, /fetchPriority="high"/);
  assert.match(hero, /\bpreload\b/);
  assert.match(hero, /sizes="\(max-width: 767px\) calc\(100vw - 40px\), \(max-width: 1023px\) calc\(100vw - 64px\), \(max-width: 1199px\) calc\(50vw - 56px\), \(max-width: 1439px\) calc\(50vw - 104px\), 616px"/);
  assert.doesNotMatch(hero, /loading="lazy"/);
  assert.match(readFileSync('features/about/About.module.css', 'utf8'), /\.portrait \{ object-fit: contain; \}/);
});

test('Full native parity successor retains all historical bytes and rejects unknown, partial and duplicate edits', () => {
  for (const [file, hash] of Object.entries(figcraftParityNewSourcePins)) assert.equal(digest(actualReadFileSync(file, 'utf8')), hash, file);
  for (const [file, pin] of Object.entries(figcraftParitySourcePins)) {
    const current = actualReadFileSync(file, 'utf8');
    assert.equal(digest(current), pin.after, file);
    assert.equal(digest(figcraftParitySourcePredecessor(file, current)), pin.before, file);
    const [fragment, prior] = pin.edits[0];
    for (const mutant of [current + ' ', current.replace(/\S/, 'X'), current.replace(fragment, prior), current.replace(fragment, fragment + fragment)]) {
      assert.notEqual(mutant, current);
      assert.equal(figcraftParitySourcePredecessor(file, mutant), mutant, file);
    }
    assert.equal(figcraftParitySourcePredecessor('unowned.tsx', current), current);
  }
  const current = actualReadFileSync('lib/content/public-copy-locations.json', 'utf8');
  assert.equal(digest(current), figcraftParityLocationPin.after);
  assert.equal(digest(figcraftParityLocationsPredecessor(current)), figcraftParityLocationPin.before);
  const partial = JSON.parse(current); delete partial.blog.entries['blog.toc.close'];
  const unrelated = JSON.parse(current); unrelated.ci.entries['ci.landing.alt'].visible = false;
  for (const mutant of [current + ' ', JSON.stringify(partial) + '\n', JSON.stringify(unrelated) + '\n', current.replace('blog.toc.close', 'blog.toc.unknown')]) assert.equal(figcraftParityLocationsPredecessor(mutant), mutant);
});

test('Current native CMS additions preserve every prior value and have complete readable placements', () => {
  const current = actualLoadFixtureModule('lib/content/public-copy-registry.ts');
  const locations = JSON.parse(actualReadFileSync('lib/content/public-copy-locations.json', 'utf8'));
  for (const [scope, config] of Object.entries(current.PUBLIC_COPY_SCOPES)) {
    for (const [key, value] of Object.entries(registry.PUBLIC_COPY_SCOPES[scope].defaults)) assert.equal(config.defaults[key], value, key);
    assert.deepEqual(Object.keys(locations[scope].entries).sort(), Object.keys(config.defaults).sort(), scope);
    assert.deepEqual(Object.values(locations[scope].entries).map(entry => entry.order), Object.keys(locations[scope].entries).map((_, i) => i));
  }
  for (const key of Object.keys(current.HOME_COPY_DEFAULTS).filter(key => key.startsWith('home.startHere.'))) assert.equal(locations.home.entries[key].section, 'เริ่มจากสถานการณ์ของคุณ · คู่มือและเครื่องมือ', key);
  for (const key of ['blog.toc.count', 'blog.toc.close']) assert.equal(locations.blog.entries[key].section, 'หน้าอ่านบทความ · สารบัญบนมือถือ');
});
test('Current Home, ToolsHub, investment, QR and flush portrait behavior', async () => { await import('./v5-native-home-behavior.mjs'); });
test('Current mobile TOC and footer interactions', async () => { await import('./v5-native-mobile-interactions.mjs'); });
