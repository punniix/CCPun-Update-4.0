import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const failures = [];

function expect(name, pass, detail = '') {
  if (pass) {
    console.log(`PASS ${name}`);
    return;
  }
  failures.push(name);
  console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
}

const agents = read('AGENTS.md');
expect('agent workflow protects v4-production', agents.includes('Never edit `v4-production` directly'));
expect('agent workflow requires Preview and human review', agents.includes('Vercel Preview -> human review -> merge'));
expect('agent policy separates canonical URL from semantic topic', agents.includes('Semantic topic classification is a separate knowledge-graph layer'));
expect('agent policy preserves Health CI Hero semantics', agents.includes('AIA Health CI Hero is health/medical-expense insurance') && agents.includes('It is NOT critical-illness lump-sum insurance'));
expect('agent policy locks Health winner pages to Health physical URLs', agents.includes('AIA Health Happy and AIA Health CI Hero have approved final physical/canonical owners under `/blog/health-insurance/...`'));
expect('agent policy protects analytics consent', agents.includes('Consent must remain authoritative'));

const urlContract = read('lib/content/url.ts');
const frozenMovedPaths = [
  ['life-insurance/aia-health-happy-describe', '/blog/health-insurance/aia-health-happy-describe/'],
  ['life-insurance/aia-health-ci-hero-guide', '/blog/health-insurance/aia-health-ci-hero-guide/'],
  ['critical-illness/critical-illness-insurance', '/blog/life-insurance/critical-illness-insurance/'],
];
for (const [source, destination] of frozenMovedPaths) {
  expect(`frozen URL contract ${source}`, urlContract.includes(`"${source}": "${destination}"`), destination);
}
expect('health winner canonical category override remains protected', urlContract.includes('"aia-health-happy-describe": "health-insurance"') && urlContract.includes('"aia-health-ci-hero-guide": "health-insurance"'));
expect('canonical alignment remains ccpun.com only', urlContract.includes('canonical.origin === "https://ccpun.com"'));

const ledger = JSON.parse(read('qa/legacy-url-ledger.json'));
expect('legacy URL ledger remains frozen', typeof ledger.frozenAt === 'string' && ledger.frozenAt.length > 0);
const ledgerText = JSON.stringify(ledger);
for (const destination of [
  '/blog/health-insurance/aia-health-happy-describe/',
  '/blog/health-insurance/aia-health-ci-hero-guide/',
]) {
  expect(`legacy ledger retains approved winner destination ${destination}`, ledgerText.includes(`https://ccpun.com${destination}`));
}

const studioPolicy = read('cms/sanity/policy/studio-policy.ts');
expect('non-production Studio blocks publish', /BLOCKED_NON_PRODUCTION_ACTIONS[^\n]*"publish"/.test(studioPolicy));
expect(
  'production admin uses guarded article lifecycle',
  studioPolicy.includes('protectProductionContentLifecycleActions')
    && studioPolicy.includes('createDraftOnlyDeleteAction')
    && studioPolicy.includes('createSeoSafeUnpublishAction')
    && studioPolicy.includes('ลบฉบับร่าง')
    && studioPolicy.includes('นำออกจากเว็บไซต์'),
);
expect(
  'published URLs remain protected from permanent delete',
  studioPolicy.includes('function wasEverPublished')
    && studioPolicy.includes('if (wasEverPublished(props)) return null;'),
);
expect('disallowed Sanity data plane returns no actions', studioPolicy.includes('if (!isStudioDataPlaneAllowed(dataset, environment, undefined, undefined, projectId)) return [];'));

const analytics = read('lib/analytics.ts');
expect('analytics remains consent-gated', analytics.includes("import { getConsentData } from './cookie-consent';") && analytics.includes('if (!consent) return;'));
expect('analytics keeps allowlisted parameter sanitizer', analytics.includes('export function sanitizeEventParams'));
expect('analytics keeps semantic dataLayer cutover layer', analytics.includes('export function buildSemanticDataLayerEvent') && analytics.includes("event: 'ccpun_event'"));
expect('analytics keeps central trackEvent dispatcher', analytics.includes('export function trackEvent(eventName: string'));

const allowedStringsMatch = analytics.match(/const ALLOWED_STRINGS:[\s\S]*?\n};/);
const allowlist = allowedStringsMatch?.[0] ?? '';
for (const forbiddenKey of ['email', 'phone', 'income', 'expense', 'health_condition']) {
  const keyPattern = new RegExp(`^\\s*${forbiddenKey}\\s*:`, 'm');
  expect(`analytics allowlist excludes sensitive field ${forbiddenKey}`, !keyPattern.test(allowlist));
}

const ciProgress = read('features/ci-planning/components/CIProgress.tsx');
expect(
  'CI progress keeps desktop edge labels inside the viewport',
  ciProgress.includes("idx === 0 && 'left-0 translate-x-0 text-left'")
    && ciProgress.includes("idx === TOTAL_STEPS - 1 && 'right-0 translate-x-0 text-right'")
    && ciProgress.includes("idx > 0 && idx < TOTAL_STEPS - 1 && 'left-1/2 -translate-x-1/2'"),
);

const migrationContract = read('cms/sanity/migration-contract.md');
expect('content migration remains draft-first', migrationContract.includes('A content import is not publication'));
expect('published migration requires coordinated URL release', migrationContract.includes('redirect + new canonical + sitemap/internal-link ownership together'));

if (failures.length) {
  console.error(`\nFoundation safety regression failed (${failures.length}):`);
  failures.forEach((name) => console.error(`- ${name}`));
  process.exit(1);
}

console.log('\nFoundation safety contracts passed.');
