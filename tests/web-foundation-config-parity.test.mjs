import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

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
// Only the two owner-authorized UAT fixtures add this one connect-src origin.
// Keep every historical digest above, including both Production lanes, frozen.
const searchOrigin = 'https://f687f126-71f5-49d5-8193-ac2313dd8e3e.search.ai.cloudflare.com';
const reviewedUatSearch = {
  'hostinger-uat': { before: 'cf4afd298bdb7249538fdbd03b44f3005d9c402d7f984cc9a9d65b9e82f20f0d', after: 'd18226a7dc5479a245b32cdd51924bff198c156363977cd94fa7820aedb8a29e' },
  'local-uat': { before: '085b4125a864d6f5e4d00bce656be12fbfb328ca81580e1dd5150245c6acfe76', after: 'f23068fc02a0be8a40466a09ce5f5a7a69ace1a1b6206909dadaba8b3ae1180e' },
};
function assertNativeFixture(name, actual) {
  const reviewed = reviewedUatSearch[name];
  if (reviewed) {
    assert.equal(expected[name], reviewed.before, 'historical UAT digest remains frozen');
    const policy = actual.runtimeSecurity.SECURITY_POLICY;
    assert.equal(policy.split(searchOrigin).length - 1, 1);
    assert.ok(policy.split('; ').find(directive => directive.startsWith('connect-src ')).endsWith(' ' + searchOrigin));
  } else assert.ok(!JSON.stringify(actual).includes(searchOrigin), 'other lanes never gain the UAT search origin');
  assert.equal(digest(actual), reviewed?.after ?? expected[name], `${name}: unreviewed full output change`);
}
if (process.argv.includes('--print-baseline')) {
  const baseline = Object.fromEntries(files.map((file) => [file, execFileSync('git', ['show', `${baselineSha}:${file}`], { encoding: 'utf8' })]));
  for (const [name, overrides] of fixtures) {
    const before = await observe(baseline, overrides);
    const after = await observe(current, overrides);
    assert.deepEqual(after, before, name);
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
      } else assertNativeFixture(name, actual);
    });
  }
}

test('reviewed UAT search admission rejects a substituted origin and unrelated response drift', async () => {
  for (const [name, overrides] of fixtures.filter(([name]) => reviewedUatSearch[name])) {
    const actual = await observe(current, overrides);
    assertNativeFixture(name, actual);
    const changedOrigin = structuredClone(actual);
    changedOrigin.runtimeSecurity.SECURITY_POLICY = changedOrigin.runtimeSecurity.SECURITY_POLICY.replace(searchOrigin, 'https://unreviewed.example');
    assert.throws(() => assertNativeFixture(name, changedOrigin));
    const changedResponse = structuredClone(actual); changedResponse.responses[0].status = 500;
    assert.throws(() => assertNativeFixture(name, changedResponse));
  }
});

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
