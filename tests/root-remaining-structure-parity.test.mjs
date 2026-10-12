import { productionBaselineSource } from '../qa/phase1-source-proof.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

const read = (file) => productionBaselineSource(file);
const hash = (source) => createHash('sha256').update(source).digest('hex');
const baseline = JSON.parse(read('qa/root-remaining-structure-parity.json'));

test('remaining root delegation preserves canonical Admin implementations and privacy/scheduler/auth owners', () => {
  for (const [file, expected] of Object.entries({ ...baseline.canonicalPreserved, ...baseline.protected })) {
    assert.equal(hash(read(file)), expected, file);
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
  let source = read('proxy.ts');
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
