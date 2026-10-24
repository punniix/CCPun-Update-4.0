#!/usr/bin/env node
// Live smoke test for the Investment Allocation tool on a deployed environment.
//
// Calls the public /api/investment-allocation/* routes (read-only GETs) and checks
// that each of the six SEC Open API v2 endpoints behind them answers live data:
//   general-info/amcs                      -> /amcs
//   general-info/profiles                  -> /catalog, /funds, /detail.profile
//   general-info/specifications            -> /detail.specification
//   factsheet/risk-spectrum                -> /detail.risk (and /funds risk levels)
//   factsheet/asset-allocation             -> /detail.allocation
//   factsheet/subscription-redemption-periods -> /detail.dealing
// The SEC key stays on the server; this script never needs or sends it.
//
// Usage:
//   node qa/investment-allocation-live.mjs [--base-url https://test.ccpun.com] [--json]
//        [--check-rate-limit] [--allow-production]
// Env: IA_LIVE_BASE_URL overrides the default base URL.
// Exit code: 0 when no check failed, 1 when any check failed, 2 on a refused target.
// A skipped check is reported separately and is never counted as a pass.

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };

const BASE_URL = new URL(option('--base-url') ?? process.env.IA_LIVE_BASE_URL ?? 'https://test.ccpun.com');
const JSON_OUTPUT = flag('--json');
const TIMEOUT_MS = Number(option('--timeout-ms') ?? 30_000);
const PROJECT_ID = /^M\d{4}_\d{4}$/;
const SEC_DETAIL_ENDPOINTS = [
  ['profile', 'general-info/profiles'],
  ['specification', 'general-info/specifications'],
  ['risk', 'factsheet/risk-spectrum'],
  ['allocation', 'factsheet/asset-allocation'],
  ['dealing', 'factsheet/subscription-redemption-periods'],
];

function targetAllowed(url) {
  const host = url.hostname.toLowerCase();
  if (host === 'ccpun.com' || host === 'www.ccpun.com') return flag('--allow-production') ? 'production' : null;
  if (host === 'test.ccpun.com' || host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') return 'review';
  return flag('--allow-any-host') ? 'other' : null;
}

const results = [];
const record = (status, name, detail = '') => { results.push({ status, name, detail }); };
const pass = (name, detail) => record('pass', name, detail);
const fail = (name, detail) => record('fail', name, detail);
const skip = (name, detail) => record('skip', name, detail);

async function get(path) {
  const url = new URL(path, BASE_URL);
  const started = Date.now();
  const response = await fetch(url, { headers: { Accept: 'application/json, text/html' }, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* HTML or invalid JSON */ }
  return { status: response.status, headers: response.headers, text, body, ms: Date.now() - started };
}

async function check(name, run) {
  try {
    const outcome = await run();
    if (outcome?.skip) skip(name, outcome.skip);
    else pass(name, outcome?.detail ?? '');
  } catch (error) {
    fail(name, error instanceof Error ? error.message : String(error));
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function expectLiveJson(result, label) {
  expect(result.status === 200, `${label}: HTTP ${result.status}`);
  expect(result.body && typeof result.body === 'object', `${label}: response is not JSON`);
  expect(!/Ocp-Apim-Subscription-Key|SEC_API_(PRIMARY|SECONDARY)_KEY/i.test(result.text), `${label}: response mentions SEC credentials`);
}

async function main() {
  const lane = targetAllowed(BASE_URL);
  if (!lane) {
    console.error(`Refusing target ${BASE_URL.origin}. Use test.ccpun.com or localhost, or pass --allow-production / --allow-any-host explicitly.`);
    process.exit(2);
  }

  const state = { equity: null, fund: null };

  await check('page /tools/investment-allocation/ renders', async () => {
    const page = await get('/tools/investment-allocation/');
    expect(page.status === 200, `HTTP ${page.status} (404 means the availability flag is off on this lane)`);
    expect(/<html/i.test(page.text), 'not an HTML document');
    if (lane === 'review') {
      const robots = `${page.headers.get('x-robots-tag') ?? ''} ${page.text.match(/<meta[^>]+name="robots"[^>]*>/i)?.[0] ?? ''}`;
      expect(/noindex/i.test(robots), 'review lane must be noindex');
    }
    return { detail: `${page.ms} ms` };
  });

  await check('SEC general-info/amcs via /api/investment-allocation/amcs', async () => {
    const result = await get('/api/investment-allocation/amcs');
    expectLiveJson(result, 'amcs');
    expect(result.body.source === 'sec_v2', `source=${result.body.source} state=${result.body.state} (expected live sec_v2; uat_synthetic means no SEC key, unavailable means SEC failed)`);
    expect(Array.isArray(result.body.items) && result.body.items.length > 0, 'no AMCs returned');
    for (const item of result.body.items) expect(typeof item.id === 'string' && typeof item.nameTh === 'string', 'AMC item shape');
    return { detail: `${result.body.items.length} AMCs, ${result.ms} ms` };
  });

  await check('SEC general-info/profiles via /api/investment-allocation/catalog (equity, paged)', async () => {
    const first = await get('/api/investment-allocation/catalog?category=equity&limit=8');
    expectLiveJson(first, 'catalog');
    expect(first.body.source === 'sec_v2', `source=${first.body.source} state=${first.body.state}`);
    expect(first.body.items.length > 0, 'no equity funds returned');
    for (const item of first.body.items) {
      expect(PROJECT_ID.test(item.projectId), `projectId ${item.projectId}`);
      expect(item.category === 'equity', `category ${item.category} for ${item.projectId}`);
      expect(item.fundStatus === 'Registered' || item.fundStatus === 'IPO', `status ${item.fundStatus}`);
    }
    state.equity = first.body.items;
    if (!first.body.nextCursor) return { detail: `${first.body.items.length} funds, single page` };
    const next = await get(`/api/investment-allocation/catalog?category=equity&limit=8&cursor=${encodeURIComponent(first.body.nextCursor)}`);
    expectLiveJson(next, 'catalog page 2');
    const ids = new Set(first.body.items.map((item) => item.projectId));
    expect(next.body.items.every((item) => !ids.has(item.projectId)), 'page 2 repeats page 1');
    return { detail: `${first.body.items.length}+${next.body.items.length} funds, ${first.ms}+${next.ms} ms` };
  });

  await check('catalog geography filter (equity/domestic) honours invest_country_flag', async () => {
    const result = await get('/api/investment-allocation/catalog?category=equity&subcategory=domestic&limit=8');
    expectLiveJson(result, 'catalog domestic');
    expect(result.body.source === 'sec_v2', `source=${result.body.source}`);
    expect(result.body.items.every((item) => item.investCountryFlag === '3'), 'a non-domestic fund leaked through');
    return { detail: `${result.body.items.length} funds` };
  });

  await check('catalog Thai search text', async () => {
    const result = await get(`/api/investment-allocation/catalog?q=${encodeURIComponent('หุ้น')}&limit=8`);
    expectLiveJson(result, 'catalog Thai search');
    expect(result.body.source === 'sec_v2' && result.body.query === 'หุ้น', `source=${result.body.source} query=${result.body.query}`);
    return { detail: `${result.body.items.length} funds` };
  });

  const detailNames = SEC_DETAIL_ENDPOINTS.map(([key, endpoint]) => `SEC ${endpoint} via /detail (${key})`);
  if (!state.equity?.length) {
    for (const name of detailNames) skip(name, 'no fund from the catalog check to look up');
  } else {
    let detail = null;
    let lookupError = null;
    try {
      state.fund = state.equity[0];
      detail = await get(`/api/investment-allocation/detail?proj_id=${encodeURIComponent(state.fund.projectId)}`);
      expectLiveJson(detail, 'detail');
      expect(detail.body.source === 'sec_v2', `source=${detail.body.source}`);
      expect(detail.body.fund?.projectId === state.fund.projectId, 'detail returned a different project');
    } catch (error) { lookupError = error instanceof Error ? error.message : String(error); }
    for (const [index, [key]] of SEC_DETAIL_ENDPOINTS.entries()) {
      await check(detailNames[index], async () => {
        if (lookupError) throw new Error(lookupError);
        const endpointState = detail.body.endpointStates?.[key];
        expect(endpointState === 'ok' || endpointState === 'empty', `endpoint state ${endpointState}`);
        if (key === 'risk' && detail.body.risk) expect(detail.body.risk.level === null || (detail.body.risk.level >= 1 && detail.body.risk.level <= 8), `risk level ${detail.body.risk.level}`);
        if (key === 'allocation') for (const row of detail.body.assetAllocation) expect(typeof row.name === 'string' && Number.isFinite(row.percentNav), 'allocation row shape');
        return { detail: `${state.fund.projectId}: ${endpointState}` };
      });
    }
  }

  await check('detail class selection returns class-specific dealing terms', async () => {
    if (!state.fund) return { skip: 'no fund available' };
    const base = await get(`/api/investment-allocation/detail?proj_id=${encodeURIComponent(state.fund.projectId)}`);
    expectLiveJson(base, 'detail');
    const classes = base.body.classes ?? [];
    if (classes.length < 2) return { skip: `${state.fund.projectId} has ${classes.length} class(es); multi-class path not exercised` };
    const chosen = classes[0].name;
    const result = await get(`/api/investment-allocation/detail?proj_id=${encodeURIComponent(state.fund.projectId)}&class_name=${encodeURIComponent(chosen)}`);
    expectLiveJson(result, 'detail with class');
    expect(result.body.selectedClassName === chosen, `selected ${result.body.selectedClassName}`);
    expect(result.body.dealing === null || result.body.dealing.className === chosen, 'dealing borrowed from another class');
    return { detail: `${state.fund.projectId}/${chosen}` };
  });

  await check('SEC profiles + risk-spectrum via /api/investment-allocation/funds', async () => {
    const query = state.fund?.abbreviation ?? 'SET';
    const result = await get(`/api/investment-allocation/funds?q=${encodeURIComponent(query)}`);
    expectLiveJson(result, 'funds');
    expect(result.body.mode === 'sec_live', `mode=${result.body.mode}`);
    expect(result.body.state !== 'unavailable' || result.body.funds.length === 0, 'inconsistent unavailable state');
    expect(result.body.funds.length > 0, `no funds for "${query}"`);
    for (const fund of result.body.funds) {
      expect(PROJECT_ID.test(fund.projectId), `projectId ${fund.projectId}`);
      expect(fund.riskSpectrum === null || (fund.riskSpectrum >= 1 && fund.riskSpectrum <= 8), `risk ${fund.riskSpectrum}`);
    }
    return { detail: `${result.body.funds.length} funds for "${query}"` };
  });

  await check('invalid input is rejected with uncached 400s', async () => {
    for (const path of ['/api/investment-allocation/detail?proj_id=invalid', '/api/investment-allocation/catalog?category=invalid', '/api/investment-allocation/funds']) {
      const result = await get(path);
      expect(result.status === 400, `${path}: HTTP ${result.status}`);
      expect((result.headers.get('cache-control') ?? '').includes('no-store'), `${path}: cacheable error`);
    }
  });

  await check('rate limit answers 429 with Retry-After', async () => {
    if (!flag('--check-rate-limit')) return { skip: 'pass --check-rate-limit to spend ~12 detail calls of SEC quota' };
    if (!state.fund) return { skip: 'no fund available' };
    for (let i = 0; i < 15; i += 1) {
      const result = await get(`/api/investment-allocation/detail?proj_id=${encodeURIComponent(state.fund.projectId)}`);
      if (result.status === 429) {
        expect(Number(result.headers.get('retry-after')) >= 1, 'missing Retry-After');
        expect(result.body?.error === 'rate_limited', '429 body');
        return { detail: `limited after ${i} extra calls` };
      }
    }
    throw new Error('no 429 after 15 detail calls (limit is 30 tokens / cost 3)');
  });

  const counts = { pass: 0, fail: 0, skip: 0 };
  for (const result of results) counts[result.status] += 1;
  if (JSON_OUTPUT) {
    console.log(JSON.stringify({ baseUrl: BASE_URL.origin, counts, results }, null, 2));
  } else {
    for (const result of results) console.log(`${result.status.toUpperCase().padEnd(4)} ${result.name}${result.detail ? ` — ${result.detail}` : ''}`);
    console.log(`\n${BASE_URL.origin}: ${counts.pass} passed, ${counts.fail} failed, ${counts.skip} skipped (skips are not passes)`);
  }
  process.exitCode = counts.fail > 0 ? 1 : 0;
}

await main();
