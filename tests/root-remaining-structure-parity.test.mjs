import { assertPhase3AdminNativeBoundaries } from '../qa/phase3-admin-native-boundaries-proof.mjs';
import { assertNativeProviderRetirement } from '../qa/phase3-native-provider-proof.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { productionBaselineSource, assertReviewedUatRetention, reviewedGoogleSessionBaselineSource } from '../qa/phase1-source-proof.mjs';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const actual = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const sessionProof = JSON.parse(actual('qa/phase1-source-ownership.json'));
const read = file => Object.hasOwn(sessionProof.reviewedGoogleSessionUat.existingSources, file)
  ? reviewedGoogleSessionBaselineSource(file, sessionProof, actual, 'admin-uat')
  : productionBaselineSource(file);
const hash = (source) => createHash('sha256').update(source).digest('hex');
const baseline = JSON.parse(read('qa/root-remaining-structure-parity.json'));
const uatProof = JSON.parse(read('qa/phase1-source-ownership.json'));

test('retained root delegation preserves original contracts after separately pinned Google UAT source review', () => {
  for (const [file, expected] of Object.entries({ ...baseline.canonicalPreserved, ...baseline.protected })) {
    if (['lib/admin/operations/article-schedule-contract.ts', 'apps/admin/proxy.ts'].includes(file)) assert.equal(assertPhase3AdminNativeBoundaries(file, expected), true, file);
    else if (Object.hasOwn(uatProof.reviewedInheritedUat.retainedSources, file)) assert.equal(assertReviewedUatRetention(file, expected, uatProof, read, 'admin-uat'), true, file);
    else assert.equal(hash(read(file)), expected, file);
  }
  // The actual Admin POST adopts the existing reviewed-import contract, not a new provider executor.
  assert.equal(hash(read('apps/admin/app/api/admin/providers/ubersuggest/sync/route.ts')), baseline.ubersuggestReconciledOwnerSha256);
});

test('three lane layouts keep exact composition and critical first-paint CSS at the same head position', () => {
  const owner = read('components/styles/critical-foundation.ts');
  const css = owner.match(/export const CRITICAL_FOUNDATION_CSS = `([\s\S]*?)`;/)?.[1];
  assert.equal(Buffer.byteLength(css), baseline.criticalCssBytes);
  assert.equal(hash(css), baseline.criticalCssSha256);
  for (const [file, expected] of Object.entries(baseline.layoutComposition)) {
    const source = read(file);
    assert.equal((source.match(/<style dangerouslySetInnerHTML=\{\{ __html: CRITICAL_FOUNDATION_CSS \}\} \/>/g) ?? []).length, 1, file);
    assert.equal(hash(source.replace('import { CRITICAL_FOUNDATION_CSS } from "@/components/styles/critical-foundation";\n', '')), expected, file);
  }
});

test('root capability alignment retains the pre-existing mixed-host origin/auth/mutation fences', () => {
  const native = JSON.parse(read('qa/phase3-native-provider-parity.json'));
  const original = native.baselineSources['proxy.ts'];
  assert.equal(assertNativeProviderRetirement('proxy.ts', hash(original)), true);
  let admittedCurrent = original;
  for (const obsoleteLine of ["    vercelRequestId: request.headers.get(\"x-vercel-id\"),\n", "    vercelEnvironment: process.env.VERCEL_ENV,\n", "    deploymentProjectId: process.env.VERCEL_PROJECT_ID,\n", "          vercelEnvironment: process.env.VERCEL_ENV,\n", "          deploymentProjectId: process.env.VERCEL_PROJECT_ID,\n", "    { source: \"/((?!\\\\.well-known/workflow/).*)\", has: [{ type: \"host\", value: \"ccpun-admin-prod.vercel.app\" }] },\n", "    { source: \"/((?!\\\\.well-known/workflow/).*)\", has: [{ type: \"host\", value: \"ccpun-admin.vercel.app\" }] },\n", "    { source: \"/((?!\\\\.well-known/workflow/).*)\", has: [{ type: \"host\", value: \"ccpun-admin(?:-.+)?\\\\.vercel\\\\.app\" }] },\n"]) admittedCurrent = admittedCurrent.replace(obsoleteLine, '');
  assert.equal(read('proxy.ts'), admittedCurrent, 'only reviewed retired-provider arguments and host matchers are removed');
  // The current whole body is proven above; retain the original independent capability predicates below.
  let source = original;
  source = source.replace('import { adminCapabilityLandingPath, getAdminCapabilityProfile, isAdminCapabilityPathAllowed, safeAdminCapabilityReturnPath } from "@/lib/admin/capability-profile";\n', '');
  source = source.replace('  const capabilityProfile = getAdminCapabilityProfile();\n  const landingPath = adminCapabilityLandingPath(capabilityProfile);\n', '');
  const capabilityBlock = /  \/\/ Mixed root builds keep public Web routes, while private Admin surfaces use\n  \/\/ the same capability allowlist as the dedicated Admin entry\.\n  if \(\(isAdminBoundaryRequest \|\| isAdminPage \|\| isAdminApi \|\| isStudioPage \|\| isPreviewApi \|\| isAuthApi\)[\s\S]*?\n  \}\n\n/;
  assert.match(source, capabilityBlock);
  source = source.replace(capabilityBlock, '');
  source = source.replaceAll('role ? landingPath : "/login/"', 'role ? "/dashboard/" : "/login/"');
  source = source.replaceAll('new URL(landingPath, request.url)', 'new URL("/dashboard/", request.url)');
  source = source.replaceAll('capabilityProfile === "full" ? safeAdminReturnPath(`${pathname}${request.nextUrl.search}`) : safeAdminCapabilityReturnPath(`${pathname}${request.nextUrl.search}`, capabilityProfile)', 'safeAdminReturnPath(`${pathname}${request.nextUrl.search}`)');
  assert.equal(hash(source), baseline.rootProxyOriginalSha256);
});
