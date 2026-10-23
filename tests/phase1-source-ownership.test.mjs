import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';

const require = createRequire(import.meta.url);
const { renderToStaticMarkup } = require('react-dom/server');
const React = require('react');
const proof = JSON.parse(readFileSync('qa/phase1-source-ownership.json', 'utf8'));
const sources = new Map(proof.sharedPages.flatMap(page => [[page.root, page.originalRootSource], [page.canonical, page.originalCanonicalSource]]));
for (const [file, original] of Object.entries(proof.baselineSources)) sources.set(file, original);
const date = '2026-10-12T04:00:00.000Z';
const row = { id: 'synthetic-article', rawId: 'synthetic-article', title: 'บทความทดสอบ', category: 'personal-finance', categorySlug: 'personal-finance', slug: 'synthetic', tags: ['ภาษี'], hasPublished: false, isDraft: true, reviewStatus: 'needs-human-review', updatedAt: date, publishedAt: null, seoScore: 73, seoAuditVersion: 'fixture-audit', seoAuditedAt: date, primaryKeyword: 'ทดสอบ', searchIntent: 'informational' };

async function view(file, config, baseline = false) {
  const trace = [];
  const status = { environment: 'production-admin', dataset: config.noDataset ? undefined : 'production', readReady: !config.readError, writeReady: config.writeReady };
  const article = { ...row, seoDescription: '', seoTitle: '', ogTitle: '', ogDescription: '', focusKeyword: 'ทดสอบ', research: [], canonical: null };
  const audit = { articleId: config.published ? row.id : 'drafts.' + row.id, auditedAt: date, summary: 'ผลจำลอง', score: 73, passedChecks: 0, criticalIssues: 0, opportunities: 0, checks: [], contentReadiness: { warnings: [], legacyFacebookCtas: config.legacyCta ? 1 : 0 }, geoAudit: { checks: [], passedChecks: 0, totalChecks: 0 } };
  const schedules = config.empty ? [] : ['published', 'validated', 'preparing', 'scheduled', 'executing', 'failed', 'reconciliation-required', 'stale', 'cancelled', 'unknown'].map((state, index) => ({ article_id: row.id, scheduled_at: index % 2 ? date : '2026-10-13T04:00:00.000Z', updated_at: date, status: state, mode: index % 2 ? 'publish' : 'validate', generation: 'generation-' + index, created_by: 'synthetic-owner', error_code: index % 2 ? 'synthetic-error' : null }));
  const mocks = new Map([
    ['@/lib/admin/require-permission', { requireAdminPermission: async (permission) => { trace.push(['permission', permission]); if (config.denied) throw new Error('synthetic-forbidden'); return { role: config.role ?? 'owner' }; } }],
    ['@/lib/admin/environment', { getAdminEnvironment: () => 'production-admin', isStudioDataPlaneAllowed: (dataset) => { trace.push(['studio', dataset]); return config.studioReady; } }],
    ['@/lib/admin/sanity-control', { listAdminArticles: async () => { trace.push(['articles']); return { rows: config.empty ? [] : [{ ...row, ...config.rowOverrides, id: config.draftId ? 'drafts.' + row.id : row.id, hasPublished: config.published, seoScore: config.liveAudit ? null : row.seoScore }], status, error: config.readError ? config.requestFailed ? 'request-failed' : 'synthetic-read-error' : null }; }, getAdminSanityStatus: () => { trace.push(['status']); return status; }, listSeoSuggestions: async () => { trace.push(['suggestions']); return { rows: config.empty ? [] : ['needs-human-review', 'approved', 'applied', 'rejected'].map((state, index) => ({ id: 'synthetic-proposal-' + index, status: state, riskLevel: config.risk ?? 'low', approvedRiskLevel: config.risk ?? 'low', type: config.unknownType ? 'synthetic-unknown' : 'seo-title', approvedType: config.unknownType ? 'synthetic-unknown' : 'seo-title', confidence: 0.5, articleTitle: 'บทความทดสอบ', articleId: 'drafts.' + row.id, approvedTargetId: 'drafts.' + row.id, targetRevision: 'r1', targetCurrentRevision: config.stale ? 'r2' : 'r1', approvedTargetRevision: 'r1', before: 'synthetic-before', after: 'synthetic-after', approvedAfter: 'synthetic-approved', reason: 'synthetic-reason' })), status, error: config.readError ? 'synthetic-read-error' : null }; } }],
    ['@/lib/admin/suggestion-lifecycle', { isStaleSuggestionRevision: (target, current) => target !== current, getApplyableFieldPath: type => type === 'seo-title' ? 'seoTitle' : null }],
    ['@/lib/admin/seo-heuristics', { SEO_AUDIT_VERSION: 'fixture-audit' }],
    ['@/lib/admin/operations/article-scheduler-read-model', { readArticleSchedulerModel: async (input) => { trace.push(['scheduler', input]); return { schedules, audit: schedules.map(record => ({ ...record, occurred_at: date, actor: 'synthetic-owner', row_version: 1 })), status: config.readError ? 'unavailable' : 'ready', runtimeEnabled: config.writeReady, durableEnabled: config.studioReady, effectiveEnabled: config.writeReady && config.studioReady, error: config.readError ? 'synthetic-error' : null }; } }],
    ['@/lib/admin/sanity-audit', { listAuditLogs: async () => { trace.push(['auditLogs']); return { rows: [], error: config.readError ? 'synthetic-error' : null }; } }],
    ['@/lib/admin/seo-intelligence/foundation', { getSeoIntelligenceRuntimeStatus: () => { trace.push(['intelligence']); return { enabled: config.intelligence }; } }],
    ['@/lib/admin/seo-audit', { runSeoAudit: async (id, persist) => { trace.push(['audit', id, persist]); if (config.auditError) throw new Error('synthetic-audit-error'); return audit; }, getSeoProposalContext: async (id) => { trace.push(['context', id]); return article; } }],
    ['@/lib/admin/seo-proposals', { buildDeterministicSeoProposals: (input) => { trace.push(['proposals', input.focusKeyword, input.now]); return config.proposals ? [{}] : []; } }],
    ['@/cms/sanity/policy/studio-policy', { getStudioArticleEditHref: (id) => '/studio/intent/edit/id=' + id }],
  ]);
  const fixture = loadFixtureModule(file, { sources: baseline ? sources : new Map(), mocks });
  try {
    const node = await fixture.default({ searchParams: Promise.resolve(config.filters ?? {}), params: Promise.resolve({ id: config.draftId ? 'drafts.' + row.id : row.id }) });
    return { metadata: fixture.metadata, html: renderToStaticMarkup(node), trace };
  } catch (error) {
    return { metadata: fixture.metadata, error: error.message, trace };
  }
}

const cases = [
  { empty: true },
  {},
  { denied: true },
  { readError: true, empty: true, noDataset: true },
  { published: true, liveAudit: true },
  { published: true, liveAudit: true, auditError: true },
  { studioReady: true, writeReady: true, intelligence: true, proposals: true, legacyCta: true },
  { filters: { category: 'personal-finance', tag: 'ภาษี', sort: 'title', order: 'asc' }, noDataset: true },
  { draftId: true, published: true, rowOverrides: { reviewStatus: null, title: null, primaryKeyword: null, category: null } },
  { readError: true, requestFailed: true, empty: true, noDataset: true },
];
for (const page of proof.sharedPages) {
  for (const file of [page.root, page.canonical]) {
    test(`${file}: original Production DOM, metadata, read order, write/read gates and failure outcomes`, async () => {
      for (const config of cases) {
        const original = await view(file, config, true);
        const candidate = await view(file, config);
        if (candidate.html !== original.html) {
          let i = 0; while (i < Math.min(candidate.html?.length ?? 0, original.html?.length ?? 0) && candidate.html[i] === original.html[i]) i++;
          assert.equal(candidate.html, original.html, `DOM difference at ${i}: candidate=${candidate.html?.slice(i, i + 140)} original=${original.html?.slice(i, i + 140)}`);
        }
        assert.deepEqual(candidate, original, JSON.stringify(config));
        if (!config.denied && !config.auditError && !(page.name === 'ArticleDetailPage' && config.empty && !config.readError)) assert.ok(candidate.html, 'must render a real page rather than matching two fixture errors');
        if (page.name === 'ArticleDetailPage' && config.empty && !config.readError) assert.equal(candidate.error, 'fixture-not-found');
        if (config.denied) assert.deepEqual(candidate.trace, [['permission', file.includes('/content/') ? 'content:read' : file.includes('/operations/') ? 'audit:read' : page.name === 'AdminReviewsPage' ? 'reviews:read' : 'seo:read']]);
      }
    });
  }
}

test('proposal Inbox owner preserves review/apply denials, frozen-risk values, stale revisions and exact action props', async () => {
  const page = proof.sharedPages.find(item => item.name === 'AdminReviewsPage');
  for (const file of [page.root, page.canonical]) for (const role of ['owner', 'viewer']) for (const risk of ['low', 'high', 'critical']) for (const stale of [false, true]) for (const writeReady of [false, true]) {
    const config = { role, risk, stale, writeReady, studioReady: true };
    assert.deepEqual(await view(file, config), await view(file, config, true), JSON.stringify(config));
  }
});

// Resolve only these synthetic server-component fixtures. Client/navigation/provider
// boundaries stay inert while real candidate presentation and policy helpers execute.
async function serverTree(node) {
  if (Array.isArray(node)) return Promise.all(node.map(serverTree));
  if (!React.isValidElement(node)) return node;
  if (typeof node.type === 'function') return serverTree(await node.type(node.props));
  const children = await serverTree(node.props.children);
  return Array.isArray(children) ? React.cloneElement(node, {}, ...children) : React.cloneElement(node, {}, children);
}

test('protected Chrome retains each role/capability/lane navigation, identity, logout action and safety copy', async () => {
  const path = 'app/(control-plane)/layout.tsx';
  for (const file of [path, 'apps/admin/' + path]) for (const role of [null, 'owner', 'editor', 'viewer']) for (const profile of ['full', 'editorial', 'disabled']) for (const environment of ['production-admin', 'local-production', 'admin-uat']) {
    async function render(baseline) {
      const trace = [], actions = [];
      const jsx = require('react/jsx-runtime');
      const runtime = { ...jsx, jsx: (type, props, ...rest) => { if (type === 'form' && props.action) actions.push(props.action); return jsx.jsx(type, props, ...rest); } };
      const capability = loadFixtureModule('lib/admin/capability-profile.ts', { globals: { process: { env: {} } } });
      const mocks = new Map([
        ['react/jsx-runtime', runtime],
        ['@/auth', { auth: async () => { trace.push('auth'); return role ? { user: { role, email: 'synthetic@example.invalid', name: 'synthetic-owner' } } : null; }, signOut: async input => { trace.push(['signOut', input]); } }],
        ['@/lib/admin/environment', { getAdminEnvironment: () => { trace.push('environment'); return environment; } }],
        ['@/lib/admin/capability-profile', { ...capability, getAdminCapabilityProfile: () => { trace.push('capability'); return profile; } }],
        ['@/features/admin/components/AdminDataRefresh', { __esModule: true, default: () => React.createElement('span', { 'data-fixture-refresh': true }) }],
        ['@/features/admin/components/AdminNavigation', { __esModule: true, default: ({ items }) => React.createElement('nav', { 'data-fixture-navigation': JSON.stringify(items) }) }],
      ]);
      const fixture = loadFixtureModule(file, { sources: baseline ? sources : new Map(), mocks });
      try {
        const node = await fixture.default({ children: React.createElement('p', null, 'synthetic-content') });
        const html = renderToStaticMarkup(await serverTree(node));
        for (const action of actions) await action();
        return { metadata: fixture.metadata, html, trace, actionCount: actions.length };
      } catch (error) { return { error: error.message, redirect: error.url, trace }; }
    }
    assert.deepEqual(await render(false), await render(true), JSON.stringify({ file, role, profile, environment }));
  }
});

test('root and Web keep their original complete metadata and layout/first-paint/tracking composition', async () => {
  for (const file of ['app/layout.tsx', 'apps/web/app/layout.tsx']) for (const admin of [false, true]) for (const review of [false, true]) for (const draft of [false, true]) {
    async function render(baseline) {
      const trace = [];
      const mocks = new Map([
        ['@/lib/content/public-copy',{getPublicCopy:async scope=>loadFixtureModule('lib/content/public-copy-registry.ts').parsePublicCopy(scope,null)}],
        ['@/components/ui/PublicCopyProvider',{PublicCopyProvider:({children})=>children}],
        ['next/font/google', { Kanit: options => { trace.push(['font', options]); return { variable: options.variable }; } }],
        ['next/headers', { draftMode: async () => { trace.push('draftMode'); return { isEnabled: draft }; } }],
        ['@/lib/deployment-environment', { IS_ADMIN_APPLICATION: admin, IS_DRAFT_PREVIEW_ALLOWED: review, IS_REVIEW_ENVIRONMENT: review, PRODUCTION_ANALYTICS_ENABLED: !admin && !review }],
        ['../runtime-environment', { IS_WEB_REVIEW_ENVIRONMENT: review, PRODUCTION_WEB_ANALYTICS_ENABLED: !review }],
        ['@/lib/seo/structured-data/site-schema', { ccpunSchemaGraph: { '@type': 'SyntheticSchema' }, buildCcpunSchemaGraph: () => ({ '@type': 'SyntheticSchema' }) }],
        ['@/lib/content/sanity', { getPrimaryAuthorProfile: async () => null }],
        ['@/features/analytics/components/ClientWidgets', { __esModule: true, default: props => React.createElement('aside', { 'data-fixture-analytics-props': JSON.stringify(props) }) }],
        ['@/components/layout/website-43/Website43ResponsiveStyles', { Website43ResponsiveStyles: () => React.createElement('style', { 'data-fixture-responsive': true }) }],
        ['@/components/preview/DraftPreviewRuntime', { __esModule: true, default: props => React.createElement('aside', { 'data-fixture-draft-sdk-props': JSON.stringify(props) }) }],
      ]);
      const fixture = loadFixtureModule(file, { sources: baseline ? sources : new Map(), mocks, globals: { process: { env: { NEXT_PUBLIC_GA_ID: 'synthetic-ga', NEXT_PUBLIC_META_PIXEL_ID: 'synthetic-meta' } } } });
      const tree = await fixture.default({ children: React.createElement('p', null, 'synthetic-content') });
      return { metadata: fixture.generateMetadata ? await fixture.generateMetadata() : fixture.metadata, html: renderToStaticMarkup(await serverTree(tree)), trace };
    }
    const original = await render(true);
    if (file === 'apps/web/app/layout.tsx') {
      const font = original.trace.find(entry => Array.isArray(entry) && entry[0] === 'font' && entry[1].variable === '--font-kanit');
      assert.deepEqual(font[1].weight, ['300', '400', '600', '700'], 'original noncritical font weights retained');
      font[1].weight = ['300', '400', '500', '600', '700'];
      const critical = original.trace.find(entry => Array.isArray(entry) && entry[0] === 'font' && entry[1].variable === '--font-kanit-critical');
      assert.deepEqual(critical[1].weight, ['400', '600', '700'], 'original critical Thai weights retained');
      critical[1].weight = ['400', '500', '600', '700'];
      for (const entry of [font, critical]) {
        assert.equal(entry[1].display, 'optional', 'original display policy retained');
        entry[1].display = 'swap';
      }
    }
    assert.deepEqual(await render(false), original, JSON.stringify({ file, admin, review, draft }));
  }
});

test('Settings retains the original three-read sequence, private read-only views and source errors per lane', async () => {
  const root = 'app/(control-plane)/settings/[section]/page.tsx';
  for (const file of [root, 'apps/admin/' + root]) for (const section of ['integrations', 'access', 'system', 'unknown']) for (const ready of [false, true]) for (const denied of [false, true]) {
    async function render(baseline) {
      const trace = [];
      const value = { projectId: 'synthetic-project', dataset: 'production', readReady: ready, lane: 'synthetic-lane', identityValid: ready, environment: 'production-admin', configured: ready, enabled: ready };
      const readiness = provider => { trace.push(['provider', provider]); return { status: ready ? 'manual-sync-ready' : 'not-configured' }; };
      const mocks = new Map([
        ['@/auth', { auth: async () => { trace.push('auth'); return { user: { email: 'synthetic@example.invalid', role: 'owner' } }; } }],
        ['@/lib/admin/require-permission', { requireAdminPermission: async permission => { trace.push(['permission', permission]); if (denied) throw new Error('synthetic-forbidden'); } }],
        ['@/lib/admin/environment', { getAdminEnvironment: () => { trace.push('environment'); return 'production-admin'; }, getAdminDeploymentIdentity: () => { trace.push('deployment'); return { provider: 'hostinger', role: 'admin', environment: 'production-admin', gitRef: 'synthetic-ref', gitSha: 'a'.repeat(40) }; } }],
        ['@/lib/admin/sanity-control', { getAdminSanityStatus: () => { trace.push('sanity'); return value; } }],
        ['@/lib/admin/operations/foundation', { getAdminOperationsRuntimeStatus: () => { trace.push('operations'); return value; } }],
        ['@/lib/admin/operations/article-scheduler-read-model', { readArticleSchedulerModel: async input => { trace.push(['scheduler', input]); return { status: ready ? 'ready' : 'unavailable', runtimeEnabled: ready, durableEnabled: ready, effectiveEnabled: ready }; } }],
        ['@/lib/admin/seo-intelligence/provider-readiness', { getSeoGoogleProviderReadiness: readiness }],
        ['@/lib/admin/social/provider-readonly', { getSocialProviderReadiness: readiness }],
        ['@/lib/admin/social/operations', { getSocialOperationsRuntimeStatus: () => { trace.push('social'); return value; } }],
        ['@/lib/admin/line/discovery-config', { readLineDiscoveryAdminModel: async () => { trace.push('lineDiscovery'); return { fixture: true }; } }],
        ['@/features/admin/line/LineDiscoveryManager', { __esModule: true, default: ({ initialModel }) => React.createElement('aside', { 'data-fixture-line-discovery': JSON.stringify(initialModel) }) }],
      ]);
      const fixture = loadFixtureModule(file, { sources: baseline ? sources : new Map(), mocks, globals: { process: { env: { VERCEL_ENV: 'synthetic-legacy', VERCEL_GIT_COMMIT_REF: 'synthetic-ref', VERCEL_GIT_COMMIT_SHA: 'b'.repeat(40) } } } });
      try {
        const node = await fixture.default({ params: Promise.resolve({ section }) });
        return { html: renderToStaticMarkup(await serverTree(node)), trace };
      } catch (error) { return { error: error.message, trace }; }
    }
    const before = await render(true), after = await render(false);
    assert.deepEqual(after, before, JSON.stringify({ file, section, ready, denied }));
    if (!denied && section !== 'unknown') assert.ok(after.html, 'both implementations must actually render');
    if (denied) assert.deepEqual(after.trace, [['permission', 'settings:read']]);
  }
});

test('Health retains per-lane reads, partial/ready/warning/off cards and safe activation props', async () => {
  const ts = require('typescript');
  const root = 'app/(control-plane)/operations/health/page.tsx';
  for (const file of [root, 'apps/admin/' + root]) for (const ready of [false, true]) for (const warning of [false, true]) for (const denied of [false, true]) {
    const runtimeVersions = ready ? warning ? { node: '24.22.0', undici: '7.29.1' } : { node: '24.22.1', undici: '7.30.1' }
      : warning ? {} : { node: '<script>private-version</script>', undici: '7.30.1\nprivate-suffix' };
    const safeVersion = value => /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value ?? '') ? value : '—';
    async function render(baseline) {
      const trace = [];
      const models = {
        getAdminDeploymentIdentity: { valid: ready, provider: 'hostinger', role: 'admin', environment: 'production-admin', gitRef: 'v4-production', gitSha: 'a'.repeat(40) },
        getAdminSanityStatus: { projectId: 'synthetic-project', dataset: 'production', readReady: ready, writeReady: ready && !warning },
        getAdminOperationsRuntimeStatus: { identityValid: ready && !warning, configured: ready, projectId: 'synthetic-project', branchId: 'synthetic-branch', lane: 'synthetic-lane', database: 'synthetic-database', migrationVersion: 'fixture' },
        readArticleSchedulerModel: { status: ready ? 'ready' : 'unavailable', effectiveEnabled: ready && !warning, runtimeEnabled: ready, durableEnabled: ready, mode: 'validate', audit: [], schedules: [], error: warning ? 'synthetic-read-error' : null },
        getSocialDatabaseReadiness: { configured: ready, reachable: ready, migrationCurrent: ready && !warning, errorCategory: warning ? 'synthetic-error' : null },
        getSocialDatabaseCapabilityStatus: { configured: ready, mode: warning ? 'raw-preview-fallback' : 'clean-mart', missingRelations: [], lane: 'synthetic-lane', martCurrent: ready, provenanceCurrent: ready, relationsCurrent: ready },
        getSocialFoundationRuntimeStatus: { enabled: ready }, getSocialOperationsRuntimeStatus: { enabled: ready, environment: 'production-admin' },
        readLineKeyRotationStatus: { state: ready ? 'ready' : 'unavailable', unsupportedVersionCount: warning ? 1 : 0, encryptedUnsentCount: 0, activeVersion: '2', v2Configured: ready, lazyRotationEnabled: ready, totalV1: 0, totalV2: 0, rotatableV1: 0, encryptedUnsentCount: 0, adminOnlyV2Count: 0, allV2Configured: ready },
        readLineDocumentMediaHealth: { state: ready ? 'ready' : 'unavailable', driveFolderUnsafe: warning ? 1 : 0, reconciliationRequired: 0, webRuntimeActiveV2: ready, webRuntimeLazyRotationEnabled: ready, driveFolderReady: ready, webRuntimeLastReportedAt: date },
        readLineOperationsHealth: { state: ready ? 'ready' : 'unavailable', automaticDeleteEnabled: warning, retentionMode: 'retain' },
        readLineDeliveryHealth: { state: ready ? 'ready' : 'unavailable' },
        readPrivacySafetyHealth: { state: ready ? 'ready' : 'unavailable', automaticDeleteEnabled: warning, destructiveExecutionAvailable: false, retentionMode: 'retain', backupRestoreEvidenceState: 'synthetic', keyRotationEvidenceState: 'synthetic' },
        readLineArchiveHealth: { state: ready ? 'ready' : 'unavailable', directAdminReplyEnabled: warning },
        readDefaultLineRichMenuStatus: { state: ready ? 'ready' : 'unavailable' }, readLineSystemDeliveryDatabaseReadiness: { ready },
        readLineRichMenuControlState: { desiredMode: 'synthetic', state: ready ? 'ready' : 'unavailable', rowVersion: 1, approvedPreviousHash: null },
        getLineProviderActivationReadiness: { channelTokenPresent: ready, richMenuWriteGateEnabled: ready, outboundWriteGateEnabled: false, driveInteractiveConfigReady: ready },
        getLineMediaProviderReadiness: { fetchEnabled: ready }, getLineSystemDeliveryProviderReadiness: { enabled: ready, tokenPresent: ready, cryptoReady: ready },
      };
      // Synthetic counters are explicit zeros; no customer record or private store is read.
      const healthSource = sources.get(file), tree = ts.createSourceFile(file, healthSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const mocks = new Map([
        ['@/lib/admin/require-permission', { requireAdminPermission: async permission => { trace.push(['permission', permission]); if (denied) throw new Error('synthetic-forbidden'); } }],
        ['@/features/admin/line/LineProviderActivationActions', { LineProviderActivationActions: props => React.createElement('aside', { 'data-fixture-activation-props': JSON.stringify(props) }) }],
      ]);
      for (const statement of tree.statements) {
        if (!ts.isImportDeclaration(statement) || !statement.moduleSpecifier.text.startsWith('@/lib/admin/') || statement.moduleSpecifier.text.endsWith('/presentation') || statement.moduleSpecifier.text.endsWith('/require-permission')) continue;
        const exports = {};
        for (const binding of statement.importClause?.namedBindings?.elements ?? []) {
          if (binding.isTypeOnly) continue;
          const name = binding.propertyName?.text ?? binding.name.text;
          if (name === 'resolveArticleSchedulerLane') { exports[name] = () => { trace.push(name); return ready ? 'synthetic-lane' : null; }; continue; }
          assert.ok(models[name], 'explicit synthetic model missing ' + name);
          const model = { ...models[name] };
          for (const match of healthSource.matchAll(/\b(?:lineKeyRotation|lineOperations|lineDocumentMedia|lineDelivery|privacySafety|lineArchive)\.([A-Za-z_0-9]+)\.toLocaleString/g)) if (!(match[1] in model)) model[match[1]] = 0;
          exports[name] = name.startsWith('read') || name.startsWith('getSocialDatabase') ? async (...args) => { trace.push([name, args]); return model; } : (...args) => { trace.push([name, args]); return model; };
        }
        mocks.set(statement.moduleSpecifier.text, exports);
      }
      const fixture = loadFixtureModule(file, { sources: baseline ? sources : new Map(), mocks, globals: { process: { env: { CCPUN_APP_ENV: 'production-admin', PRIVATE_TEST_SECRET: 'never-render-this-env-value' }, get versions() { if (denied) throw new Error('VERSION_READ_BEFORE_PERMISSION'); return runtimeVersions; } } } });
      try { return { metadata: fixture.metadata, html: renderToStaticMarkup(await serverTree(await fixture.default())), trace }; }
      catch (error) { return { metadata: fixture.metadata, error: error.message, trace }; }
    }
    const before = await render(true), after = await render(false);
    if (!denied && after.html && file.startsWith('apps/admin/')) {
      const approvedRows = renderToStaticMarkup(React.createElement(React.Fragment, null,
        React.createElement(loadFixtureModule('features/admin/components/HealthStatus.tsx').Row, { label: 'Node.js', value: safeVersion(runtimeVersions.node) }),
        React.createElement(loadFixtureModule('features/admin/components/HealthStatus.tsx').Row, { label: 'Bundled Undici', value: safeVersion(runtimeVersions.undici) })));
      assert.equal(after.html.split(approvedRows).length, 2, 'exactly two closed numeric runtime rows');
      const at = after.html.indexOf(approvedRows);
      assert.ok(at > after.html.indexOf('<details') && at < after.html.indexOf('</details>'), 'runtime rows stay inside existing technical details');
      assert.doesNotMatch(after.html, /private-version|private-suffix|never-render-this-env-value/);
      assert.deepEqual({ ...after, html: after.html.replace(approvedRows, '') }, before, JSON.stringify({ file, ready, warning, denied }));
    } else assert.deepEqual(after, before, JSON.stringify({ file, ready, warning, denied }));
    if (!denied) assert.ok(after.html, 'Health must render actual card/row bodies: ' + JSON.stringify(after.error));
    if (denied) assert.deepEqual(after.trace, [['permission', 'settings:read']]);
  }
});

test('Dashboard retains guarded editorial read order, review counts, advisor limits and workflow targets', async () => {
  const root = 'app/(control-plane)/dashboard/page.tsx';
  class FixedDate extends Date { constructor(value = date) { super(value); } static now() { return Date.parse(date); } }
  for (const file of [root, 'apps/admin/' + root]) for (const role of ['owner', 'viewer']) for (const ready of [false, true]) for (const denied of [false, true]) for (const error of [undefined, 'forbidden']) {
    async function render(baseline) {
      const trace = [];
      const mocks = new Map([
        ['@/lib/admin/require-permission', { requireAdminPermission: async permission => { trace.push(['permission', permission]); if (denied) throw new Error('synthetic-forbidden'); return { role }; } }],
        ['@/lib/admin/environment', { isStudioDataPlaneAllowed: dataset => { trace.push(['studio', dataset]); return ready; } }],
        ['@/lib/admin/sanity-control', { getAdminSanityStatus: () => { trace.push('sanity'); return { environment: ready ? 'local-production' : 'production-admin', dataset: ready ? 'production' : undefined, readReady: ready, writeReady: ready }; }, listSeoSuggestions: async () => { trace.push('reviews'); return { rows: [{ status: 'needs-human-review' }, { status: 'approved' }], error: ready ? null : 'synthetic-unavailable' }; } }],
        ['@/lib/admin/operations/foundation', { getAdminOperationsRuntimeStatus: () => { trace.push('operations'); return { identityValid: ready, configured: ready }; } }],
        ['@/lib/admin/line/advisor-workflow', { listAdvisorInboxOperational: async input => { trace.push(['advisor', input]); if (!ready) throw new Error('synthetic-advisor-unavailable'); return []; } }],
        ['@/lib/admin/line/business-intelligence', { readConversionAnalytics: async () => { trace.push('conversion'); if (!ready) throw new Error('synthetic-conversion-unavailable'); return { state: 'ready', summary: { lead_count: 0, qualified_count: 0, won_count: 0, revenue_record_count: 0 } }; } }],
        ['@/lib/admin/operations/jobs-read-model', { readOperationsJobs: async limit => { trace.push(['jobs', limit]); if (!ready) throw new Error('synthetic-jobs-unavailable'); return { jobs: [{ status: 'failed' }, { status: 'reconciliation_required' }, { status: 'completed' }] }; } }],
      ]);
      const fixture = loadFixtureModule(file, { sources: baseline ? sources : new Map(), mocks, globals: { Date: FixedDate } });
      try { return { metadata: fixture.metadata, html: renderToStaticMarkup(await serverTree(await fixture.default({ searchParams: Promise.resolve({ error }) }))), trace }; }
      catch (error) { return { metadata: fixture.metadata, error: error.message, trace }; }
    }
    const before = await render(true), after = await render(false);
    assert.deepEqual(after, before, JSON.stringify({ file, role, ready, denied, error }));
    if (!denied) assert.ok(after.html, 'Dashboard must render actual editorial/advisor composition');
    if (denied) assert.deepEqual(after.trace, [['permission', 'dashboard:read']]);
  }
});

test('Settings index retains route data, URL ordering, guard and complete markup', async () => {
  for (const file of ['app/(control-plane)/settings/page.tsx', 'apps/admin/app/(control-plane)/settings/page.tsx']) for (const denied of [false, true]) {
    async function render(baseline) {
      const trace = [];
      const mocks = new Map([['@/lib/admin/require-permission', { requireAdminPermission: async permission => { trace.push(permission); if (denied) throw new Error('synthetic-forbidden'); } }]]);
      const fixture = loadFixtureModule(file, { sources: baseline ? sources : new Map(), mocks });
      try { return { html: renderToStaticMarkup(await serverTree(await fixture.default())), trace }; }
      catch (error) { return { error: error.message, trace }; }
    }
    assert.deepEqual(await render(false), await render(true));
  }
});
