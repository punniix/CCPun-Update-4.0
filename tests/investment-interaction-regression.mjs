import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = (name) => readFileSync(new URL(`../features/investment-allocation/${name}.tsx`, import.meta.url), 'utf8');
const single = source('SingleFundBuilder');
const portfolio = source('PortfolioBuilder');

function functionSource(text, name) {
  const start = text.indexOf(`  async function ${name}(`);
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
    trackEvent: () => { state.events = (state.events || 0) + 1; },
    document: { getElementById: () => null },
    window: { setTimeout: (callback) => callback(), matchMedia: () => ({ matches: true }) },
    fetch: () => new Promise((resolve) => pending.push(resolve)),
  };
  for (const key of ['Catalog', 'CatalogLoading', 'CatalogAppending', 'SelectedFund', 'Detail', 'DetailLoading', 'SaveStatus', 'PlanId', 'Searching', 'SearchState']) {
    context[`set${key}`] = (value) => { state[key] = typeof value === 'function' ? value(state[key]) : value; };
  }
  const invoke = runInNewContext(`${functionSource(text, name)}\n${name};`, context);
  const respond = (index, data, ok = true) => pending[index]({ ok, status: ok ? 200 : 503, json: async () => data });
  return { state, context, invoke, respond };
}

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
      assert.equal(runInNewContext(`${amountSource}\namount;`, { investmentAmount: input }), 0);
    }
    assert.equal(runInNewContext(`${amountSource}\namount;`, { investmentAmount: '500,000' }), 500000);
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
  const invoke = () => runInNewContext(`${stripTypeScriptTypes(single.slice(start, end))}\nbuildHandoff();`, context);
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
