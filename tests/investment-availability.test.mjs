import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const flagSource = source('lib/runtime/investment-availability.ts')
  .replace(/^import "server-only";\n/m, '').replace('export const ', 'const ');
const enabled = (value) => runInNewContext(`${flagSource}\nINVESTMENT_ALLOCATION_ENABLED;`, {
  process: { env: { CCPUN_INVESTMENT_ALLOCATION_ENABLED: value } },
});

function api(name, available, environment = 'production') {
  let imports = 0;
  let calls = 0;
  const service = async () => { calls++; return { source: 'uat_synthetic', mode: 'uat_demo' }; };
  const raw = source(`apps/web/app/api/investment-allocation/${name}/route.ts`);
  assert.doesNotMatch(raw, /^import .*sec-v2/m, "SEC module must load only after availability/validation");
  const text = stripTypeScriptTypes(raw)
    .replace(/^import .*;\n/gm, '')
    .replace(/export /g, '')
    .replace('await import("@/features/investment-allocation/server/sec-v2")', '__loadSEC()');
  const GET = runInNewContext(`${text}\nGET;`, {
    INVESTMENT_ALLOCATION_ENABLED: available, IS_REVIEW_ENVIRONMENT: environment === 'web-uat', process: { env: { CCPUN_APP_ENV: environment } }, Response, Request, URL,
    __loadSEC: () => { imports++; return { listFundAmcs: service, listFundCatalog: service, getFundDetail: service, searchPlanningFunds: service }; },
  });
  return { GET, imports: () => imports, calls: () => calls };
}

test('investment availability is closed by default and only exact owner flag enables it', () => {
  for (const value of [undefined, '', '0', 'true', ' 1', '1 ']) assert.equal(enabled(value), false);
  assert.equal(enabled('1'), true);
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
  const demos = runInNewContext(`${stripTypeScriptTypes(source('features/investment-allocation/server/demo-funds.ts')).replace(/^import .*;\n/gm, '').replace(/export /g, '')}\nUAT_SYNTHETIC_FUNDS;`, { normalizeLiquidity });
  const adapter = source('features/investment-allocation/server/sec-v2.ts');
  const catalog = adapter.slice(adapter.indexOf('function demoCatalogItems'), adapter.indexOf('export async function listFundCatalog'));
  const detail = adapter.slice(adapter.indexOf('export async function getFundDetail'), adapter.indexOf('async function loadLatestRisk'));
  for (const environment of ['production', 'local-production', 'web-uat', 'local-uat']) {
    let calls = 0;
    const getDetail = runInNewContext(`${stripTypeScriptTypes(catalog + detail).replace(/export /g, '')}\ngetFundDetail;`, {
      Date, IS_REVIEW_ENVIRONMENT: true, process: { env: { CCPUN_APP_ENV: environment } }, UAT_SYNTHETIC_FUNDS: demos,
      getSubscriptionKey: () => null,
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

test('actual tools sitemap excludes investment when closed and includes it once when enabled', async () => {
  assert.match(source('apps/web/app/sitemaps/tools.xml/route.ts'), /export \{ GET \} from "@\/lib\/sitemap\/routes\/tools"/);
  const text = source('lib/sitemap/routes/tools.ts').replace(/^import .*;\n/gm, '').replace(/export /g, '');
  for (const available of [false, true]) {
    const GET = runInNewContext(`${text}\nGET;`, {
      INVESTMENT_ALLOCATION_ENABLED: available,
      renderUrlSet: (urls) => urls.map(({ loc }) => `<loc>${loc}</loc>`).join(''),
      xmlResponse: (xml) => new Response(xml),
    });
    const xml = await (GET()).text();
    assert.equal((xml.match(/tools\/investment-allocation/g) || []).length, available ? 1 : 0);
    assert.match(xml, /ci-planning/);
    assert.match(xml, /financial-health-check/);
  }
});

test('page blocks rendering before its JSX; shared server gate supplies both navigation layouts', () => {
  const page = source('features/investment-allocation/page.tsx');
  const guard = page.match(/export default function InvestmentAllocationPage\(\) \{([\s\S]*?)\n  return \(/)?.[1];
  assert.ok(guard, 'page guard must precede JSX');
  assert.throws(() => runInNewContext(guard, { INVESTMENT_ALLOCATION_ENABLED: false, notFound: () => { throw new Error('404'); } }), /404/);
  runInNewContext(guard, { INVESTMENT_ALLOCATION_ENABLED: true, notFound: () => { throw new Error('404'); } });
  const shared = source('components/layout/website-43/Website43Shared.tsx');
  assert.match(shared, /investmentEnabled=\{INVESTMENT_ALLOCATION_ENABLED\}/);
  assert.match(shared, /const toolLinks = \[\.\.\.navigation\.tools, \.\.\.\(INVESTMENT_ALLOCATION_ENABLED \? \[INVESTMENT_TOOL_LINK\] : \[\]\)\]/);
  assert.equal((shared.match(/toolLinks\.map/g) || []).length, 2, 'both footer layouts use the gated list');
  const navbar = source('components/layout/website-43/Website43Navbar.tsx');
  assert.match(navbar, /investmentEnabled = false/);
  assert.match(navbar, /\.\.\.\(investmentEnabled \? \[INVESTMENT_TOOL_LINK\] : \[\]\)/);
  assert.equal((navbar.match(/toolLinks\.map/g) || []).length, 2, 'desktop/mobile use the same ordered menu');
  const menu = navbar.slice(navbar.indexOf('  const toolLinks'), navbar.indexOf('  const pathname'));
  const navigation = JSON.parse(source('lib/nav-config.json'));
  const constants = source('components/layout/website-43/constants.ts').replace(/export /g, '');
  const INVESTMENT_TOOL_LINK = runInNewContext(`${constants}\nINVESTMENT_TOOL_LINK;`);
  for (const available of [false, true]) {
    const links = runInNewContext(`${menu}\ntoolLinks;`, { BASE: '', navigation, INVESTMENT_TOOL_LINK, investmentEnabled: available });
    assert.equal(links.filter(({ href }) => href === '/tools/investment-allocation').length, available ? 1 : 0);
    assert.deepEqual(Array.from(links.slice(0, 3), ({ href }) => href), ['/play/money-story', '/tools/financial-health-check', '/ci-planning']);
  }
  assert.doesNotMatch(source('public/nav-config.json'), /investment-allocation/, 'closed compatibility navigation must not expose unfinished investment');
});
