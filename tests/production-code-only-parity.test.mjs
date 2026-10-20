import { assertNativeProviderRetirement, assertReviewedNativeShadowTest, assertReviewedWebUatBuildProfile } from '../qa/phase3-native-provider-proof.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { productionBaselineSource, productionBaselineBytes, assertReviewedGoogleSessionProduction } from '../qa/phase1-source-proof.mjs';
import { assertPhase3AdminNativeBoundaries, phase3AdminNativeEntries } from '../qa/phase3-admin-native-boundaries-proof.mjs';
import { assertPhase3AdminContracts, phase3AdminEntries } from '../qa/phase3-admin-contracts-proof.mjs';
import { assertPhase2AdminComposition, phase2AdminEntries } from '../qa/phase2-admin-modularity-proof.mjs';
import { assertPhase2FoundationSource, phase2FoundationPath } from '../qa/phase2-css-source-contract.mjs';

const root = resolve(import.meta.dirname, '..');
const read = file => productionBaselineSource(file);
const sha = value => createHash('sha256').update(value).digest('hex');
const proof = JSON.parse(read('qa/production-code-only-parity.json'));
const reviewedReleaseOwners = {
  "cms/sanity/schema/documents/author.ts": [
    "c5b003fc4f919911381939eb8bccfcaa4246d8212bab338f33f8cea0c12d3559",
    "574550ddb81476bdb881434346f3c4100718b6a08270252b9abe85a5e3471133"
  ],
  "cms/sanity/schema/objects/portable-text.ts": [
    "b2fcb0fbb052a3c613d3e686de3f7e1087bc30c4a948cc9e56348524abdd0803",
    "7abf78ee4b4877cb81a03ee6c98fb3dff2f7303f5c9c359bc5e77aee765f9f52"
  ]
};

const lineCopyOriginRoutes = ["generate", "improve", "publish"].map(action => `apps/admin/app/api/admin/content/[id]/line-copy/${action}/route.ts`);
function assertReviewedLineCopyOriginRepair(file, digest, source) {
  assert.ok(lineCopyOriginRoutes.includes(file), 'only three reviewed LINE routes are admitted');
  for (const [accepted, original] of [
    ['import { getAdminEnvironment } from "@/lib/admin/environment";\nimport { isPostPublishAdminOriginAllowed as isLineCopyAdminOriginAllowed } from "@/lib/admin/seo-intelligence/post-publish-origin";', 'import { isSameOriginAdminMutation } from "@/lib/admin/auth-config";'],
    ['isLineCopyAdminOriginAllowed(request, process.env, getAdminEnvironment())', 'isSameOriginAdminMutation(request.url, request.headers.get("origin"))'],
  ]) {
    assert.equal(source.split(accepted).length, 2, file + ': exact origin replacement occurs once');
    source = source.replace(accepted, original);
  }
  assert.equal(sha(source), digest, file + ': every other original byte remains protected');
}

const reviewedArticleOptimizationOwners = {
  'cms/sanity/policy/article-publication.ts': [
    '802db995aec376a4696d1ea3962f39a40332415a2f1438c0ffaebc8c1ceccd04',
    '8df23792e5d8774e1f74405e5dbc0f8805cc02ee88d419cbcdecad54b2c0deb2',
  ],
  'cms/sanity/policy/article-publish-action.tsx': [
    '55009ab64b6ee3996238dcd776e69265db49bd0a3c208d4fcb9eab9f99705002',
    '045c84dd3309216f3bad97ee8e4696c0a5f2f1d353dc18f31507a7c6aa05a826',
  ],
  'cms/sanity/schema/documents/article.ts': [
    'c8659434b3686aa7badef41fa3c80e05232942c9acefbc8c5d1d7f5555b74670',
    '3e8a27c0429ae3f97b47829d7355d4e832db185db45cfd4f942089451fd74d27',
  ],
};
function assertReviewedArticleOptimization(file, digest, source) {
  assert.ok(Object.hasOwn(reviewedArticleOptimizationOwners, file), 'only three reviewed Article owners are admitted');
  assert.equal(digest, reviewedArticleOptimizationOwners[file][0], file + ': original protection is frozen');
  assert.equal(sha(source), reviewedArticleOptimizationOwners[file][1], file + ': exact reviewed explicit optimization owner');
}

test('original Production owners remain guarded alongside exact reviewed Google Connect feature sources', () => {
  assert.equal(Object.keys(proof.canonical).length, 48);
  for (const [file, digest] of Object.entries({ ...proof.canonical, ...proof.protected, ...proof.retainedVariants, ...proof.workerEntrySources })) {
    if (Object.hasOwn(reviewedReleaseOwners, file)) {
      assert.equal(digest, reviewedReleaseOwners[file][0], file + ': original protection is frozen');
      assert.equal(sha(readFileSync(resolve(root, file))), reviewedReleaseOwners[file][1], file + ': exact reviewed release owner');
    } else if (lineCopyOriginRoutes.includes(file)) {
      assertReviewedLineCopyOriginRepair(file, digest, readFileSync(resolve(root, file), 'utf8'));
    } else if (Object.hasOwn(reviewedArticleOptimizationOwners, file)) {
      assertReviewedArticleOptimization(file, digest, readFileSync(resolve(root, file), 'utf8'));
    } else if (file === 'cms/sanity/policy/studio-policy.ts') {
      const source = readFileSync(resolve(root, file), 'utf8');
      const accepted = '!["disabled", "native-neon"].includes(backend ?? "")';
      assert.equal(source.split(accepted).length, 2);
      assert.equal(sha(source.replace(accepted, 'backend !== "disabled"')), digest, 'only accepted scheduler backend predicate differs');
    } else if (file === 'features/admin/operations/DeploymentsPage.tsx') {
      assert.equal(digest, '3664b01ea11471d9c4d421adf82c206704ac7859b4503acc0e2a9e44bfd3271e', 'own original UI identity');
      const actual = readFileSync(resolve(root, file), 'utf8');
      const nativeLabel = 'const provider = hostinger ? "Hostinger Cloud Startup" : "ยังไม่ยืนยันผู้ให้บริการ";';
      const retiredLabel = 'const provider = hostinger ? "Hostinger Cloud Startup" : model.provider === "vercel" ? "Vercel" : "ยังไม่ยืนยันผู้ให้บริการ";';
      assert.equal(actual.split(nativeLabel).length, 2);
      assert.equal(sha(actual.replace(nativeLabel, retiredLabel)), digest, 'whole page changes only unreachable provider label');
    } else if (file === 'lib/admin/agent-os/privacy-routing.ts') {
      // Intentional strict privacy contract adoption; current source is the reviewed UAT policy.
      assert.equal(sha(readFileSync(resolve(root, file), 'utf8')), '227a394bccab9f0a65d83a273375f8fcc310bb9a0378dcf5d8e3663cc1a91691', file);
    } else if (file === 'scripts/build-provider.mjs') {
      assert.equal(digest, '2368b223e7fb9d8ccbae5f9c44340621346307363766e1a7fe2f8bce0cdc96f9', 'own frozen legacy builder identity');
      assert.equal(existsSync(resolve(root, file)), false, 'duplicate legacy dispatcher is retired');
      const scripts = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).scripts;
      assert.equal(scripts['build:hostinger'], 'npm run build --workspace @ccpun/web');
      assert.equal(JSON.parse(readFileSync(resolve(root, 'apps/web/package.json'), 'utf8')).scripts.build, 'node scripts/build-provider.mjs');
      assert.equal(assertNativeProviderRetirement('apps/web/scripts/build-provider.mjs', '35f61f91cbc11bcd463ba1d05d3fa91c5873cbdb7ffc81e53fd1bb44986d3c8e'), true, 'reviewed current canonical Web builder');
      assert.equal(assertNativeProviderRetirement('apps/admin/scripts/build-provider.mjs', 'a3fb133f632da4027996ec96976a912dd25e5402961fc16825d2e2050dcc31fe'), true, 'own native SWC body retained');
      assert.equal(scripts['test:hostinger'], 'node --test tests/hostinger-shadow-config.test.mjs');
      assert.equal(assertReviewedNativeShadowTest('361a2e85907145b763e6b2611e3a4092957f6f2c76ae8af23da1c2664a96ef32'), true, 'registered real npm workspace cwd and exit0/7 assertions');
    } else if (file === 'scripts/build-root.mjs') {
      const original = JSON.parse(readFileSync(resolve(root, 'qa/phase3-native-provider-parity.json'), 'utf8')).baselineSources[file];
      const actual = readFileSync(resolve(root, file), 'utf8');
      assert.equal(sha(original), digest, 'own original root dispatcher identity');
      const prior = actual
        .replace('  if (Object.entries(process.env).some(([key, value]) => key.startsWith("VERCEL_") && value?.trim())) throw new Error("UNSUPPORTED_PROVIDER_METADATA");\n', '  if (process.env.VERCEL_PROJECT_ID?.trim()) return;\n')
        .replace('  if (["vercel", "@workflow/world-vercel"].includes(process.env.WORKFLOW_TARGET_WORLD?.trim() ?? "")) throw new Error("UNSUPPORTED_WORKFLOW_WORLD");\n', '')
        .replace('if (provider && !["hostinger", "local"].includes(provider)) throw new Error("UNSUPPORTED_BUILD_PROVIDER");\n', '')
        .replace('if (provider === "hostinger" && !["web", "admin"].includes(role)) throw new Error("HOSTINGER_BUILD_ROLE_REQUIRED");\n', '');
      assert.equal(prior, original, 'only four reviewed native dispatch guards change');
      assert.equal(sha(actual), '00d8f879c1651f2c6e8f1c061ed187f47e29c7ce69b6887c4d627b20b10644d8', 'reviewed root CLI output evidence');
    } else if (file === 'apps/web/proxy.ts') {
      const original = JSON.parse(readFileSync(resolve(root, 'qa/phase3-native-provider-parity.json'), 'utf8')).baselineSources[file];
      const actual = readFileSync(resolve(root, file), 'utf8');
      assert.equal(sha(original), digest, 'own original Web proxy identity');
      assert.equal(actual, original.replace('    vercelRequestId: headers.get("x-vercel-id"),\n', ''), 'only retired optional crawler diagnostic is removed');
      assert.equal(sha(actual), 'aa2f049adf19bea587ff45ff61969e181e307ae2fbde904413cca53a86bd7e2f', 'reviewed own current Web proxy');
    } else if (['lib/runtime/deployment-identity.ts', 'lib/content/sanity-lane.ts', 'lib/deployment-environment.ts', 'proxy.ts', 'lib/runtime/deployment-contract.ts', 'apps/web/scripts/build-provider.mjs', 'apps/admin/scripts/build-provider.mjs'].includes(file)) assert.equal(assertNativeProviderRetirement(file, digest), true, file);
    else if (phase3AdminNativeEntries.includes(file)) assert.equal(assertPhase3AdminNativeBoundaries(file, digest), true, file);
    else if (phase3AdminEntries.includes(file)) assert.equal(assertPhase3AdminContracts(file, digest), true, file);
    else if (phase2AdminEntries.includes(file)) assert.equal(assertPhase2AdminComposition(file, digest), true, file);
    else if (file === phase2FoundationPath) assert.equal(assertPhase2FoundationSource(file, digest), true, file);
    else if (file === 'lib/runtime/deployment-lanes.mjs') assert.equal(assertReviewedWebUatBuildProfile(digest), true, file);
    else if (Object.hasOwn(proof.reviewedGoogleSessionProduction.retainedSources, file))
      assert.equal(assertReviewedGoogleSessionProduction(file, digest, proof, path => readFileSync(resolve(root, path), 'utf8'), 'production-admin'), true, file);
    else assert.equal(sha(productionBaselineBytes(file)), digest, file);
  }
  for (const file of ['features/investment-allocation', 'apps/web/app/tools/investment-allocation', 'apps/web/app/api/investment-allocation', 'lib/runtime/investment-availability.ts']) {
    assert.equal(existsSync(resolve(root, file)), false, file + ': unfinished tool must remain absent');
  }
});

test('LINE origin repair admission still rejects unrelated authorization edits and duplicate replacements', () => {
  const protectedSources = { ...proof.canonical, ...proof.protected, ...proof.retainedVariants, ...proof.workerEntrySources };
  for (const file of lineCopyOriginRoutes) {
    const source = readFileSync(resolve(root, file), 'utf8');
    const changedRole = source.replace('identity.role !== "owner"', 'identity.role !== "editor"');
    assert.notEqual(changedRole, source);
    assert.throws(() => assertReviewedLineCopyOriginRepair(file, protectedSources[file], changedRole));
    assert.throws(() => assertReviewedLineCopyOriginRepair(file, protectedSources[file], source + '\nisLineCopyAdminOriginAllowed(request, process.env, getAdminEnvironment());\n'));
  }
});

test('Article optimization admission rejects original proof drift and changes to approval, category, noindex or intent guards', () => {
  const file = 'cms/sanity/policy/article-publication.ts';
  const sources = { ...proof.canonical, ...proof.protected, ...proof.retainedVariants, ...proof.workerEntrySources };
  const source = readFileSync(resolve(root, file), 'utf8');
  assert.throws(() => assertReviewedArticleOptimization('unknown.ts', sources[file], source));
  assert.throws(() => assertReviewedArticleOptimization(file, 'unknown', source));
  for (const [original, replacement] of [
    ['draft.review?.status !== "approved"', 'draft.review?.status !== "drafting"'],
    ['draft.category?._ref !== published.category?._ref', 'false'],
    ['noindex: false', 'noindex: true'],
    ['confirmOptimization && hasArticleContentChanges(draft, published)', 'hasArticleContentChanges(draft, published)'],
    ['delete document.contentOptimizedAt;', ''],
  ]) {
    const changed = source.replace(original, replacement);
    assert.notEqual(changed, source, original + ': negative probe must change the actual owner');
    assert.throws(() => assertReviewedArticleOptimization(file, sources[file], changed));
  }
  const actionFile = 'cms/sanity/policy/article-publish-action.tsx';
  const action = readFileSync(resolve(root, actionFile), 'utf8');
  for (const [original, replacement] of [
    ['optimization: false', 'optimization: true'],
    ['draft._rev !== confirmation.draft', 'false'],
    ['published?._rev !== confirmation.published', 'false'],
  ]) {
    const changed = action.replace(original, replacement);
    assert.notEqual(changed, action);
    assert.throws(() => assertReviewedArticleOptimization(actionFile, sources[actionFile], changed));
  }
  const schemaFile = 'cms/sanity/schema/documents/article.ts';
  const schema = readFileSync(resolve(root, schemaFile), 'utf8');
  const editable = schema.replace(/(name: "contentOptimizedAt",[\s\S]*?readOnly:) true/, '$1 false');
  assert.notEqual(editable, schema);
  assert.throws(() => assertReviewedArticleOptimization(schemaFile, sources[schemaFile], editable));
});

test('critical first-paint CSS and three layout compositions preserve the exact Production baseline', () => {
  const css = read('components/styles/critical-foundation.ts').match(/= `([\s\S]*?)`;\s*$/)?.[1];
  assert.equal(Buffer.byteLength(css), proof.criticalCssBytes);
  assert.equal(sha(css), proof.criticalCssSha256);
  for (const [file, digest] of Object.entries(proof.layouts)) {
    const source = read(file);
    assert.equal((source.match(/__html: CRITICAL_FOUNDATION_CSS/g) ?? []).length, 1, file);
    const baseline = source.replace('import { CRITICAL_FOUNDATION_CSS } from "@/components/styles/critical-foundation";\n', '')
      .replace('__html: CRITICAL_FOUNDATION_CSS', '__html: `' + css + '`');
    assert.equal(sha(baseline), digest, file);
  }
});

test('moving global CSS changes only import resolution and retains all declaration bodies in order', () => {
  const foundation = read('components/styles/global-foundation.css');
  assert.equal(sha(foundation.slice(foundation.indexOf('/*'))), proof.globalBodySha256);
});


test('only eight unreachable class declarations are removed; every retained CSS declaration stays ordered', () => {
  for (const [file, { baselineSource, selectors }] of Object.entries(proof.removedDeadStyles)) {
    let expected = baselineSource;
    for (const selector of selectors) {
      const rule = new RegExp('\\.' + selector + '\\s*\\{[^{}]*\\}', 'g');
      assert.equal([...expected.matchAll(rule)].length, 1);
      expected = expected.replace(rule, '');
    }
    assert.equal(read(file), expected.replace(/^[ \t]+$/gm, ""), file);
  }
});


test('Production Google session admission rejects unknown lanes, source bodies, ancestors, proof and coverage', () => {
  const record = proof.reviewedGoogleSessionProduction, reader = path => readFileSync(resolve(root, path), 'utf8');
  const file = 'lib/admin/seo-intelligence/google-data-auth.ts', original = record.retainedSources[file].originalSha256;
  for (const [path, pins] of Object.entries(record.retainedSources))
    assert.equal(assertReviewedGoogleSessionProduction(path, pins.originalSha256, proof, reader, 'production-admin'), true);
  for (const environment of ['admin-uat', 'web-uat', 'local-production', 'unknown', undefined])
    assert.throws(() => assertReviewedGoogleSessionProduction(file, original, proof, reader, environment));
  assert.throws(() => assertReviewedGoogleSessionProduction('unknown.ts', original, proof, reader, 'production-admin'));
  assert.throws(() => assertReviewedGoogleSessionProduction(file, 'unknown', proof, reader, 'production-admin'));
  for (const path of Object.keys(record.currentSourceDigests))
    assert.throws(() => assertReviewedGoogleSessionProduction(file, original, proof, name => reader(name) + (name === path ? '//tamper' : ''), 'production-admin'));
  for (const mutate of [
    value => { value.reviewedGoogleSessionProduction.baselineCommit = 'unknown'; },
    value => { value.reviewedGoogleSessionProduction.retainedSources[file].baselineSha256 = 'unknown'; },
    value => { value.reviewedGoogleSessionProduction.retainedSources[file].originalSha256 = 'unknown'; },
    value => { delete value.reviewedGoogleSessionProduction.currentSourceDigests[file]; },
    value => { value.reviewedGoogleSessionProduction.currentSourceDigests['unknown.ts'] = 'unknown'; },
    value => { value.reviewedGoogleSessionProduction.outputTests.pop(); },
    value => { value.protected[file] = 'unknown'; },
  ]) {
    const changed = structuredClone(proof); mutate(changed);
    assert.throws(() => assertReviewedGoogleSessionProduction(file, original, changed, reader, 'production-admin'));
  }
});


test('P2 migrated Google owners use the same reviewed ancestor and current-body admission', () => {
  const migrations = JSON.parse(readFileSync(resolve(root, 'qa/root-runtime-owner-migration.json'), 'utf8')).pairs;
  const selected = migrations.filter(item => Object.hasOwn(proof.reviewedGoogleSessionProduction.retainedSources, item.canonical));
  assert.deepEqual(selected.map(item => item.canonical).sort(), [
    'apps/admin/app/api/admin/seo/opportunities/sync/ga4/route.ts',
    'apps/admin/app/api/admin/seo/providers/readiness/route.ts',
  ]);
  const reader = file => readFileSync(resolve(root, file), 'utf8');
  for (const item of selected) {
    assert.equal(reader(item.legacy), item.wrapper, 'root adapter stays unchanged');
    assert.equal(assertReviewedGoogleSessionProduction(item.canonical, item.baselineSha256, proof, reader, 'production-admin'), true);
    assert.throws(() => assertReviewedGoogleSessionProduction(item.canonical, 'unknown', proof, reader, 'production-admin'));
    assert.throws(() => assertReviewedGoogleSessionProduction(item.canonical, item.baselineSha256, proof,
      file => reader(file) + (file === item.canonical ? '//tamper' : ''), 'production-admin'));
  }
});
