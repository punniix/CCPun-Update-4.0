import { ownerReviewSourcePredecessor } from '../qa/v5-owner-review-source-successor.mjs';
import { inlineCssObservationPredecessor } from '../qa/v5-inline-css-proof.mjs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { WEB_REDIRECTS } from '../lib/runtime/web-build-config.mjs';

const { NextResponse } = createRequire(import.meta.url)('next/server');
const baselineSha = '1843dbc11a1cd400f89a32a333516ee2e0a53223';
const files = ['apps/web/next.config.ts', 'lib/security-policy.ts', 'apps/web/proxy.ts'];
const helperFiles = ['lib/runtime/security-headers.mjs', 'lib/runtime/web-build-config.mjs'];
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const current = Object.fromEntries([...files, ...helperFiles].map((file) => [file, read(file)]));
const production = {
  NODE_ENV: 'production', CCPUN_DEPLOYMENT_PROVIDER: 'hostinger',
  CCPUN_DEPLOYMENT_ROLE: 'web', CCPUN_APP_ENV: 'production',
  NEXT_PUBLIC_SANITY_PROJECT_ID: 'kyfxgjnq', NEXT_PUBLIC_SANITY_DATASET: 'production',
  CCPUN_UAT_MODE: '0',
};
const webProject = 'prj_dxwjITkd0av5QiJQv2snUlIASUWu';
const adminProject = 'prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN';
const fixtures = [
  ['hostinger-live', {}],
  ['hostinger-candidate', { CCPUN_UAT_MODE: '1' }],
  ['hostinger-uat', { CCPUN_APP_ENV: 'web-uat', NEXT_PUBLIC_SANITY_PROJECT_ID: 'ccb9lnw5', NEXT_PUBLIC_SANITY_DATASET: 'uat' }],
  ['wrong-hostinger-role', { CCPUN_DEPLOYMENT_ROLE: 'admin' }],
  ['conflicting-project', { VERCEL_PROJECT_ID: webProject }],
  ['wrong-sanity-lane', { NEXT_PUBLIC_SANITY_DATASET: 'uat' }],
  ['vercel-live', { CCPUN_DEPLOYMENT_PROVIDER: 'vercel', VERCEL_ENV: 'production', VERCEL_PROJECT_ID: webProject }],
  ['vercel-preview', { CCPUN_APP_ENV: '', CCPUN_DEPLOYMENT_PROVIDER: 'vercel', VERCEL_ENV: 'preview', VERCEL_PROJECT_ID: webProject, NEXT_PUBLIC_SANITY_PROJECT_ID: 'ccb9lnw5', NEXT_PUBLIC_SANITY_DATASET: 'uat' }],
  ['wrong-vercel-project', { CCPUN_APP_ENV: '', CCPUN_DEPLOYMENT_PROVIDER: 'vercel', VERCEL_ENV: 'preview', VERCEL_PROJECT_ID: adminProject }],
  ['local-development', { CCPUN_APP_ENV: 'development', CCPUN_DEPLOYMENT_PROVIDER: 'local', NODE_ENV: 'development', NEXT_PUBLIC_SANITY_PROJECT_ID: 'ccb9lnw5', NEXT_PUBLIC_SANITY_DATASET: 'uat' }],
  ['local-uat', { CCPUN_APP_ENV: 'local-uat', CCPUN_DEPLOYMENT_PROVIDER: 'local' }],
  ['local-production', { CCPUN_APP_ENV: 'local-production', CCPUN_DEPLOYMENT_PROVIDER: 'local' }],
  ['unknown-lane', { CCPUN_APP_ENV: 'not-a-lane' }],
  ['unknown-provider', { CCPUN_DEPLOYMENT_PROVIDER: 'not-a-provider' }],
  ['trimmed-identity', { CCPUN_APP_ENV: ' Production ', CCPUN_DEPLOYMENT_PROVIDER: ' HOSTINGER ', CCPUN_DEPLOYMENT_ROLE: ' WEB ', NEXT_PUBLIC_SANITY_PROJECT_ID: ' kyfxgjnq ', NEXT_PUBLIC_SANITY_DATASET: ' production ' }],
  ['nonexact-review-flag', { CCPUN_UAT_MODE: ' true ' }],
  ['spaced-review-flag', { CCPUN_UAT_MODE: ' 1 ' }],
  ['invalid-sanity-project', { NEXT_PUBLIC_SANITY_PROJECT_ID: 'bad.project' }],
];
const tax = '/blog/personal-finance/personal-income-tax-calculation-2569';
const paths = [
  '/', '/ci-planning?from=a%26b', tax, `${tax}/`, `${tax}/nested/?q=x%2Fy`, `${tax}/file.json`, `${tax}-extra/`,
  '/living-benefits', '/living-benefits/', '/living-benefits/old/?q=x%2Fy',
  '/tools/fhc/', '/financial-advisor/', '/financial-advisor-extra/',
  '/unknown-route', '/unknown-route/', '/api/line/webhook', '/api/line/webhook/',
  '/login/', '/dashboard/', '/robots.txt', '/sitemap.xml', '/llms.txt',
  '/.well-known', '/.well-known/', '/.well-known/security.txt', '/.well-known/extensionless',
  '/_next/image/?url=%2Ffavicon.png&w=32&q=75', '/_next/static/font.woff2', '/favicon.png/?q=1',
];

function evaluate(source, bindings, result) {
  const javascript = stripTypeScriptTypes(source)
    .replace(/^import[\s\S]*?;\n/gm, '')
    .replace(/^export \{.*\} from .*$/gm, '')
    .replace(/^export default /gm, 'const defaultExport = ')
    .replace(/^export /gm, '');
  return runInNewContext(`${javascript}\n(${result});`, bindings);
}

async function observe(sources, overrides) {
  // Hermetic public values only; never inherit or inspect provider credentials.
  const env = { ...production, ...overrides };
  let contentEnvironment = env.CCPUN_APP_ENV?.trim().toLowerCase();
  if (!contentEnvironment) {
    contentEnvironment = env.VERCEL_PROJECT_ID === webProject
      ? env.VERCEL_ENV === 'preview' ? 'web-uat' : env.VERCEL_ENV === 'production' ? 'production' : 'unknown'
      : env.VERCEL_PROJECT_ID === adminProject
        ? env.VERCEL_ENV === 'preview' ? 'admin-uat' : env.VERCEL_ENV === 'production' ? 'production-admin' : 'unknown'
        : env.VERCEL_PROJECT_ID ? 'unknown' : 'development';
  }
  // Existing runtime review input stays distinct from the config's Web-only input.
  const review = env.CCPUN_UAT_MODE === '1' || ['development', 'web-uat', 'local-uat', 'local-production', 'admin-uat', 'production-admin'].includes(contentEnvironment);
  const process = { env, cwd: () => '/ccpun-parity/apps/web' };
  const sharedSecurity = sources['lib/runtime/security-headers.mjs']
    ? evaluate(sources['lib/runtime/security-headers.mjs'], { process }, '({ buildNextSecurityHeaders, shouldEnforceHttps })') : {};
  const sharedWeb = sources['lib/runtime/web-build-config.mjs']
    ? evaluate(sources['lib/runtime/web-build-config.mjs'], { process }, '({ resolveWebEnvironment, isWebSanityLaneAllowed, TAX_SLUG_MIGRATION, WEB_REDIRECTS })') : {};
  const security = evaluate(sources['lib/security-policy.ts'], { process, IS_REVIEW_ENVIRONMENT: review, ...sharedSecurity }, '({ SECURITY_POLICY, SECURITY_HEADERS })');
  const config = evaluate(sources['apps/web/next.config.ts'], { process, path, ...sharedSecurity, ...sharedWeb }, 'defaultExport');
  const proxy = evaluate(sources['apps/web/proxy.ts'], {
    process, URL, NextResponse, IS_REVIEW_ENVIRONMENT: review, ...sharedWeb,
    SECURITY_HEADERS: security.SECURITY_HEADERS, observeAiCrawlerRequest: () => {},
  }, '({ proxy: defaultExport, hostingerRedirectUrl, config })');
  const requests = paths.map((pathname) => new Request(`https://candidate.example${pathname}`));
  requests.push(
    new Request(`https://candidate.example${tax}?x=1`, { method: 'POST' }),
    new Request('https://candidate.example/tools/fhc/?q=1', { method: 'POST' }),
    new Request('https://candidate.example/file.json/', { headers: { 'x-nextjs-data': '1' } }),
    new Request('https://candidate.example/file.json/'),
  );
  const responses = requests.map((request) => {
    const response = proxy.proxy(request);
    return {
      url: request.url, method: request.method, data: request.headers.has('x-nextjs-data'),
      status: response.status, headers: Object.fromEntries(response.headers),
      helperDestination: proxy.hostingerRedirectUrl(request)?.href ?? null,
    };
  });
  return JSON.parse(JSON.stringify({ config, configuredHeaders: await config.headers(), rewrites: await config.rewrites(), redirects: await config.redirects(), runtimeSecurity: security, matcher: proxy.config, responses }));
}

// Frozen full-output hashes generated from the immutable Production source above.
// --print-baseline reads Git objects only and never updates this file or any config.
const expected = {
  'hostinger-live': 'f2984a1f0813d708a7c6e6da7d727715ed3ce101646905258633da60ef78a2b3',
  'hostinger-candidate': 'ecd56136e205a8ec2bb301a35ab7467225fc953dbe309c22a77f770fc4f1c229',
  'hostinger-uat': 'cf4afd298bdb7249538fdbd03b44f3005d9c402d7f984cc9a9d65b9e82f20f0d',
  'wrong-hostinger-role': '92015a1c74f95b4ba11c5cd4c6b1bc302bd70bfe472bb61fd6567d159ca0a89c',
  'conflicting-project': '92015a1c74f95b4ba11c5cd4c6b1bc302bd70bfe472bb61fd6567d159ca0a89c',
  'wrong-sanity-lane': '92015a1c74f95b4ba11c5cd4c6b1bc302bd70bfe472bb61fd6567d159ca0a89c',
  'vercel-live': '72e7460c0f39332f80f80a309701e938e0b0d406961078fe886a08b454d62d75',
  'vercel-preview': '4112b21bf52123526d44496cfc0257d53ed67e6d10383d5be96025233dc6e60f',
  'wrong-vercel-project': 'ed9b5eee0a4a8ca23bba188cec19c0ecb957c728c8dae0ec9ff3b7030dde74e0',
  'local-development': 'beb11292b13930dd54de130253886a645cddfe00be9c52c66c8675a0d1232e12',
  'local-uat': '085b4125a864d6f5e4d00bce656be12fbfb328ca81580e1dd5150245c6acfe76',
  'local-production': '085b4125a864d6f5e4d00bce656be12fbfb328ca81580e1dd5150245c6acfe76',
  'unknown-lane': '95725513b998295de89ac9926f79d136293c788f33cfba2e825ab3ccb0188ec1',
  'unknown-provider': '307a527a2d3a26e0490b3c67750449266fd97f4aa0b0fce80d39a0ea2e6d4500',
  'trimmed-identity': '1f10e3cf58b959b3e2a2ce9869eb04118bb3fb912247058deab423901d5c5d16',
  'nonexact-review-flag': 'f2984a1f0813d708a7c6e6da7d727715ed3ce101646905258633da60ef78a2b3',
  'spaced-review-flag': 'f2984a1f0813d708a7c6e6da7d727715ed3ce101646905258633da60ef78a2b3',
  'invalid-sanity-project': '60071ea1f53f3793bced2a600dd9404406f2741a8718344d934628bea785049a',
};
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Reviewed 2026-10-24 (fix/ga4-events-outage-20261024): Hostinger now matches
// WEB_REDIRECTS against the slash-normalised path before the trailing-slash 308,
// so a slashless legacy URL reaches its final URL in one hop. Assert that exact
// delta, then restore the baseline's first hop so every other byte of the frozen
// output (config, CSP, headers, all other redirects) is still compared.
function baselineFirstHop(observation) {
  // The exact reviewed WebP-only config restores only its format preference for historic output checks.
  const currentSource = current['apps/web/next.config.ts'];
  const priorSource = ownerReviewSourcePredecessor('apps/web/next.config.ts', currentSource);
  if (priorSource !== currentSource) {
    assert.deepEqual(observation.config.images.formats, ['image/webp']);
    observation = { ...observation, config: { ...observation.config, images: { ...observation.config.images, formats: ['image/avif', 'image/webp'] } } };
  }
  const responses = observation.responses.map((response) => {
    const url = new URL(response.url);
    const redirect = WEB_REDIRECTS.find(({ prefix }) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`));
    const legacyAddSlash = /\/[^/.]+$/.test(url.pathname);
    const legacyStripSlash = !response.data && /\/[^/]+\.\w+\/$/.test(url.pathname);
    if (!redirect || (!legacyAddSlash && !legacyStripSlash)) return response;
    const final = new URL(`${redirect.destination}${url.search}`, url.origin).href;
    assert.equal(response.helperDestination, final, `${url.pathname}: helper must return the final URL`);
    const legacy = new URL(url.href);
    legacy.pathname = legacyAddSlash ? `${url.pathname}/` : url.pathname.slice(0, -1);
    if (![301, 308].includes(response.status)) return { ...response, helperDestination: legacy.href };
    assert.equal(response.headers.location, final, `${url.pathname}: legacy redirect must reach its final URL in one hop`);
    return { ...response, headers: { ...response.headers, location: legacy.href }, helperDestination: legacy.href };
  });
  return inlineCssObservationPredecessor({ ...observation, responses }, priorSource);
}
if (process.argv.includes('--print-baseline')) {
  const baseline = Object.fromEntries(files.map((file) => [file, execFileSync('git', ['show', `${baselineSha}:${file}`], { encoding: 'utf8' })]));
  for (const [name, overrides] of fixtures) {
    const before = await observe(baseline, overrides);
    const after = await observe(current, overrides);
    assert.deepEqual(baselineFirstHop(after), before, name);
    console.log(`  '${name}': '${digest(before)}',`);
  }
} else {
  for (const [name, overrides] of fixtures) {
    test(`baseline config/CSP/redirect parity: ${name}`, async () => {
      const actual = await observe(current, overrides);
      if (['vercel-live', 'vercel-preview', 'wrong-vercel-project'].includes(name)) {
        // Only retired-provider acceptance is superseded; every native output hash stays frozen.
        const process = { env: { ...production, ...overrides } };
        const sharedWeb = evaluate(current['lib/runtime/web-build-config.mjs'], { process }, '({ resolveWebEnvironment, isWebSanityLaneAllowed })');
        assert.equal(sharedWeb.isWebSanityLaneAllowed(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID, process.env.NEXT_PUBLIC_SANITY_DATASET), false);
        assert.equal(actual.config.images.remotePatterns.some(pattern => pattern.hostname === 'cdn.sanity.io'), false);
      } else assert.equal(digest(baselineFirstHop(actual)), expected[name], `${name}: full output changed from ${baselineSha}`);
    });
  }
}

// The build resolver is also the Web runtime owner. Keep the old Content resolver's
// narrower Web projection without relaxing the separate deployment/Sanity seal.
test('shared Web environment resolver retains the content-runtime projection', () => {
  const values = ['', ' Production ', 'web-uat', 'development', 'local-uat', 'local-production', 'lab', 'uat', 'admin-uat', 'production-admin', 'unknown'];
  const projects = ['', webProject, adminProject, 'unrecognized'];
  for (const explicit of values) for (const project of projects) for (const vercel of ['', ' Preview ', 'production']) {
    const process = { env: { CCPUN_APP_ENV: explicit, VERCEL_PROJECT_ID: project, VERCEL_ENV: vercel } };
    const content = evaluate(read('lib/content/sanity-lane.ts'), { process, CCPUN_VERCEL_PROJECT_IDS: { web: webProject, admin: adminProject } }, 'resolveContentEnvironment()');
    const expected = ['development', 'web-uat', 'production'].includes(content) ? content : 'unknown';
    assert.equal(evaluate(current['lib/runtime/web-build-config.mjs'], { process }, 'resolveWebEnvironment()'), expected, JSON.stringify(process.env));
  }
});

test('legacy root fallback retains its ordered three permanent redirects', async () => {
  const process = { env: production, cwd: () => "/fixture" };
  const sharedWeb = evaluate(current['lib/runtime/web-build-config.mjs'], { process }, '({ WEB_REDIRECTS, TAX_SLUG_MIGRATION })');
  const rootConfig = evaluate(read('next.config.ts'), {
    process, withWorkflow: (config) => config, IS_ADMIN_APPLICATION: false, IS_REVIEW_ENVIRONMENT: false,
    SECURITY_HEADERS: [], getAdminEnvironment: () => 'production', isSanityLaneAllowed: () => true, ...sharedWeb,
  }, 'defaultExport');
  assert.deepEqual(JSON.parse(JSON.stringify(await rootConfig.redirects())), [
    { source: '/living-benefits/:path*', destination: '/ci-planning/', permanent: true },
    { source: '/tools/fhc/:path*', destination: '/tools/financial-health-check/', permanent: true },
    { source: '/financial-advisor/:path*', destination: '/', permanent: true },
  ]);
});

function hostingerProxy(overrides) {
  const env = { ...production, ...overrides };
  const process = { env, cwd: () => '/ccpun-parity/apps/web' };
  const sharedSecurity = evaluate(current['lib/runtime/security-headers.mjs'], { process }, '({ buildNextSecurityHeaders, shouldEnforceHttps })');
  const sharedWeb = evaluate(current['lib/runtime/web-build-config.mjs'], { process }, '({ resolveWebEnvironment, isWebSanityLaneAllowed, TAX_SLUG_MIGRATION, WEB_REDIRECTS })');
  const review = env.CCPUN_UAT_MODE === '1' || env.CCPUN_APP_ENV === 'web-uat';
  const security = evaluate(current['lib/security-policy.ts'], { process, IS_REVIEW_ENVIRONMENT: review, ...sharedSecurity }, '({ SECURITY_POLICY, SECURITY_HEADERS })');
  return evaluate(current['apps/web/proxy.ts'], {
    process, URL, NextResponse, IS_REVIEW_ENVIRONMENT: review, ...sharedWeb,
    SECURITY_HEADERS: security.SECURITY_HEADERS, observeAiCrawlerRequest: () => {},
  }, 'defaultExport');
}

test('Hostinger slashless legacy redirects reach their final URL in exactly one hop', () => {
  const finals = {
    '/living-benefits': ['/ci-planning/', 308],
    '/tools/fhc': ['/tools/financial-health-check/', 308],
    '/financial-advisor': ['/', 308],
    [tax]: ['/blog/personal-finance/personal-income-tax-calculation/', 301],
  };
  for (const overrides of [{}, { CCPUN_APP_ENV: 'web-uat', CCPUN_UAT_MODE: '1', NEXT_PUBLIC_SANITY_PROJECT_ID: 'ccb9lnw5', NEXT_PUBLIC_SANITY_DATASET: 'uat' }]) {
    const proxy = hostingerProxy(overrides);
    for (const [path, [destination, status]] of Object.entries(finals)) {
      for (const suffix of ['', '/', '?utm_source=line']) {
        const response = proxy(new Request(`https://candidate.example${path}${suffix}`));
        const query = suffix.startsWith('?') ? suffix : '';
        assert.equal(response.status, status, `${path}${suffix}`);
        assert.equal(response.headers.get('location'), `https://candidate.example${destination}${query}`, `${path}${suffix}`);
        const next = proxy(new Request(response.headers.get('location')));
        assert.equal(next.status, 200, `${path}${suffix}: final URL must not redirect again`);
      }
    }
    assert.equal(proxy(new Request('https://candidate.example/tools/fhc-guide')).headers.get('location'), 'https://candidate.example/tools/fhc-guide/', 'prefix matching stays segment-bound');
  }
});

// Regression for the 2026-10-03 Hostinger cutover outage: the Production Web env
// carried no NEXT_PUBLIC_GA_ID / NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED, so GA4
// custom events (ci_*, fhc_*, line_oa_click) stopped while GTM page views continued.
const hostingerProductionLive = {
  ...production, CCPUN_RELEASE_STAGE: 'live', CCPUN_ENABLE_PRODUCTION_ANALYTICS: '1',
  NEXT_PUBLIC_CCPUN_APP_ENV: 'production', CCPUN_GIT_REF: 'v4-production', CCPUN_GIT_SHA: 'a'.repeat(40), CCPUN_RELEASE_ID: 'synthetic-web-prod',
};
const webConfigEnv = (env) => {
  const process = { env, cwd: () => '/ccpun-parity/apps/web' };
  const sharedSecurity = evaluate(current['lib/runtime/security-headers.mjs'], { process }, '({ buildNextSecurityHeaders, shouldEnforceHttps })');
  const sharedWeb = evaluate(current['lib/runtime/web-build-config.mjs'], { process }, '({ resolveWebEnvironment, isWebSanityLaneAllowed, TAX_SLUG_MIGRATION, WEB_REDIRECTS })');
  const warnings = [];
  const config = evaluate(current['apps/web/next.config.ts'], { process, path, console: { warn: (message) => warnings.push(message) }, ...sharedSecurity, ...sharedWeb }, 'defaultExport');
  return { env: JSON.parse(JSON.stringify(config.env)), warnings };
};

test('Production Web build inlines the GA4 identity and GTM semantic event contract without Hostinger NEXT_PUBLIC values', () => {
  const live = webConfigEnv(hostingerProductionLive);
  assert.equal(live.env.NEXT_PUBLIC_GA_ID, 'G-5BMX2SKJLZ', 'GoogleAnalytics (LINE listener, GA flush) must mount on Production');
  assert.equal(live.env.NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED, 'true', 'trackEvent must feed the GTM ccpun_event tag on Production');
  assert.equal(live.env.NEXT_PUBLIC_CCPUN_APP_ENV, 'production');
  assert.deepEqual(live.warnings, ['NEXT_PUBLIC_META_PIXEL_ID is not set: Meta Pixel stays disabled on Production tool pages.']);
  const explicit = webConfigEnv({ ...hostingerProductionLive, NEXT_PUBLIC_GA_ID: ' G-5BMX2SKJLZ ', NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED: 'true', NEXT_PUBLIC_META_PIXEL_ID: '123456789012345' });
  assert.deepEqual(explicit.env, live.env, 'matching explicit values are accepted unchanged');
  assert.deepEqual(explicit.warnings, []);
  for (const [key, value] of [['NEXT_PUBLIC_GA_ID', 'G-OTHER0000'], ['NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED', 'false']]) {
    assert.throws(() => webConfigEnv({ ...hostingerProductionLive, [key]: value }), new RegExp(`PRODUCTION_WEB_PUBLIC_ANALYTICS_CONFLICT: ${key}`), `${key} conflict must fail the build`);
  }
  // Every other lane keeps analytics off by design and gains no tracking identity.
  for (const overrides of [
    { CCPUN_ENABLE_PRODUCTION_ANALYTICS: '0', CCPUN_RELEASE_STAGE: 'candidate', CCPUN_UAT_MODE: '1' },
    { CCPUN_APP_ENV: 'web-uat', NEXT_PUBLIC_CCPUN_APP_ENV: 'web-uat', CCPUN_ENABLE_PRODUCTION_ANALYTICS: '0', CCPUN_UAT_MODE: '1', NEXT_PUBLIC_SANITY_PROJECT_ID: 'ccb9lnw5', NEXT_PUBLIC_SANITY_DATASET: 'uat' },
    { CCPUN_DEPLOYMENT_ROLE: 'admin' },
    { CCPUN_APP_ENV: 'development', CCPUN_DEPLOYMENT_PROVIDER: 'local' },
  ]) {
    const { env } = webConfigEnv({ ...hostingerProductionLive, ...overrides });
    assert.equal(env.NEXT_PUBLIC_GA_ID, undefined, JSON.stringify(overrides));
    assert.equal(env.NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED, undefined, JSON.stringify(overrides));
  }
  // The inlined keys are exactly the ones the runtime consumers read.
  assert.match(read('apps/web/app/layout.tsx'), /const GA_ID = PRODUCTION_WEB_ANALYTICS_ENABLED \? \(process\.env\.NEXT_PUBLIC_GA_ID \?\? ""\) : "";/);
  assert.match(read('features/analytics/components/ClientWidgets.tsx'), /\{gaId && <GoogleAnalytics gaId=\{gaId\} \/>\}/);
  assert.match(read('lib/analytics.ts'), /process\.env\.NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED !== 'true'/);
  assert.match(read('features/analytics/components/GoogleAnalytics.tsx'), /trackEvent\('line_oa_click'/);
});


test('Web and compatibility config select WebP; the installed optimizer serves WebP without rewriting the original', async () => {
  const { config } = await observe(current, {});
  assert.deepEqual(config.images.formats, ['image/webp']);
  assert.match(read('next.config.ts'), /formats: \["image\/webp"\]/);
  const { ImageOptimizerCache, imageOptimizer } = createRequire(import.meta.url)('next/dist/server/image-optimizer');
  const runtime = { ...config, images: { ...config.images, minimumCacheTTL: 14400 } };
  const params = ImageOptimizerCache.validateParams({ headers: { accept: 'image/avif,image/webp,image/*,*/*;q=0.8' } }, { url: '/assets/ccpun-avatar-v5-256.png', w: '256', q: '75' }, runtime, false);
  assert.equal(params.errorMessage, undefined);
  assert.equal(params.mimeType, 'image/webp', 'AVIF-capable browsers still receive the owner-selected WebP');
  const originalPath = 'public/assets/ccpun-avatar-v5-256.png';
  const original = readFileSync(originalPath);
  const originalHash = createHash('sha256').update(original).digest('hex');
  const sharp = createRequire(import.meta.url)('sharp');
  const before = await sharp(original).metadata();
  const output = await imageOptimizer({ buffer: original, contentType: 'image/png', cacheControl: 'public, max-age=3600', etag: originalHash }, params, runtime, { isDev: false, silent: true });
  const delivered = await sharp(output.buffer).metadata();
  assert.equal(output.contentType, 'image/webp');
  assert.equal(delivered.format, 'webp');
  assert.equal(delivered.width, before.width);
  assert.equal(delivered.height, before.height);
  assert.equal(createHash('sha256').update(readFileSync(originalPath)).digest('hex'), originalHash, 'The master remains byte-identical');
});
