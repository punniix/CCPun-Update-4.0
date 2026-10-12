import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';
import { assertPhase2AdminComposition } from '../qa/phase2-admin-modularity-proof.mjs';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const proof = JSON.parse(readFileSync(new URL('../qa/phase2-admin-modularity.json', import.meta.url), 'utf8'));
const [dashboard, workspace, visuals, model] = proof.entries;
const [overview, workspaceModel, metrics] = proof.owners;
const digest = value => createHash('sha256').update(value).digest('hex');
const read = file => readFileSync(file, 'utf8');
const baseline = new Map(Object.entries(proof.baselineSources));
const fixedNow = Date.parse('2026-10-12T00:00:00Z');
class FixtureDate extends Date {
  constructor(...args) { super(...(args.length ? args : [fixedNow])); }
  static now() { return fixedNow; }
}
function declarations(source, file = 'fixture.tsx') {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return new Map(tree.statements.filter(node => node.name).map(node => [node.name.text, node]));
}
function expose(file, names, sources) {
  const source = sources.get(file) ?? read(file);
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const available = new Set(tree.statements.filter(node => node.name && !node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)).map(node => node.name.text));
  return new Map([...sources, [file, source + '\nexport { ' + names.filter(name => available.has(name)).join(', ') + ' };\n']]);
}
const noop = () => {};
const mocks = () => new Map([
  ['@/features/admin/social/InstagramMobileHandoff', { InstagramMobileHandoff: props => React.createElement('span', { 'data-handoff': JSON.stringify(props) }) }],
]);
function load(file, old = false, names = [], extraMocks = new Map()) {
  const sources = names.length ? expose(file, names, old ? baseline : new Map()) : old ? baseline : new Map();
  return loadFixtureModule(file, { sources, mocks: new Map([...mocks(), ...extraMocks]), globals: { Date: FixtureDate, process: { env: {} } } });
}
function observe(fn, args) {
  const frozenArgs = structuredClone(args);
  try { const value = fn(...frozenArgs); return { value, args: frozenArgs }; }
  catch (error) { return { error: { name: error.name, message: error.message }, args: frozenArgs }; }
}

test('bounded seals reject entry/owner tampering and preserve all original function bodies', () => {
  for (const [file, hash] of Object.entries(proof.baselineHashes)) assert.equal(digest(proof.baselineSources[file]), hash, file);
  for (const [file, hash] of Object.entries(proof.currentHashes)) {
    assert.equal(digest(read(file)), hash, file);
    assert.notEqual(digest(read(file) + '\n// tamper'), hash, file);
  }
  const currentDeclarations = new Map();
  for (const file of [...proof.entries, ...proof.owners]) for (const [name, node] of declarations(read(file))) {
    if (node.body) currentDeclarations.set(name, node.body.getText());
  }
  for (const file of proof.entries) for (const [name, node] of declarations(proof.baselineSources[file])) {
    if (node.body) assert.equal(currentDeclarations.get(name), node.body.getText(), name);
  }
  for (const file of proof.owners) {
    const source = read(file);
    assert.doesNotMatch(source, /\bfetch\s*\(|process\.env|\.query\s*\(|createClient\s*\(/);
  }
  assert.match(read(workspace), /const controller = new AbortController\(\)[\s\S]*return \(\) => controller.abort\(\)/);
  assert.match(read(workspace), /async function saveDraft[\s\S]*async function approveRevision[\s\S]*async function executePublication/);
});

test('current composition admission fails closed for altered entry/owner/body/baseline/scope/output assertions', () => {
  const expected = proof.baselineHashes[dashboard];
  const check = (data = proof, replacements = new Map(), file = dashboard) => assertPhase2AdminComposition(file, expected, { proof: data, read: path => replacements.get(path) ?? read(path) });
  assert.equal(check(), true);
  for (const file of [dashboard, overview, workspaceModel, metrics]) assert.throws(() => check(proof, new Map([[file, read(file) + '\n// changed current source']])));
  const wrongBaseline = structuredClone(proof); wrongBaseline.baseline = 'a'.repeat(40);
  assert.throws(() => check(wrongBaseline));
  const extraScope = structuredClone(proof); extraScope.entries.push('lib/admin/social/execution-store.ts');
  assert.throws(() => check(extraScope));
  assert.throws(() => check(proof, new Map(), 'lib/admin/social/execution-store.ts'));
  const alteredBody = read(metrics).replace('if (!values.length) return null;', 'if (!values.length) return 99;');
  const bodyProof = structuredClone(proof); bodyProof.currentHashes[metrics] = digest(alteredBody);
  assert.throws(() => check(bodyProof, new Map([[metrics, alteredBody]])), /original signature\/body/);
  const duplicate = read(metrics) + '\nfunction median(values: number[]) { return values.length; }\n';
  const duplicateProof = structuredClone(proof); duplicateProof.currentHashes[metrics] = digest(duplicate);
  assert.throws(() => check(duplicateProof, new Map([[metrics, duplicate]])), /conflicting duplicate declaration/);
  const sideEffect = read(workspaceModel) + '\nglobalThis.__fixtureSideEffect = true;\n';
  const sideEffectProof = structuredClone(proof); sideEffectProof.currentHashes[workspaceModel] = digest(sideEffect);
  assert.throws(() => check(sideEffectProof, new Map([[workspaceModel, sideEffect]])), /no new module side effects/);
  for (const addedImport of ["import '@/lib/admin/social/execution-store';", "import { executeSocialPublication } from '@/lib/admin/social/execution-store';", "import 'react';"]) {
    const injected = read(overview) + '\n' + addedImport + '\n';
    const injectedProof = structuredClone(proof); injectedProof.currentHashes[overview] = digest(injected);
    assert.throws(() => check(injectedProof, new Map([[overview, injected]])), /exact reviewed import contract/);
  }
  for (const change of [source => source.replace('{ useMemo }', '{ useMemo as otherMemo }'), source => source.replace('{ useMemo }', '{ type useMemo }')]) {
    const injected = change(read(overview));
    const injectedProof = structuredClone(proof); injectedProof.currentHashes[overview] = digest(injected);
    assert.throws(() => check(injectedProof, new Map([[overview, injected]])), /exact reviewed import contract/);
  }
  const detached = read(dashboard).replace('import { OverviewTab } from "./MarketingDashboardOverview";', '');
  const detachedProof = structuredClone(proof); detachedProof.currentHashes[dashboard] = digest(detached);
  assert.throws(() => check(detachedProof, new Map([[dashboard, detached]])), /actual runtime owner reachability/);
  const assertions = read(proof.outputEvidence.file).replace('assert.equal(current.buildMarketingCsv(posts), old.buildMarketingCsv(posts));', '');
  assert.throws(() => check(proof, new Map([[proof.outputEvidence.file, assertions]])), /registered output assertions/);
});

test('real marketing model preserves exported results, CSV order, empty/null/error inputs and mutations', () => {
  const old = load(model, true);
  const current = load(model);
  assert.deepEqual(Object.keys(current).sort(), Object.keys(old).sort());
  const cases = [[], [proof.syntheticPost], Array.from({ length: 8 }, (_, index) => ({ ...proof.syntheticPost, contentId: String(index), platform: index % 2 ? 'instagram' : 'facebook', views: index ? index * 40 : null, reach: index % 2 ? index * 20 : null, saves: index % 2 ? index : null, metricCoverageRate: index / 8, analysisStatus: index % 3 ? 'ready' : 'partial', publishHourBkk: index * 3 }))];
  for (const posts of cases) {
    for (const goal of ['awareness', 'intent', 'deep']) {
      for (const platform of ['facebook', 'instagram']) {
        for (const name of ['buildWinners', 'buildWeeklySeries', 'buildTimeSlots']) assert.deepEqual(observe(current[name], [posts, goal, platform]), observe(old[name], [posts, goal, platform]), name);
      }
      for (const name of ['buildInsights', 'buildFormatBenchmarks', 'executiveSummary']) assert.deepEqual(observe(current[name], [posts, goal, 'fixture-period']), observe(old[name], [posts, goal, 'fixture-period']), name);
      for (const post of posts) assert.deepEqual(current.goalMetric(post, goal), old.goalMetric(post, goal));
    }
    for (const metric of old.METRIC_DEFINITIONS) {
      assert.deepEqual(observe(current.metricSummary, [posts, metric.id]), observe(old.metricSummary, [posts, metric.id]));
      for (const post of posts) assert.equal(current.metricValue(post, metric.id), old.metricValue(post, metric.id));
    }
    assert.equal(current.buildMarketingCsv(posts), old.buildMarketingCsv(posts));
    for (const period of ['30d', '90d', '180d', 'year', 'all']) for (const quality of ['all', 'ready', 'needs_review', 'partial']) assert.deepEqual(current.filterMarketingPosts(posts, { period, quality, platform: 'all', format: 'all', search: '' }, new FixtureDate()), old.filterMarketingPosts(posts, { period, quality, platform: 'all', format: 'all', search: '' }, new FixtureDate()));
  }
  for (const values of [[], [0], [1, 1, 2, 9], [-4, 0, 12], [NaN, Infinity]]) {
    assert.deepEqual(observe(current.median, [values]), observe(old.median, [values]));
    for (const ratio of [-1, 0, .25, .5, 1, 2]) assert.deepEqual(observe(current.percentile, [values, ratio]), observe(old.percentile, [values, ratio]));
    for (const value of [-1, 1, 999]) assert.deepEqual(observe(current.percentileRank, [value, values]), observe(old.percentileRank, [value, values]));
  }
});

test('actual React renders all marketing tabs/cards and entry identically across empty/partial datasets', () => {
  const names = ['OverviewTab', 'ContentTab', 'BenchmarksTab', 'QualityTab', 'MetricCard'];
  const old = load(dashboard, true, names);
  const current = { ...load(dashboard, false, names), ...load(overview), MetricCard: load(visuals).MetricCard };
  for (const posts of [[], [proof.syntheticPost], [{ ...proof.syntheticPost, platform: 'instagram', reach: 40, views: null, metricCoverageRate: null }]]) for (const goal of ['awareness', 'intent', 'deep']) {
    const data = { posts, coverage: [], latestSnapshotAt: '2026-10-12T00:00:00Z', sourceMode: 'clean-mart' };
    for (const name of ['OverviewTab', 'ContentTab', 'BenchmarksTab', 'QualityTab']) {
      const props = { posts, goal, setGoal: noop, periodLabel: 'fixture-period', coverage: [] };
      assert.equal(renderToStaticMarkup(React.createElement(current[name], props)), renderToStaticMarkup(React.createElement(old[name], props)), name);
    }
    assert.equal(renderToStaticMarkup(React.createElement(current.default, { data })), renderToStaticMarkup(React.createElement(old.default, { data })));
  }
  for (const tone of ['default', 'mint', 'gold', 'warning']) {
    const props = { tone, icon: React.createElement('i', null, 'fixture'), label: 'fixture', value: '0', helper: 'fixture' };
    assert.equal(renderToStaticMarkup(React.createElement(current.MetricCard, props)), renderToStaticMarkup(React.createElement(old.MetricCard, props)));
  }
});

test('workspace pure conversions retain Bangkok dates, nulls, exact media bindings and editorial guards', () => {
  const names = ['toLocalDateTime', 'formatScheduledAt', 'hasFutureSchedule', 'isHttpsLinkUrl', 'primaryAsset', 'mediaFromReferences', 'itemFromApproved', 'itemFromDraft', 'emptyDraft', 'displayStatus', 'editorialFields', 'exactMediaBinding', 'facebookScheduleState'];
  const old = load(workspace, true, names);
  const current = load(workspaceModel);
  for (const value of [null, '', 'invalid', '2026-12-31T23:50:00Z', '2026-10-11T00:00', '2026-10-13T00:00']) for (const name of ['toLocalDateTime', 'formatScheduledAt', 'hasFutureSchedule']) assert.deepEqual(observe(current[name], [value]), observe(old[name], [value]), name);
  for (const value of ['', 'http://fixture.invalid', 'https://fixture.invalid', ' javascript:alert(1)', '/relative']) assert.equal(current.isHttpsLinkUrl(value), old.isHttpsLinkUrl(value));
  const references = [{ assetId: 'synthetic-one', role: 'primary', order: 1, mimeType: 'image/jpeg', widthPx: 300, heightPx: 200, durationMs: null, sha256Checksum: 'a'.repeat(64) }];
  for (const refs of [[], references, [{ ...references[0], mimeType: 'video/mp4', durationMs: 1234 }]]) for (const name of ['primaryAsset', 'mediaFromReferences', 'exactMediaBinding']) assert.deepEqual(observe(current[name], [refs]), observe(old[name], [refs]));
  for (const master of ['', 'synthetic-master']) {
    assert.deepEqual(current.emptyDraft(master), old.emptyDraft(master));
    for (const platform of ['facebook', 'instagram', 'tiktok']) for (const publicationStatus of [null, 'native-scheduled', 'published']) {
      const item = { ...old.emptyDraft(master), platform, publicationStatus };
      for (const name of ['displayStatus', 'editorialFields', 'facebookScheduleState']) assert.equal(current[name](item), old[name](item));
    }
  }
});

test('actual React workspace first render retains approval-disabled controls without executing effects', () => {
  for (const approvalEnabled of [true, false]) assert.equal(renderToStaticMarkup(React.createElement(load(workspace).default, { approvalEnabled })), renderToStaticMarkup(React.createElement(load(workspace, true).default, { approvalEnabled })));
});

test('mounted workspace preserves save/approve/execute traces, stale-save denial, selection and abort cleanup', async () => {
  const { JSDOM } = require('jsdom');
  async function exercise(old, conflict) {
    const dom = new JSDOM('<!doctype html><div id="fixture-root"></div>', { url: 'https://fixture.invalid/' });
    const previous = new Map();
    for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'IS_REACT_ACT_ENVIRONMENT', 'fetch']) previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true })) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    const { createRoot } = require('react-dom/client');
    const container = dom.window.document.querySelector('#fixture-root');
    const root = createRoot(container);
    const traces = [], snapshots = [], signals = [];
    const draft = { variantId: 'synthetic-variant', revision: 'synthetic-r1', version: 1, masterContentId: 'synthetic-master', title: 'synthetic-title', caption: 'synthetic-caption', linkUrl: null, channel: 'facebook', format: 'text-post', publishingMode: 'native-scheduled', reviewStatus: 'approved', mediaReferences: [], commentSeriesMode: 'threaded', commentSeries: [] };
    const data = { drafts: [draft], publications: [], masterContentChoices: [{ id: 'synthetic-master', title: 'synthetic-master' }], draftError: null, publicationError: null };
    const client = { loadSocialWorkspace: async signal => { traces.push({ operation: 'load', hasSignal: Boolean(signal) }); if (signal) signals.push(signal); return structuredClone(data); }, openGoogleDrivePicker: () => { throw new Error('fixture-provider-denied'); }, requestGoogleDriveMemorySession: () => { throw new Error('fixture-provider-denied'); }, verifyGoogleDrivePickerFiles: () => { throw new Error('fixture-provider-denied'); } };
    globalThis.fetch = async (url, init) => {
      traces.push({ operation: 'POST', url, body: JSON.parse(init.body) });
      if (url === '/api/admin/social/drafts/') {
        if (conflict) return { ok: false, json: async () => ({ error: 'revision-conflict' }) };
        draft.revision = 'synthetic-r2';
        return { ok: true, json: async () => ({ draft: { variantId: draft.variantId } }) };
      }
      if (url === '/api/admin/social/publications/') {
        data.publications = [{ ...draft, platform: 'facebook', mediaMetadata: [], publication: { publicationId: 'synthetic-publication', jobVersion: 1, status: 'approved', scheduledAt: '2027-01-12T03:00:00Z', executionTarget: 'facebook-native-schedule' } }];
        return { ok: true, json: async () => ({ publication: { executionTarget: 'facebook-native-schedule' } }) };
      }
      assert.equal(url, '/api/admin/social/publications/execute');
      data.publications[0].publication.status = 'published';
      return { ok: true, json: async () => ({ result: { state: 'scheduled' } }) };
    };
    const component = load(workspace, old, [], new Map([['@/features/admin/social/social-workspace-client', client]])).default;
    const props = element => element[Object.keys(element).find(key => key.startsWith('__reactProps$'))];
    const button = text => [...container.querySelectorAll('button')].find(element => element.textContent === text);
    const flush = async action => React.act(async () => { await action(); await Promise.resolve(); await Promise.resolve(); });
    try {
      await flush(() => root.render(React.createElement(component, { approvalEnabled: true })));
      snapshots.push(container.innerHTML);
      const schedule = () => props(container.querySelector('input[type="datetime-local"]')).onChange({ target: { value: '2027-01-12T10:00' } });
      await flush(schedule);
      snapshots.push(container.innerHTML);
      await flush(() => props(container.querySelector('form')).onSubmit({ preventDefault: noop }));
      snapshots.push(container.innerHTML);
      if (!conflict) {
        await flush(schedule);
        assert.equal(button('ยืนยันอนุมัติฉบับนี้').disabled, false);
        await flush(() => button('ยืนยันอนุมัติฉบับนี้').click());
        snapshots.push(container.innerHTML);
        assert.equal(button('ส่งไปยัง Meta').disabled, false);
        await flush(() => button('ส่งไปยัง Meta').click());
        snapshots.push(container.innerHTML);
      } else {
        assert.match(container.textContent, /ระบบจึงไม่เขียนทับ/);
        assert.equal(traces.filter(trace => trace.operation === 'POST').length, 1);
      }
      await flush(() => button('สร้างฉบับร่างใหม่').click());
      snapshots.push(container.innerHTML);
      await flush(() => root.unmount());
      assert.ok(signals.length);
      assert.ok(signals.every(signal => signal.aborted));
      return { traces, snapshots, aborted: signals.length };
    } finally {
      await React.act(async () => root.unmount());
      dom.window.close();
      for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
    }
  }
  for (const conflict of [false, true]) assert.deepEqual(await exercise(false, conflict), await exercise(true, conflict));
});
