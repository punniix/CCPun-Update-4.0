import { ownerReviewEditorSourcePredecessor } from "../../qa/v5-owner-review-source-successor.mjs";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';
import { loadFixtureModule } from '../../qa/phase1-fixture-loader.mjs';
const registry = loadFixtureModule('lib/content/public-copy-registry.ts');
const copyText = loadFixtureModule('lib/content/public-copy-text.ts');
function preview({ environment = 'admin-uat', allowed = true, denied = false, malformed = false } = {}) {
  const calls: Array<{ perspective: string; params: { id: string } }> = [];
  const fixtureModule = loadFixtureModule('lib/admin/public-copy-preview.ts', { mocks: new Map([
    ['./require-permission', { requireAdminPermission: async (permission: string) => { assert.equal(permission, 'draft:apply'); if (denied) throw Error('permission-denied'); } }],
    ['./environment', { getAdminEnvironment: () => environment, isAdminReadDataPlaneAllowed: () => allowed }],
    ['../content/sanity-fetch', { sanityFetch: async (request: { perspective: string; params: { id: string } }) => { calls.push(request); return { data: malformed && request.params.id === 'publicPageCopy-about-th' ? { _id: request.params.id, _type: 'publicPageCopy', scope: 'about', locale: 'th', entries: [{ key: 'unknown', text: 'invalid' }] } : null }; } }],
  ]) });
  return { calls, read: fixtureModule.getPublicCopyPreview };
}
test('Admin new text preview denies permission and mismatched lanes before any content fetch', async () => {
  const denied = preview({ denied: true });
  await assert.rejects(denied.read('about'), /permission-denied/);
  assert.deepEqual(denied.calls, []);
  for (const environment of ['unknown', 'lab', 'production-admin', 'local-production']) for (const scope of ['about', 'toolsHub', 'investment']) {
    const fixture = preview({ environment });
    await assert.rejects(fixture.read(scope), /fixture-not-found/);
    assert.deepEqual(fixture.calls, []);
  }
  const wrongLane = preview({ allowed: false });
  await assert.rejects(wrongLane.read('about'), /fixture-not-found/);
  assert.deepEqual(wrongLane.calls, []);
});
test('Admin UAT draft preview has exact copy, site and Home edit targets without invented SEO owners', async () => {
  for (const scope of ['about', 'toolsHub', 'investment']) {
    const fixture = preview();
    const result = await fixture.read(scope);
    assert.equal(result.dataset, 'uat');
    assert.equal(result.seo, null);
    assert.deepEqual(Object.keys(result.copy).sort(), Object.keys(registry.PUBLIC_COPY_SCOPES[scope].defaults).sort());
    for (const [key, value] of Object.entries(result.copy)) {
      assert.equal(copyText.cleanCopyText(value), registry.PUBLIC_COPY_SCOPES[scope].defaults[key]);
      assert.match(value as string, /[\u200B-\u200D\uFEFF]{4}/);
    }
    const expected = [`publicPageCopy-${scope}-th`, 'publicPageCopy-site-th', ...(scope === 'investment' ? [] : ['publicPageCopy-home-th'])];
    assert.deepEqual(fixture.calls.map(x => x.params.id), expected);
    assert.ok(fixture.calls.every(x => x.perspective === 'drafts'));
    assert.equal(result.home === undefined, scope === 'investment');
  }
});
test('Admin draft preview rejects unknown keys instead of weakening the strict parser', async () => {
  const fixture = preview({ malformed: true });
  await assert.rejects(fixture.read('about'), /PUBLIC_COPY_ENTRY_INVALID/);
});
test('Studio preserves original eight Production page-copy publication IDs and denies new scopes', () => {
  const policy = loadFixtureModule('cms/sanity/policy/studio-policy.ts', { mocks: new Map([
    ['../../../lib/admin/environment', { isStudioDataPlaneAllowed: () => true }],
  ]) });
  const actions = [{ action: 'publish' }, { action: 'discardChanges' }, { action: 'restore' }, { action: 'delete' }];
  for (const scope of registry.PRODUCTION_PUBLIC_COPY_SCOPES) assert.deepEqual(policy.filterStudioDocumentActions(actions, 'production', 'production-admin', 'publicPageCopy', 'kyfxgjnq', registry.publicCopyDocumentId(scope)), actions.slice(0, 3));
  for (const scope of ['about', 'toolsHub', 'investment']) {
    assert.deepEqual(policy.filterStudioDocumentActions(actions, 'production', 'production-admin', 'publicPageCopy', 'kyfxgjnq', registry.publicCopyDocumentId(scope)), []);
    assert.ok(policy.filterStudioDocumentActions(actions, 'uat', 'admin-uat', 'publicPageCopy', 'ccb9lnw5', registry.publicCopyDocumentId(scope)).some((x: { action: string }) => x.action === 'publish'));
  }
});
test('Admin preview uses real shared renderer imports, injected draft Home values and no new fund API', () => {
  const source = readFileSync('apps/admin/app/(control-plane)/content/website-preview/page.tsx', 'utf8');
  assert.match(source, /import \{ renderAboutPage \} from "@\/features\/about\/page"/);
  assert.match(source, /import \{ renderToolsHubPage \} from "@\/features\/tools-hub\/page"/);
  assert.match(source, /renderAboutPage\(copy, site, home, authorProfile\)/);
  assert.match(source, /renderToolsHubPage\(copy, site, home, true\)/);
  assert.match(source, /renderInvestmentAllocationContent\(copy, site\)/);
  const service = readFileSync('lib/admin/public-copy-preview.ts', 'utf8');
  assert.ok(service.indexOf('requireAdminPermission("draft:apply")') < service.indexOf('isPublicCopyScopeAvailable(scope, dataset)'));
  assert.ok(service.indexOf('isPublicCopyScopeAvailable(scope, dataset)') < service.indexOf('const read = async'));
});
// Preserve the active Admin 568 security and functional owners; reviewed shared text renderers never replace these.
const ACTIVE_568 = {
  "lib/admin/rbac.ts": "baefdfddcd48b7a71ae7efa5638219e569a400199301dc37533e3aab1e874b2b",
  "lib/admin/environment.ts": "c6070628a06b0c2b16cbf4b76b6ae58ed51189156f92e1986ceb436e4713869b",
  "lib/admin/require-permission.ts": "8140c91177ac1cdcd8cf06df2df411d96b12ad2a356862981c1aa9485e3e91f1",
  "lib/admin/afpt-renewal.ts": "dc0dd51344f6ab5fc69ebea26670da5c39416b9c61bbdd56368e9e3d7137b40e",
  "features/admin/operations/DailyJobBanner.tsx": "55901bd32ea3c935aea2e3af6d7ea9ca5b4f853cd9068881c85a29448d88e0f2",
  "lib/admin/ops-telemetry/daily-job.ts": "1a7038934173770e714585b2b377637919a5f9260825fe6fbd36a457c70e4288",
  "lib/admin/financial-planning/access.ts": "b1171646baed57fa62bc59cb8588e62c52d59e4938bd5d15be3410ba0c697f29",
  "apps/admin/next.config.ts": "4e8a5020135b0644a68e9ef9431f35a90e8b022b7e2551a58ce7d2bb661b276e",
  "apps/admin/app/(control-plane)/layout.tsx": "d23ed766c6b675224b15995772048da6c69c9910894b51917afb85902ab6ac63",
  "apps/admin/app/(control-plane)/dashboard/page.tsx": "bc336a2f593bd248b31a849c0122d3b9489553763f4f18515b85a7728f943b73",
  "lib/analytics.ts": "4176646b29ae2614cc044fef35d9be7cdffe8cfb303c8519f86fe71c148cd90f",
  "features/ci-planning/calculator/constants.ts": "ccdafe5526f8dfe32d129e6f74b0f574f07dbed3aa62d6fa3eb612ed44dbd9c9"
};
test('active Admin auth, RBAC, planning, AFPT, daily-job, no-store and analytics owners remain byte-for-byte', () => {
  for (const [file, expected] of Object.entries(ACTIVE_568)) assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), expected, file);
});

test('Admin bridge admission reconstructs active568 only from exact reviewed bytes and rejects unknown changes', async () => {
  const { adminCmsBridgePredecessor, adminCmsBridgePins, adminPreviewEditorLinkPredecessor } = await import('../../qa/admin-cms-web-bridge-successor.mjs');
  for (const [file, pin] of Object.entries(adminCmsBridgePins)) {
    const current = ownerReviewEditorSourcePredecessor(file, readFileSync(file, 'utf8'));
    const source = adminPreviewEditorLinkPredecessor(file, current);
    assert.equal(createHash('sha256').update(source).digest('hex'), pin.after, file);
    assert.equal(createHash('sha256').update(adminCmsBridgePredecessor(file, current)).digest('hex'), pin.before, file);
    for (const changed of [current + '\n', current.replace(/\S/, 'X'), current.replace('isPublicCopyScopeAvailable', 'unguardedScope')]) {
      if (changed === source) continue;
      assert.equal(adminCmsBridgePredecessor(file, changed), changed);
    }
  }
});

// Four exact old presentation owners and three images are retired only on Admin.
test('retired Admin tool UI stays absent and historical records reject reintroduction or resealing', async () => {
  const { assertRetiredAdminToolUi, retiredAdminToolUi, retiredAdminToolAssets } = await import('../../qa/admin-retired-tool-ui-proof.mjs');
  assert.equal(Object.keys(retiredAdminToolUi).length, 4);
  for (const [file, digests] of Object.entries(retiredAdminToolUi)) {
    for (const digest of digests) assert.equal(assertRetiredAdminToolUi(file, digest), true);
    assert.throws(() => assertRetiredAdminToolUi(file, '0'.repeat(64)));
    assert.throws(() => assertRetiredAdminToolUi(file, digests[0], () => true));
  }
  assert.equal(assertRetiredAdminToolUi('unreviewed.tsx'), false);
  for (const asset of retiredAdminToolAssets) assert.equal(existsSync(asset), false, asset);
});

test('Admin preview location metadata keeps all eleven scope keys and rejects lost, unknown or malformed fields', () => {
  const locations = JSON.parse(readFileSync('lib/content/public-copy-locations.json', 'utf8'));
  const validate = (value: typeof locations) => {
    assert.deepEqual(Object.keys(value).sort(), Object.keys(registry.PUBLIC_COPY_SCOPES).sort());
    for (const [scope, config] of Object.entries(registry.PUBLIC_COPY_SCOPES) as Array<[string, { defaults: Record<string, string> }]>) {
      const map = value[scope];
      assert.deepEqual(Object.keys(map.entries).sort(), Object.keys(config.defaults).sort(), scope);
      for (const [index, location] of Object.values(map.entries).entries() as ArrayIterator<[number, { section: string; kind: string; visible: boolean; order: number }]>) {
        assert.deepEqual(Object.keys(location).sort(), ['kind', 'order', 'section', 'visible']);
        assert.ok(map.sections.includes(location.section));
        assert.ok(location.kind.length > 0);
        assert.equal(typeof location.visible, 'boolean');
        assert.equal(location.order, index);
      }
    }
  };
  validate(locations);
  const missing = structuredClone(locations); delete missing.about.entries['about.father.heading'];
  assert.throws(() => validate(missing));
  const unknown = structuredClone(locations); unknown.about.entries['about.unreviewed'] = unknown.about.entries['about.father.heading'];
  assert.throws(() => validate(unknown));
  const malformed = structuredClone(locations); malformed.toolsHub.entries['toolsHub.hero.title'].visible = 'true';
  assert.throws(() => validate(malformed));
});


test('actual private preview links every allowed copy scope to its existing Studio structure pane', async () => {
  const body = () => createElement("div", null, "preview-content");
  const mocks = new Map<string, unknown>([
    ["@/features/home/v5/V5Home", { __esModule: true, default: body }],
    ["@/components/ui/PublicCopyProvider", { PublicCopyProvider: ({ children }: { children?: ReactNode }) => children }],
    ["@/lib/admin/public-copy-preview", { getPublicCopyPreview: async () => ({ copy: {}, site: {}, home: {}, dataset: "uat", seo: null }) }],
    ["@/lib/content/sanity", { getPrimaryAuthorPreviewProfile: async () => null }],
  ]);
  for (const [path, name] of [
    ["@/features/ci-planning/page", "renderCiPlanningPage"], ["@/features/financial-health-check/page", "renderFinancialHealthCheckPage"],
    ["@/features/blog/pages/BlogArchivePage", "renderBlogPage"], ["@/features/legal/pages/PrivacyPage", "renderPrivacyPage"],
    ["@/features/legal/pages/CookiePolicyPage", "renderCookiePolicyPage"], ["@/features/money-story/page", "renderMoneyStoryPage"],
    ["@/features/investment-allocation/page", "renderInvestmentAllocationContent"], ["@/features/about/page", "renderAboutPage"], ["@/features/tools-hub/page", "renderToolsHubPage"],
  ]) mocks.set(path, { [name]: body });
  const Preview = loadFixtureModule("apps/admin/app/(control-plane)/content/website-preview/page.tsx", { mocks }).default;
  for (const scope of Object.keys(registry.PUBLIC_COPY_SCOPES)) {
    const html = renderToStaticMarkup(await Preview({ searchParams: Promise.resolve({ scope }) }));
    assert.ok(html.includes(`href="/studio/structure/public-pages;copy-${scope}"`), scope);
    assert.ok(!html.includes(`href="/studio/intent/edit/id=publicPageCopy-${scope}-th`));
  }
  await assert.rejects(Preview({ searchParams: Promise.resolve({ scope: "../../invalid" }) }), /fixture-not-found/);
  const structure = readFileSync("cms/sanity/config/structure.ts", "utf8");
  assert.ok(structure.includes('S.listItem().id("public-pages")'));
  assert.ok(structure.includes('S.listItem().id(`copy-${scope}`)'));
  assert.ok(structure.includes('.documentId(publicCopyDocumentId(scope as keyof typeof PUBLIC_COPY_SCOPES))'));
});
