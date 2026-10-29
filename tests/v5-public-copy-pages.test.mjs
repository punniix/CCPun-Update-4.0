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
  for (const file of ['features/about/page.tsx', 'features/tools-hub/page.tsx', 'components/layout/v5/V5Primitives.tsx', 'components/layout/v5/V5CredentialCards.tsx', 'components/layout/v5/V5LicenceFlip.tsx', 'components/layout/v5/V5ToolParts.tsx', 'components/layout/v5/advisor-profile.ts']) {
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
  test(`${scope} existing default markup is identical to Web847 (review=${review}, investment=${investment})`, async () => {
    const key = `${scope}:${review}:${investment}`;
    assert.equal(digest(await renderPage(scope, { review, investment })), ORIGINAL_847[key]);
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
  const html = await renderPage('about', { fetches }, [{ 'about.father.heading': 'หัวข้อทดสอบ UAT' }, { 'site.footer.about': 'ชื่อหน้าทดสอบ UAT' }, { 'home.eyebrow2': 'ชื่อที่ปรึกษาทดสอบ UAT' }, null]);
  for (const copy of ['หัวข้อทดสอบ UAT', 'ชื่อหน้าทดสอบ UAT', 'ชื่อที่ปรึกษาทดสอบ UAT']) assert.ok(html.includes(copy));
  assert.deepEqual(fetches, []);
  const production = await renderPage('about', { review: false, edits: { about: { 'about.father.heading': 'หัวข้อทดสอบ UAT' } } });
  assert.ok(!production.includes('หัวข้อทดสอบ UAT'));
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
  assert.equal(Object.keys(defaults('about')).length, 15);
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
