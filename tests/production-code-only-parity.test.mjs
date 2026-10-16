import './ux-structure-production.test.mjs';
import { assertPhase3AdminNativeBoundaries } from '../qa/phase3-admin-native-boundaries-proof.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { productionBaselineSource } from '../qa/phase1-source-proof.mjs';
import { assertPhase2MoneyComposition, assertReviewedUxOwners } from '../qa/phase2-source-proof.mjs';
import { assertNativeProviderRetirement, assertReviewedWebUatBuildProfile } from '../qa/phase3-native-provider-proof.mjs';

const root = resolve(import.meta.dirname, '..');
const read = file => readFileSync(resolve(root, file), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const proof = JSON.parse(read('qa/production-code-only-parity.json'));
const reviewedUiOwners = [
  "lib/analytics.ts",
  "features/analytics/components/GoogleAnalytics.tsx",
  "apps/web/app/cookie-policy/page.tsx",
  "components/layout/website-43/Website43.module.css",
  "components/layout/website-43/Website43Legal.module.css",
  "components/layout/website-43/Website43Navbar.module.css",
  "components/layout/website-43/Website43Navbar.tsx",
  "components/layout/website-43/Website43ResponsiveStyles.tsx",
  "components/layout/website-43/Website43Shared.tsx",
  "components/layout/website-43/Website43ToolHero.tsx",
  "components/ui/FunctionalMotion.module.css",
  "components/ui/HumanCalculatorCard.tsx",
  "features/analytics/components/CookieConsent.tsx",
  "features/analytics/components/CookieConsentPreferences.tsx",
  "features/blog/pages/BlogArchivePage.tsx",
  "features/blog/pages/BlogCategoryPage.tsx",
  "features/blog/website-43/Website43Article.tsx",
  "features/blog/website-43/Website43ArticleBody.tsx",
  "features/blog/website-43/Website43Blog.tsx",
  "features/blog/website-43/Website43BlogInteractive.tsx",
  "features/ci-planning/components/CIWizard.tsx",
  "features/ci-planning/components/steps/ExpenseObligationsSection.tsx",
  "features/ci-planning/components/steps/RecoveryReserveSection.tsx",
  "features/ci-planning/components/steps/StepExpenses.tsx",
  "features/ci-planning/page.tsx",
  "features/financial-health-check/components/ClientFHC.tsx",
  "features/financial-health-check/components/LifeCoverageWizard.tsx",
  "features/home/website-43/Website43Home.tsx",
  "features/home/website-43/Website43HomeStatic.tsx",
  "features/money-story/MoneyStory.module.css",
  "features/money-story/components/MoneyStoryScreens.tsx",
  "features/money-story/page.tsx"
];
assert.equal(sha(JSON.stringify(proof.canonical)), '1ba83563d79b8fe6616cd75123ba8240cd1e6e788e14f72deff1163bdb74b44c');
assert.equal(sha(JSON.stringify(proof.protected)), 'f1698b69fc464985bbb45bf57276ca793df17142a1d63089c2bd68d894d22e72');

test('reviewed UX release preserves original Production canonical/tracking/SEO/auth owners and admits only reviewed UI sources', () => {
  assertReviewedUxOwners(proof, reviewedUiOwners);
  assert.equal(Object.keys(proof.canonical).length, 48);
  for (const [file, digest] of Object.entries({ ...proof.canonical, ...proof.protected })) {
    if (file === 'features/money-story/components/MoneyStoryGame.tsx') assertPhase2MoneyComposition(file, digest);
    else if (['lib/runtime/deployment-identity.ts', 'lib/content/sanity-lane.ts', 'lib/deployment-environment.ts', 'proxy.ts', 'lib/runtime/deployment-contract.ts'].includes(file)) assertNativeProviderRetirement(file, digest);
    else if (['apps/admin/app/api/internal/line/bridge-health/route.ts', 'apps/admin/app/api/internal/line/ingest-event/route.ts'].includes(file)) assert.equal(assertPhase3AdminNativeBoundaries(file, digest), true);
    else if (file === 'lib/runtime/deployment-lanes.mjs') assert.equal(assertReviewedWebUatBuildProfile(digest), true, file);
    else if (Object.hasOwn(proof.reviewedUxOwners, file)) assert.equal(proof.reviewedUxOwners[file].baselineSha256, digest, file);
    else assert.equal(sha(productionBaselineSource(file)), digest, file);
  }
  for (const file of ['features/investment-allocation', 'apps/web/app/tools/investment-allocation', 'apps/web/app/api/investment-allocation']) {
    assert.equal(existsSync(resolve(root, file)), false, file + ': unfinished tool must remain absent');
  }
});

test('critical first-paint CSS and three layout compositions preserve the exact Production baseline', () => {
  const css = read('components/styles/critical-foundation.ts').match(/= `([\s\S]*?)`;\s*$/)?.[1];
  assert.equal(Buffer.byteLength(css), proof.criticalCssBytes);
  assert.equal(sha(css), proof.criticalCssSha256);
  for (const [file, digest] of Object.entries(proof.layouts)) {
    const source = productionBaselineSource(file);
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

test('reviewed UI owner admission rejects unknown owners, baseline tampering and runtime changes', () => {
  const extra = structuredClone(proof); extra.reviewedUxOwners['unknown.tsx'] = { baselineSha256:'0'.repeat(64), candidateSha256:'0'.repeat(64) };
  assert.throws(() => assertReviewedUxOwners(extra, reviewedUiOwners));
  const baselineDrift = structuredClone(proof); baselineDrift.reviewedUxOwners[reviewedUiOwners[0]].baselineSha256 = '0'.repeat(64);
  assert.throws(() => assertReviewedUxOwners(baselineDrift, reviewedUiOwners));
  assert.throws(() => assertReviewedUxOwners(proof, reviewedUiOwners, file => read(file) + '\n/* unreviewed runtime mutation */'));
});
