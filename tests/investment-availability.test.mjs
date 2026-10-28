import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { resolveContentEnvironment } from '../lib/content/sanity-lane.ts';
import { parseCatalogCursor } from '../features/investment-allocation/server/catalog-cursor.ts';
import { amcAllowedInScope } from '../features/investment-allocation/domain/fund-scope.ts';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const flagSource = stripTypeScriptTypes(source('lib/runtime/investment-availability.ts'))
  .replace(/^import .*;\n/gm, '').replace(/export /g, '');
const enabled = (env) => runInNewContext(`${flagSource}\nINVESTMENT_ALLOCATION_ENABLED;`, {
  process: { env }, resolveContentEnvironment, Set,
});

function api(name, available, environment = 'production', limit = () => null) {
  let imports = 0;
  let calls = 0;
  let limited = 0;
  const service = async () => { calls++; return { source: 'uat_synthetic', mode: 'uat_demo' }; };
  const raw = source(`apps/web/app/api/investment-allocation/${name}/route.ts`);
  assert.doesNotMatch(raw, /^import .*sec-v2/m, "SEC module must load only after availability/rate-limit/validation");
  assert.match(raw, new RegExp(`enforceInvestmentApiRateLimit\\(request, "${name}"\\)`), `${name} must apply its own rate-limit cost`);
  const text = stripTypeScriptTypes(raw)
    .replace(/^import .*;\n/gm, '')
    .replace(/export /g, '')
    .replace('await import("@/features/investment-allocation/server/sec-v2")', '__loadSEC()');
  const GET = runInNewContext(`${text}\nGET;`, {
    INVESTMENT_ALLOCATION_ENABLED: available, IS_REVIEW_ENVIRONMENT: environment === 'web-uat', process: { env: { CCPUN_APP_ENV: environment } }, Response, Request, URL, parseCatalogCursor,
    enforceInvestmentApiRateLimit: (request, route) => { limited++; return limit(request, route); },
    __loadSEC: () => { imports++; return { listFundAmcs: service, listFundCatalog: service, getFundDetail: service, searchPlanningFunds: service }; },
  });
  return { GET, imports: () => imports, calls: () => calls, limited: () => limited };
}

test('owner contract: explicit Web UAT lanes default ON, Production and every other lane default OFF', () => {
  for (const lane of ['web-uat', 'local-uat']) assert.equal(enabled({ CCPUN_APP_ENV: lane }), true, lane);
  for (const env of [
    {}, // no CCPUN_APP_ENV resolves to "development": never inferred as UAT
    { CCPUN_APP_ENV: 'production' },
    { CCPUN_APP_ENV: 'production', CCPUN_UAT_MODE: '1' }, // review flags alone never enable
    { CCPUN_APP_ENV: 'production-admin' }, { CCPUN_APP_ENV: 'admin-uat' }, { CCPUN_APP_ENV: 'local-production' },
    { CCPUN_APP_ENV: 'development' }, { CCPUN_APP_ENV: 'unknown-lane' }, { CCPUN_APP_ENV: ' WEB-UAT-x' },
    { VERCEL_ENV: 'preview' }, { VERCEL_PROJECT_ID: 'prj_x' }, // retired platform values never infer a lane
  ]) assert.equal(enabled(env), false, JSON.stringify(env));
});

test('Production enables only on the exact flag "1"; "0" is a kill switch on every lane', () => {
  for (const value of [undefined, '', 'true', 'yes', ' 1', '1 ', '01', 'on']) {
    assert.equal(enabled({ CCPUN_APP_ENV: 'production', CCPUN_INVESTMENT_ALLOCATION_ENABLED: value }), false, String(value));
  }
  assert.equal(enabled({ CCPUN_APP_ENV: 'production', CCPUN_INVESTMENT_ALLOCATION_ENABLED: '1' }), true);
  for (const lane of ['web-uat', 'local-uat', 'production']) {
    assert.equal(enabled({ CCPUN_APP_ENV: lane, CCPUN_INVESTMENT_ALLOCATION_ENABLED: '0' }), false, lane);
  }
  // Non-exact values on UAT neither disable nor change the default.
  assert.equal(enabled({ CCPUN_APP_ENV: 'web-uat', CCPUN_INVESTMENT_ALLOCATION_ENABLED: 'false' }), true);
});

test('all four disabled APIs return uncached 404 before validation or loading SEC', async () => {
  for (const name of ['amcs', 'catalog', 'detail', 'funds']) {
    const route = api(name, false);
    const response = await route.GET(new Request('https://example.invalid/api?category=invalid&proj_id=invalid'));
    assert.equal(response.status, 404, name);
    assert.equal(response.headers.get('Cache-Control'), 'no-store', name);
    assert.deepEqual(await response.json(), { error: 'not_found' }, name);
    assert.equal(route.imports(), 0, name);
    assert.equal(route.calls(), 0, name);
    assert.equal(route.limited(), 0, `${name}: a closed tool does not consume rate-limit tokens`);
  }
});

test('explicitly enabled APIs retain validation and call only synthetic service stubs', async () => {
  for (const [name, query] of [['amcs', ''], ['catalog', '?q=demo'], ['detail', '?proj_id=M0001_2567'], ['funds', '?q=demo']]) {
    const route = api(name, true);
    assert.equal((await route.GET(new Request(`https://example.invalid/${query}`))).status, 200, name);
    assert.equal(route.imports(), 1, name);
    assert.equal(route.calls(), 1, name);
  }
  for (const [name, query] of [['catalog', '?category=invalid'], ['detail', '?proj_id=invalid'], ['funds', '']]) {
    const route = api(name, true);
    assert.equal((await route.GET(new Request(`https://example.invalid/${query}`))).status, 400, name);
    assert.equal(route.imports(), 0, name);
  }
});

test('rate-limited APIs answer 429 before validation or loading SEC', async () => {
  const refuse = () => Response.json({ error: 'rate_limited' }, { status: 429 });
  for (const [name, query] of [['amcs', ''], ['catalog', '?category=invalid'], ['detail', '?proj_id=invalid'], ['funds', '']]) {
    const route = api(name, true, 'web-uat', refuse);
    const response = await route.GET(new Request(`https://example.invalid/${query}`));
    assert.equal(response.status, 429, name);
    assert.equal(route.limited(), 1, name);
    assert.equal(route.imports(), 0, name);
  }
});

test('catalog accepts only cursors in the shape this server issues', async () => {
  const valid = Buffer.from(JSON.stringify({ statusIndex: 1, secCursor: 'public-next-page', offset: 9, skipProjectId: 'M0001_2567' })).toString('base64url');
  const ok = api('catalog', true, 'web-uat');
  assert.equal((await ok.GET(new Request(`https://example.invalid/?cursor=${valid}`))).status, 200);
  assert.equal(ok.imports(), 1);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  for (const cursor of [
    '', 'not base64!', 'x'.repeat(1025), Buffer.from('not json').toString('base64url'), encode([]), encode(null),
    encode({ statusIndex: 2, secCursor: '', offset: 0, skipProjectId: null }),
    encode({ statusIndex: 0, secCursor: 'has space', offset: 0, skipProjectId: null }),
    encode({ statusIndex: 0, secCursor: 'x'.repeat(513), offset: 0, skipProjectId: null }),
    encode({ statusIndex: 0, secCursor: '', offset: 101, skipProjectId: null }),
    encode({ statusIndex: 0, secCursor: '', offset: 1.5, skipProjectId: null }),
    encode({ statusIndex: 0, secCursor: '', offset: 0, skipProjectId: '../evil' }),
    encode({ statusIndex: 0, secCursor: '', offset: 0, skipProjectId: null, extra: 1 }),
    encode({ statusIndex: 0, secCursor: '', offset: 0 }),
  ]) {
    const route = api('catalog', true, 'web-uat');
    const response = await route.GET(new Request(`https://example.invalid/?cursor=${encodeURIComponent(cursor)}`));
    assert.equal(response.status, 400, cursor.slice(0, 40));
    assert.deepEqual(await response.json(), { error: 'cursor_invalid' });
    assert.equal(route.imports(), 0, 'invalid cursors never reach the SEC adapter or its cache keys');
  }
});

test('synthetic detail IDs are allowed only in explicit Web UAT with availability enabled', async () => {
  for (const environment of ['production', 'production-admin', 'local-production', 'web-uat']) {
    const route = api('detail', true, environment);
    const response = await route.GET(new Request('https://example.invalid/?proj_id=UAT-MIXED-01'));
    assert.equal(response.status, environment === 'web-uat' ? 200 : 400, environment);
    assert.equal(route.imports(), environment === 'web-uat' ? 1 : 0, environment);
  }
});

test('actual synthetic detail mapping preserves fixture facts and cannot call SEC in any lane', async () => {
  const calculation = source('features/investment-allocation/domain/calculation.ts');
  const liquidity = calculation.slice(calculation.indexOf('export function normalizeLiquidity'), calculation.indexOf('export function constructionCoverageMatches'));
  const normalizeLiquidity = runInNewContext(`${stripTypeScriptTypes(liquidity).replace('export ', '')}\nnormalizeLiquidity;`);
  const demoModule = runInNewContext(`${stripTypeScriptTypes(source('features/investment-allocation/server/demo-funds.ts')).replace(/^import .*;\n/gm, '').replace(/export /g, '')}\n({ UAT_SYNTHETIC_FUNDS, syntheticAmcFor });`, { normalizeLiquidity, amcAllowedInScope, Set });
  const demos = demoModule.UAT_SYNTHETIC_FUNDS;
  const adapter = source('features/investment-allocation/server/sec-v2.ts');
  const catalog = adapter.slice(adapter.indexOf('function demoCatalogItems'), adapter.indexOf('export async function listFundCatalog'));
  const detail = adapter.slice(adapter.indexOf('export async function getFundDetail'), adapter.indexOf('async function loadLatestRisk'));
  for (const environment of ['production', 'local-production', 'web-uat', 'local-uat']) {
    let calls = 0;
    const getDetail = runInNewContext(`${stripTypeScriptTypes(catalog + detail).replace(/export /g, '')}\ngetFundDetail;`, {
      Date, IS_REVIEW_ENVIRONMENT: true, process: { env: { CCPUN_APP_ENV: environment } }, UAT_SYNTHETIC_FUNDS: demos,
      getSubscriptionKey: () => null, syntheticAmcFor: demoModule.syntheticAmcFor, amcAllowedInScope,
      settledEnvelope: () => { calls++; throw new Error('SEC must not be called'); },
    });
    const result = await getDetail('UAT-MIXED-01');
    const review = ['web-uat', 'local-uat'].includes(environment);
    assert.equal(result.source, review ? 'uat_synthetic' : 'unavailable');
    assert.equal(calls, 0);
    if (review) {
      assert.equal(result.assetAllocation.reduce((sum, row) => sum + row.percentNav, 0), 100);
      assert.equal(result.risk.level, 5);
      assert.equal(result.selectedClassName, 'UAT-MIX-A');
      assert.equal(result.dealing.settlementPeriod, 'T+2');
      assert.equal(result.snapshotIds[0], demos[0].provenance.snapshotIds[0]);
      assert.match(result.warnings[0], /ไม่ใช่ข้อมูลกองทุนจริง/);
    }
    assert.equal((await getDetail('UAT-NOT-A-FIXTURE')).source, 'unavailable');
  }
});

test('page blocks rendering before its JSX and is noindex unless enabled on a non-review lane', () => {
  const page = source('features/investment-allocation/page.tsx');
  const guard = page.match(/export default async function InvestmentAllocationPage\(\) \{([\s\S]*?)\n  const copy = await getPublicCopy\("investment"\)/)?.[1];
  assert.ok(guard, 'page guard must precede CMS fetching and JSX');
  assert.throws(() => runInNewContext(guard, { INVESTMENT_ALLOCATION_ENABLED: false, notFound: () => { throw new Error('404'); } }), /404/);
  runInNewContext(guard, { INVESTMENT_ALLOCATION_ENABLED: true, notFound: () => { throw new Error('404'); } });
  assert.match(page, /robots: !INVESTMENT_ALLOCATION_ENABLED \|\| IS_REVIEW_ENVIRONMENT \? \{ index: false, follow: false \}/);
  assert.match(page, /const URL = "https:\/\/ccpun\.com\/tools\/investment-allocation\/";/);
  assert.match(page, /"@type": "WebApplication"/);
});

test('this port does not expose the tool through navigation or sitemaps (v5 launch owns discovery)', () => {
  for (const file of ['components/layout/website-43/Website43Navbar.tsx', 'components/layout/website-43/Website43Shared.tsx', 'apps/web/app/sitemaps/tools.xml/route.ts', 'lib/nav-config.json', 'public/nav-config.json']) {
    assert.doesNotMatch(source(file), /investment-allocation/, file);
  }
});
