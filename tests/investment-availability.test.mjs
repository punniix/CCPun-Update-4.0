import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const flagSource = source('features/investment-allocation/server/availability.ts')
  .replace(/^import "server-only";\n/m, '').replace('export const ', 'const ');
const enabled = (value) => runInNewContext(`${flagSource}\nINVESTMENT_ALLOCATION_ENABLED;`, {
  process: { env: { CCPUN_INVESTMENT_ALLOCATION_ENABLED: value } },
});

function api(name, available) {
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
    INVESTMENT_ALLOCATION_ENABLED: available, Response, Request, URL,
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

test('actual tools sitemap excludes investment when closed and includes it once when enabled', async () => {
  const text = source('apps/web/app/sitemaps/tools.xml/route.ts').replace(/^import .*;\n/gm, '').replace(/export /g, '');
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
  assert.equal((shared.match(/INVESTMENT_ALLOCATION_ENABLED \? /g) || []).length, 2, 'both footer layouts must be gated');
  const navbar = source('components/layout/website-43/Website43Navbar.tsx');
  assert.match(navbar, /investmentEnabled = false/);
  assert.match(navbar, /\.\.\.\(investmentEnabled \? \[\{ href: .*investment-allocation/);
  assert.equal((navbar.match(/toolLinks\.map/g) || []).length, 2, 'desktop/mobile use the same ordered menu');
  assert.doesNotMatch(navbar, /play\/money-story/, 'do not expose a route absent from this branch');
  const menu = navbar.slice(navbar.indexOf('  const pathname'), navbar.indexOf('  const [open'));
  for (const available of [false, true]) {
    const links = runInNewContext(`${menu}\ntoolLinks;`, { BASE: '', investmentEnabled: available, usePathname: () => '/' });
    assert.equal(links.filter(({ href }) => href === '/tools/investment-allocation').length, available ? 1 : 0);
    assert.deepEqual(Array.from(links.slice(0, 2), ({ href }) => href), ['/tools/financial-health-check', '/ci-planning']);
  }
});
