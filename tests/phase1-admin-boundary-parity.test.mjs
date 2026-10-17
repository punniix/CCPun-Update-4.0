import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';
import { assertInheritedUatFixtureSources, assertInheritedUatOutput } from '../qa/phase1-source-proof.mjs';
const require = createRequire(import.meta.url);
const React = require('react');
const runtime = require('react/jsx-runtime');
const { renderToStaticMarkup } = require('react-dom/server');
const proof = JSON.parse(readFileSync('qa/phase1-admin-api-parity.json', 'utf8'));
const originals = new Map(Object.entries(proof.originalSources));
async function render(file, old, c = {}) {
  const trace = []; const actions = [];
  const jsxRuntime = Object.fromEntries(['jsx', 'jsxs', 'Fragment'].map(name => [name, name === 'Fragment' ? runtime.Fragment : (type, props, ...rest) => {
    if (type === 'form' && props.action) actions.push(props.action);
    if (type === 'button' && props.onClick) actions.push(props.onClick);
    return runtime[name](type, props, ...rest);
  }]));
  const mocks = new Map([
    ['react/jsx-runtime', jsxRuntime], ['@/auth', {
      auth: async () => { trace.push('auth'); return c.session ? { user: { role: 'owner' } } : null; },
      isAdminAuthConfigured: () => { trace.push('configured'); return c.configured !== false; },
      signIn: async (...args) => { trace.push(['sign-in', ...args]); },
    }], ['@/lib/admin/environment', { getEnvironmentLabel: () => { trace.push('environment-label'); return 'fixture-environment'; }, getAdminEnvironment: () => { trace.push('environment'); return c.environment ?? 'production-admin'; }, isStudioDataPlaneAllowed: (...args) => { trace.push(['studio-lane', ...args]); return c.studioAllowed !== false; } }],
    ['@/lib/admin/capability-profile', {
      adminCapabilityLandingPath: () => { trace.push('landing'); return c.profile === 'editorial' ? '/content/articles/' : '/dashboard/'; },
      safeAdminCapabilityReturnPath: value => { trace.push(['safe-capability-return', value]); return value?.startsWith('/content/') ? value : null; },
      getAdminCapabilityProfile: () => { trace.push('capability'); return c.profile ?? 'full'; },
    }], ['@/lib/deployment-environment', { IS_REVIEW_ENVIRONMENT: c.review !== false }],
    ['next-sanity/studio', { metadata: { title: 'fixture-studio', robots: { index: false } }, viewport: { width: 'device-width' } }],
    ['@/sanity.config', { sanityStudioConfig: c.config === undefined ? { fixture: true } : c.config }],
    ['sanity', { Studio: ({ config, unstable_globalStyles }) => React.createElement('div', { 'data-fixture-studio': JSON.stringify(config), 'data-global-styles': String(unstable_globalStyles) }) }],
  ]);
  const route = loadFixtureModule(file, { sources: old ? originals : new Map(), mocks, globals: { process: { env: c.missingConfig ? {} : { NEXT_PUBLIC_SANITY_PROJECT_ID: 'fixture-project', NEXT_PUBLIC_SANITY_DATASET: 'fixture-dataset' } }, console: { warn: () => {} } } });
  let result;
  try {
    const tree = await route.default({ searchParams: Promise.resolve({ callbackUrl: c.callbackUrl, error: c.error }), reset: () => trace.push('reset'), error: new Error('fixture-sensitive-provider-error') });
    result = { html: renderToStaticMarkup(tree), metadata: route.metadata ?? null, viewport: route.viewport ?? null };
    assert.equal(result.html.includes('fixture-sensitive-provider-error'), false);
    for (const action of actions) await action();
  } catch (error) { result = { thrown: { name: error.name, message: error.message, url: error.url ?? null, code: error.code ?? null } }; }
  return { result, trace };
}
test('login presentation, metadata, sanitized returns, redirects and synthetic Google action remain identical per lane', async () => {
  for (const file of ['app/(control-plane-auth)/login/page.tsx', 'apps/admin/app/(control-plane-auth)/login/page.tsx']) {
    for (const c of [{}, { configured: false }, { error: 'fixture-error' }, { session: true }, { profile: 'editorial' }, { profile: 'editorial', session: true }, { callbackUrl: '/content/articles/' }, { callbackUrl: 'https://evil.example/' }, { profile: 'editorial', callbackUrl: 'https://evil.example/' }]) assert.deepEqual(await render(file, false, c), await render(file, true, c), file + ':' + JSON.stringify(c));
  }
});
test('error/reset and both NotFound layouts keep exact markup and private-error suppression', async () => {
  const ownership = JSON.parse(readFileSync('qa/phase1-source-ownership.json', 'utf8'));
  assertInheritedUatFixtureSources(ownership, file => readFileSync(file, 'utf8'));
  for (const file of ['app/(control-plane)/error.tsx', 'apps/admin/app/(control-plane)/error.tsx', 'app/(control-plane)/not-found.tsx', 'apps/admin/app/(control-plane)/not-found.tsx', 'app/(control-plane-error)/admin-not-found/page.tsx', 'apps/admin/app/(control-plane-error)/admin-not-found/page.tsx']) {
    const current = await render(file, false), original = await render(file, true);
    if (file === 'app/(control-plane)/error.tsx' || file === 'apps/admin/app/(control-plane)/error.tsx') {
      // Lossless flattening of the known render envelope; every result field and trace remains checked.
      const flatten = value => ({ ...value.result, trace: value.trace });
      assert.equal(typeof current.result.html, 'string');
      assert.deepEqual(current.trace, ['reset']);
      const key = { kind: 'boundary-error', file };
      assertInheritedUatOutput(flatten(current), flatten(original), key, ownership);
      assert.throws(() => assertInheritedUatOutput({ ...flatten(current), html: current.result.html + 'tampered' }, flatten(original), key, ownership), /C645 full output drift/);
      assert.throws(() => assertInheritedUatOutput({ ...flatten(current), trace: [] }, flatten(original), key, ownership), /non-DOM invariant/);
    } else assert.deepEqual(current, original, file);
  }
});
test('Studio preserves guard order, per-lane configuration errors, metadata/CSS and actual client export ownership', async () => {
  for (const file of ['app/studio/[[...tool]]/page.tsx', 'apps/admin/app/studio/[[...tool]]/page.tsx']) for (const c of [{}, { review: false }, { studioAllowed: false }, { missingConfig: true }, { config: null }, { config: {} }]) assert.deepEqual(await render(file, false, c), await render(file, true, c), file + ':' + JSON.stringify(c));
  const canonical = 'apps/admin/app/studio/[[...tool]]/studio-client';
  const sentinel = () => React.createElement('div', { 'data-fixture-export': true });
  const forwarded = loadFixtureModule('app/studio/[[...tool]]/studio-client.tsx', { mocks: new Map([['@/' + canonical, { __esModule: true, default: sentinel }]]) });
  assert.equal(forwarded.default, sentinel, 'root exposes the actual canonical default export');
  assert.match(readFileSync('app/studio/[[...tool]]/studio-client.tsx', 'utf8'), /^"use client";/);
  assert.equal(readFileSync(canonical + '.tsx', 'utf8'), proof.originalSources[canonical + '.tsx'], 'canonical client/config/CSS code is byte-identical');
});
test('three robots entries preserve exact predicates, ordered private exceptions and indexing output', () => {
  for (const file of ['app/robots.ts', 'apps/admin/app/robots.ts', 'apps/web/app/robots.ts']) {
    for (const review of [false, true]) for (const environment of ['production-admin', 'development', 'admin-uat', 'unknown']) for (const blockWeb of [false, true]) {
      const observe = old => {
        const trace = []; const mocks = new Map([
          ['@/lib/admin/environment', { getAdminEnvironment: () => { trace.push('environment'); return environment; } }],
          ['@/lib/admin/routes', { ADMIN_PAGE_PREFIXES: ['/dashboard', '/content', '/seo'] }],
          ['@/lib/routing/private-surfaces', { CONTROL_PLANE_PAGE_PREFIXES: ['/dashboard', '/content', '/seo'] }],
          ['@/lib/deployment-environment', { IS_REVIEW_ENVIRONMENT: review }],
          ['@/apps/web/runtime-environment', { shouldBlockWebIndexing: () => { trace.push('web-indexing'); return blockWeb; } }],
        ]);
        const route = loadFixtureModule(file, { sources: old ? originals : new Map(), mocks });
        return { result: route.default(), dynamic: route.dynamic ?? null, trace };
      };
      assert.deepEqual(observe(false), observe(true), JSON.stringify({ file, review, environment, blockWeb }));
    }
  }
});
