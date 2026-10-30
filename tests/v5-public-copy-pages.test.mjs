import { ownerReviewAboutWordsPredecessor, ownerReviewLocationsPredecessor } from "../qa/v5-owner-review-source-successor.mjs";
import { ownerReviewHtmlPredecessor } from '../qa/v5-owner-review-source-successor.mjs';
import { aboutToolsLayoutPins, aboutToolsLayoutPredecessor } from '../qa/v5-owner-review-source-successor.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';
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
    assert.equal(count, Object.keys(defaults(name)).length - (name === 'about' ? 12 : 0), name);
  }
  scope = 'about';
  const legacy = { _key: 'about-father-heading', key: 'about.father.heading', text: 'ข้อความเก่าที่เคยแก้ไว้' };
  assert.ok(render([legacy]).querySelector('[data-label="แก้แล้ว 0"]'));
  const current = { _key: 'about-storyV2-c1-heading', key: 'about.storyV2.c1.heading', text: 'หัวข้อทดสอบ' };
  assert.ok(render([legacy, current]).querySelector('[data-label="แก้แล้ว 1"]'));
  const retired = Object.keys(defaults('about')).filter(key => key.startsWith('about.father.') && key !== 'about.father.photoAlt');
  assert.equal(retired.length, 12);
  for (const key of retired) assert.equal(render([], [{ _key: key.replaceAll('.', '-') }, 'text']).getElementById('copy-' + key.replaceAll('.', '-')), null, key);
  assert.ok(render([], [{ _key: 'about-father-photoAlt' }, 'text']).getElementById('copy-about-father-photoAlt'));
});

test('About words and photo descriptions retain editable copy; verification is opt-in with sibling links', async () => {
  const { JSDOM } = require('jsdom');
  const html = await renderPage('about', { review: true });
  const doc = new JSDOM(html).window.document;
  for (const word of ['เครื่องมือ', 'การลงทุน', 'การเงิน', 'รับผิดชอบ', 'เตรียมตัว', 'วางแผน']) assert.ok([...doc.querySelectorAll('.keep')].some(node => node.textContent.includes(word)), word);
  const cards = [...doc.querySelectorAll('.verifiedCard')];
  assert.equal(cards.length, 4);
  const afpt = loadFixtureModule('components/layout/v5/licence-flip-copy.ts').V5_AFPT_CARD;
  const afptButton = cards[0].querySelector('button');
  assert.equal(afptButton.getAttribute('aria-label'), null, 'Natural accessible name preserves all credential facts');
  for (const fact of [afpt.term, afpt.detail, ...afpt.back.map(line => line.value)]) assert.ok(afptButton.textContent.includes(fact), fact);
  assert.ok([...cards[0].querySelectorAll('.back .line')].every(line => !line.hasAttribute('aria-hidden')));
  assert.deepEqual(cards.map(card => card.querySelector(':scope > a.verifyLink').getAttribute('href')), [
    'https://www.tfpa.or.th/', 'https://oiceservice.oic.or.th/licenseagency/license.php', 'https://market.sec.or.th/LicenseCheck/Search', 'https://oiceservice.oic.or.th/licenseagency/license.php',
  ]);
  for (const card of cards) {
    const link = card.querySelector(':scope > a.verifyLink');
    assert.equal(card.querySelector('button a'), null);
    assert.ok(link.hidden);
    assert.equal(link.target, '_blank');
    assert.match(link.rel, /noopener/);
    assert.match(card.querySelector('.verifyReturn').textContent, /กลับด้านหน้า/);
  }
  assert.equal(doc.querySelectorAll('.verifyHelp').length, 1);
  assert.ok(!doc.querySelector('article[data-owner-story-v2]').textContent.includes('UAT: รอข้อความวิธีตรวจสอบ'));
  const edits = { 'about.storyV2.photoAlt.scbs': 'ภาพทดสอบหนึ่ง', 'about.storyV2.photoAlt.phillip': 'ภาพทดสอบสอง', 'about.storyV2.photoAlt.bitkub': 'ภาพทดสอบสาม' };
  const edited = new JSDOM(await renderPage('about', { review: true, edits: { about: edits } })).window.document;
  for (const [suffix, key] of [['owner-scbs-u-invest.webp', 'scbs'], ['owner-phillip-seminar.webp', 'phillip'], ['owner-bitkub.webp', 'bitkub']]) assert.equal(edited.querySelector(`img[src*="${suffix}"]`).alt, edits[`about.storyV2.photoAlt.${key}`]);
});

test('About eight-key metadata and word markup admit exact reviewed bytes only', () => {
  const source = readFileSync('lib/content/public-copy-locations.json', 'utf8');
  assert.equal(digest(source), '0faebca850664af8aa5feb64eb988c7d78293524b04a129ce8d08c72f8b80631');
  assert.equal(digest(ownerReviewLocationsPredecessor(source)), 'e4420a73bf940ee3b6260e53f90bf034fd64c254f93d2539c71a4b90220f987b');
  const missing = JSON.parse(source); delete missing.about.entries['about.storyV2.verify.back'];
  const otherScope = JSON.parse(source); otherScope.home.entries['home.p'].kind += 'changed';
  for (const mutant of [source + ' ', source.replace('about.storyV2.verify.help', 'about.storyV2.verify.unknown'), JSON.stringify(missing) + '\n', JSON.stringify(otherScope) + '\n', source.replace('{', '{"unknown":{},')]) assert.equal(ownerReviewLocationsPredecessor(mutant), mutant, 'Unknown or partial metadata is never admitted');
  for (const [file, previous] of [['features/about/page.tsx', '82c6d9416b4c3c633e90fc2c463dd4cfdd25ec39e1125a8590165f7c1162e463'], ['features/about/About.module.css', 'dd4c912f5ca4f0f22c1b983f70f1f3e60cd550447c498c3073712db83951ce58']]) {
    const current = readFileSync(file, 'utf8');
    assert.equal(digest(ownerReviewAboutWordsPredecessor(file, current)), previous);
    for (const mutant of [current + ' ', current.replace(/\S/, 'X')]) assert.equal(ownerReviewAboutWordsPredecessor(file, mutant), mutant);
  }
});
