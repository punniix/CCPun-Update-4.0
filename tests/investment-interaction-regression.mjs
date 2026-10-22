import { INVESTMENT_COPY_DEFAULTS } from "../lib/content/investment-copy-defaults.ts";
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

function runCopyContext(code, context = {}) { context.copyText ??= key => INVESTMENT_COPY_DEFAULTS[key]; return runInNewContext(code, context); }

const source = (name) => readFileSync(new URL(`../features/investment-allocation/${name}.tsx`, import.meta.url), 'utf8');
const single = source('SingleFundBuilder');
const portfolio = source('PortfolioBuilder');

function functionSource(text, name) {
  const asyncStart = text.indexOf(`  async function ${name}(`);
  const start = asyncStart >= 0 ? asyncStart : text.indexOf(`  function ${name}(`);
  const end = text.indexOf('\n  }\n', start) + 4;
  assert.ok(start >= 0 && end > start, name);
  return stripTypeScriptTypes(text.slice(start, end));
}

function runtime(text, name) {
  const state = {};
  const pending = [];
  const context = {
    URLSearchParams, Date, Boolean,
    catalogRequest: { current: 0 }, detailRequest: { current: 0 },
    searchRequest: { current: 0 }, detailRequests: { current: new Map() }, selectedIds: { current: new Set() },
    trackEvent: () => { state.events = (state.events || 0) + 1; },
    document: { getElementById: () => null },
    window: { setTimeout: (callback) => callback(), matchMedia: () => ({ matches: true }) },
    fetch: () => new Promise((resolve) => pending.push(resolve)),
  };
  for (const key of ['Catalog', 'CatalogLoading', 'CatalogAppending', 'SelectedFund', 'Detail', 'DetailLoading', 'SaveStatus', 'PlanId', 'Searching', 'SearchState', 'SelectedFunds', 'SelectedDetails']) {
    context[`set${key}`] = (value) => { state[key] = typeof value === 'function' ? value(state[key]) : value; };
  }
  const invoke = runCopyContext(`${functionSource(text, name)}\n${name};`, context);
  const respond = (index, data, ok = true) => pending[index]({ ok, status: ok ? 200 : 503, json: async () => data });
  return { state, context, invoke, respond };
}

test('single starts once on its first category progression and sends only categorical context', () => {
  const events = [];
  const catalogLoads = [];
  const context = {
    startedRef: { current: false }, query: 'private search',
    trackEvent: (name, params) => events.push({ name, params }),
    loadAmcs: () => {}, loadCatalog: (filters) => catalogLoads.push(filters),
  };
  for (const key of ['Category', 'Subcategory', 'AmcId', 'SelectedFund', 'Detail', 'SaveStatus']) {
    context[`set${key}`] = () => {};
  }
  const chooseCategory = runCopyContext(`${functionSource(single, 'chooseCategory')}\nchooseCategory;`, context);
  assert.equal(events.length, 0, 'rendering the handler cannot count as a start');
  for (const category of ['equity', 'mixed', 'all']) chooseCategory(category);
  assert.equal(events[0].name, 'ia_tool_start', 'start precedes the first step');
  const starts = events.filter(({ name }) => name === 'ia_tool_start');
  assert.equal(starts.length, 1, 'changing category must not start another tool session');
  assert.deepEqual(JSON.parse(JSON.stringify(starts[0].params)), {
    tool_name: 'investment_allocation', cta_location: 'investment_allocation_builder', surface_group: 'investment_allocation',
  });
  assert.equal(events.filter(({ name }) => name === 'ia_step_view').length, 3);
  assert.equal(catalogLoads.length, 3, 'tracking must preserve catalog progression');
  assert.equal(JSON.stringify(events).includes('private search'), false);
});

test('catalog keeps the latest filter and ignores older response/finally', async () => {
  const run = runtime(single, 'loadCatalog');
  const filters = { category: 'equity', subcategory: 'all', query: '', amcId: 'all' };
  const old = run.invoke(filters);
  const latest = run.invoke({ ...filters, category: 'mixed' });
  run.respond(0, { items: [{ projectId: 'old' }] });
  await old;
  assert.equal(run.state.Catalog, null);
  assert.equal(run.state.CatalogLoading, true);
  run.respond(1, { items: [{ projectId: 'latest' }] });
  await latest;
  assert.equal(run.state.Catalog.items[0].projectId, 'latest');
  assert.equal(run.state.CatalogLoading, false);
});

test('append preserves the selection but a new filter invalidates pending fund detail', async () => {
  const run = runtime(single, 'loadCatalog');
  run.state.SelectedFund = { projectId: 'selected' };
  run.state.Catalog = { items: [{ projectId: 'first' }] };
  const filters = { category: 'all', subcategory: 'all', query: '', amcId: 'all' };
  const append = run.invoke({ ...filters, append: true, cursor: 'next' });
  assert.equal(run.context.detailRequest.current, 0);
  run.respond(0, { items: [{ projectId: 'second' }] });
  await append;
  assert.equal(run.state.SelectedFund.projectId, 'selected');
  assert.equal(run.state.Catalog.items.length, 2);
  const changed = run.invoke(filters);
  assert.equal(run.context.detailRequest.current, 1);
  assert.equal(run.state.SelectedFund, null);
  run.respond(1, { items: [] });
  await changed;
});

test('fund detail keeps the latest fund/class and emits no event for a stale result', async () => {
  const run = runtime(single, 'fetchDetail');
  const old = run.invoke({ projectId: 'old' });
  const latest = run.invoke({ projectId: 'new' }, 'class-A');
  run.respond(1, { fund: { projectId: 'new' }, selectedClassName: 'class-A' });
  await latest;
  run.respond(0, { fund: { projectId: 'old' } });
  await old;
  assert.equal(run.state.Detail.fund.projectId, 'new');
  assert.equal(run.state.SelectedFund.projectId, 'new');
  assert.equal(run.state.Detail.selectedClassName, 'class-A');
  assert.equal(run.state.events, 1);
  assert.equal(run.state.DetailLoading, false);
});

test('both builders normalize invalid amounts to zero before calculation or handoff', () => {
  for (const text of [single, portfolio]) {
    const amountSource = text.match(/  const parsedAmount = .*\n  const amount = .*;/)?.[0];
    assert.ok(amountSource);
    for (const input of ['', '-10', 'Infinity', 'NaN', '1e309']) {
      assert.equal(runCopyContext(`${amountSource}\namount;`, { investmentAmount: input }), 0);
    }
    assert.equal(runCopyContext(`${amountSource}\namount;`, { investmentAmount: '500,000' }), 500000);
  }
  assert.equal((single.match(/disabled=\{handoffDisabled\}/g) || []).length, 2);
});

test('single handoff rejects invalid amount, missing identity/class and preserves source identity', () => {
  const start = single.indexOf('  function buildHandoff()');
  const end = single.indexOf('\n  }\n', start) + 4;
  const context = {
    selectedFund: { projectId: 'UAT-MIXED-01', nameTh: 'UAT demo', abbreviation: 'UAT' }, amount: 500000,
    detail: { fund: { projectId: 'UAT-MIXED-01' }, source: 'uat_synthetic', state: 'demo', classes: [{ name: 'A' }], selectedClassName: 'A', assetAllocation: [], dealing: null, dataDate: '2026-09-01', fetchedAt: '2026-10-11', endpointStates: { risk: 'empty' }, snapshotIds: ['demo-source'], warnings: ['synthetic'] },
    ensurePlanId: () => 'test-plan',
  };
  const invoke = () => runCopyContext(`${stripTypeScriptTypes(single.slice(start, end))}\nbuildHandoff();`, context);
  const payload = invoke();
  assert.equal(payload.provenance.source, 'uat_synthetic');
  assert.equal(payload.provenance.fetched_at, '2026-10-11');
  assert.equal(payload.provenance.snapshot_ids[0], 'demo-source');
  context.amount = 0;
  assert.equal(invoke(), null);
  context.amount = 500000;
  context.detail.selectedClassName = null;
  assert.equal(invoke(), null);
  context.detail.selectedClassName = 'A';
  context.detail.fund.projectId = 'different';
  assert.equal(invoke(), null);
});

test('portfolio HTTP errors become an unavailable result instead of parsed error data', async () => {
  const run = runtime(portfolio, 'searchFunds');
  run.context.query = 'UAT';
  const request = run.invoke({ preventDefault() {} });
  run.respond(0, { error: 'not_found' }, false);
  await request;
  assert.equal(run.state.SearchState.state, 'unavailable');
  assert.equal(run.state.SearchState.funds.length, 0);
  assert.equal(run.state.Searching, false);
});

test('portfolio search ignores old results and old finally while the later search is loading', async () => {
  const run = runtime(portfolio, 'searchFunds');
  run.context.query = 'old';
  const old = run.invoke({ preventDefault() {} });
  run.context.query = 'latest';
  const latest = run.invoke({ preventDefault() {} });
  run.respond(0, { funds: [{ id: 'old' }] });
  await old;
  assert.equal(run.state.SearchState, null);
  assert.equal(run.state.Searching, true);
  run.respond(1, { funds: [{ id: 'latest' }] });
  await latest;
  assert.equal(run.state.SearchState.funds[0].id, 'latest');
  assert.equal(run.state.Searching, false);
});

function portfolioDetailRuntime() {
  const state = { SelectedFunds: [{ fund: { id: 'a', projectId: 'A' }, weightPercent: 60 }, { fund: { id: 'b', projectId: 'B' }, weightPercent: 40 }], SelectedDetails: {} };
  const pending = [];
  const requests = [];
  const context = {
    URLSearchParams, Map, Set,
    detailRequests: { current: new Map() }, selectedIds: { current: new Set(['a', 'b']) },
    setSaveStatus: () => {},
    setSelectedDetails: (update) => { state.SelectedDetails = update(state.SelectedDetails); },
    setSelectedFunds: (update) => { state.SelectedFunds = update(state.SelectedFunds); },
    planningFundFromDetail: (fund, detail, selectedClass) => {
      if (detail.fund.projectId !== fund.projectId || (selectedClass && detail.selectedClassName !== selectedClass)) throw Error('identity');
      return { ...fund, className: selectedClass, riskSpectrum: detail.risk }; // Mapper has separate actual-module tests.
    },
    fetch: (url) => { requests.push(url); return new Promise(resolve => pending.push(resolve)); },
  };
  const load = runCopyContext(`${functionSource(portfolio, 'loadSelectedDetail')}\nloadSelectedDetail;`, context);
  const remove = runCopyContext(`${functionSource(portfolio, 'removeFund')}\nremoveFund;`, context);
  const respond = (index, projectId, selectedClassName, ok = true) => pending[index]({ ok, status: ok ? 200 : 503, json: async () => ({ fund: { projectId }, selectedClassName, risk: index + 1 }) });
  return { state, context, requests, load, remove, respond };
}

test('portfolio independent project and class requests preserve weights and reject stale class responses', async () => {
  const run = portfolioDetailRuntime();
  const old = run.load({ id: 'a', projectId: 'A' }, 'class-old');
  const other = run.load({ id: 'b', projectId: 'B' }, 'class-B');
  const latest = run.load({ id: 'a', projectId: 'A' }, 'class-new');
  assert.match(run.requests[2], /class_name=class-new/);
  run.respond(1, 'B', 'class-B'); await other;
  run.respond(2, 'A', 'class-new'); await latest;
  run.respond(0, 'A', 'class-old'); await old;
  assert.deepEqual(run.state.SelectedFunds.map(row => row.weightPercent), [60, 40]);
  assert.equal(run.state.SelectedFunds[0].fund.className, 'class-new');
  assert.equal(run.state.SelectedFunds[1].fund.className, 'class-B');
  assert.equal(run.state.SelectedDetails.a.requestedClass, 'class-new');
});

test('removal invalidates pending detail and failures or identity mismatch cannot create selected facts', async () => {
  const run = portfolioDetailRuntime();
  const removed = run.load({ id: 'a', projectId: 'A' }, null);
  run.remove('a'); run.respond(0, 'A', null); await removed;
  assert.equal(run.state.SelectedFunds.length, 1);
  assert.equal(run.state.SelectedDetails.a, undefined);
  const mismatch = run.load({ id: 'b', projectId: 'B' }, 'class-B');
  run.respond(1, 'OTHER', 'class-B'); await mismatch;
  assert.equal(run.state.SelectedDetails.b.state, 'unavailable');
  assert.equal(run.state.SelectedFunds[0].fund.className, undefined);
  const failed = run.load({ id: 'b', projectId: 'B' }, 'class-B');
  run.respond(2, 'B', 'class-B', false); await failed;
  assert.equal(run.state.SelectedDetails.b.state, 'unavailable');
  assert.equal(run.state.SelectedFunds[0].fund.riskSpectrum, undefined);
});

test('single display removes only identical repeated specification labels, retaining exact distinct labels in source order', () => {
  const expression = single.match(/\{(\[\.\.\.new Set\(detail\.specifications\.map\(\(spec\) => spec\.description\)\)\])\.map/)?.[1];
  assert.ok(expression);
  const descriptions = ['Same', 'Distinct', 'Same', 'Same '];
  const detail = { specifications: descriptions.map((description, index) => ({ description, code: index, className: 'A' })) };
  assert.deepEqual(Array.from(runCopyContext(expression, { detail, Set })), ['Same', 'Distinct', 'Same ']);
  assert.equal(detail.specifications.length, 4, 'source facts and provenance are not deduplicated');
});


test('rapid add is unique and remove/re-add invalidates an earlier detail for the same project', async () => {
  const run = portfolioDetailRuntime();
  run.state.SelectedFunds = [];
  run.context.selectedIds.current.clear();
  run.context.loadSelectedDetail = run.load;
  const add = runCopyContext(`${functionSource(portfolio, 'addFund')}\naddFund;`, run.context);
  const fund = { id: 'a', projectId: 'A', constructionBucket: 'equity' };
  add(fund); add(fund);
  assert.equal(run.state.SelectedFunds.length, 1);
  assert.equal(run.requests.length, 1, 'rapid duplicate clicks create one request');
  run.remove('a'); add(fund);
  assert.equal(run.requests.length, 2);
  run.respond(1, 'A', null);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.state.SelectedDetails.a.state, 'ready');
  assert.equal(run.state.SelectedFunds[0].fund.riskSpectrum, 2);
  run.respond(0, 'A', null);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.state.SelectedFunds.length, 1);
  assert.equal(run.state.SelectedFunds[0].fund.riskSpectrum, 2, 'removed instance cannot replace re-added facts');
});
