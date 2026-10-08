import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DEPLOYMENT_LANES } from '../lib/runtime/deployment-lanes.mjs';
import { main as audit } from '../scripts/audit-monorepo-boundaries.mjs';

const baselinedMirrors = JSON.parse(readFileSync(new URL('../qa/monorepo-compatibility-mirrors.json', import.meta.url), 'utf8'));

test('the four independently deployable Hostinger lanes retain their owners and data isolation', () => {
  assert.deepEqual(Object.keys(DEPLOYMENT_LANES).sort(), [
    'admin-production', 'admin-uat', 'web-production', 'web-uat',
  ]);
  const expected = {
    'web-production': ['ccpun.com', 'web', '@ccpun/web', 'kyfxgjnq', 'production', true, '1'],
    'web-uat': ['test.ccpun.com', 'web', '@ccpun/web', 'ccb9lnw5', 'uat', false, '0'],
    'admin-production': ['admin.ccpun.com', 'admin', '@ccpun/admin', 'kyfxgjnq', 'production', false, '0'],
    'admin-uat': ['admin-test.ccpun.com', 'admin', '@ccpun/admin', 'ccb9lnw5', 'uat', false, '0'],
  };
  for (const [name, [domain, role, workspace, project, dataset, indexable, analytics]] of Object.entries(expected)) {
    const lane = DEPLOYMENT_LANES[name];
    assert.equal(lane.domain,domain,name);
    assert.equal(lane.provider,'hostinger',name);
    assert.equal(lane.role,role,name);
    assert.equal(lane.workspace,workspace,name);
    assert.equal(lane.sanityProjectId,project,name);
    assert.equal(lane.sanityDataset,dataset,name);
    assert.equal(lane.indexable,indexable,name);
    assert.equal(lane.productionAnalytics,analytics,name);
    assert.equal(lane.nodeMajor,24,name);
  }
});

test('monorepo audit starts from the actual apps/web and apps/admin entrypoints', async () => {
  const report = await audit({log:false});
  assert.ok(report.roots.web.length >= 1, 'Web runtime roots missing');
  assert.ok(report.roots.admin.length >= 1, 'Admin runtime roots missing');
  assert.ok(report.roots.web.every((file) => file.startsWith('apps/web/')));
  assert.ok(report.roots.admin.every((file) => file.startsWith('apps/admin/') || file === 'auth.ts'));
  assert.ok(report.counts.legacyCompatibilityRoutes > 0);
  assert.deepEqual(report.crossWorkspaceImports, {webToAdmin:[],adminToWeb:[]});
  assert.deepEqual(report.unassignedRoutes, []);
});


test('Web legal and not-found routes share canonical feature implementations', () => {
  const pages = [
    ['privacy/page.tsx', 'features/legal/pages/PrivacyPage.tsx'],
    ['cookie-policy/page.tsx', 'features/legal/pages/CookiePolicyPage.tsx'],
    ['not-found.tsx', 'features/public-pages/NotFoundPage.tsx'],
  ];
  for (const [route, shared] of pages) {
    const specifier = '@/' + shared.replace(/\.tsx$/, '');
    const wrapper = 'export { metadata, default } from "' + specifier + '";\n';
    for (const prefix of ['app/', 'apps/web/app/']) {
      const routeSource = readFileSync(new URL('../' + prefix + route, import.meta.url), 'utf8');
      assert.equal(routeSource, wrapper, prefix + route + ' must not duplicate shared implementation');
    }
    const sharedSource = readFileSync(new URL('../' + shared, import.meta.url), 'utf8');
    assert.match(sharedSource, /export const metadata:/);
    assert.match(sharedSource, /export default function /);
  }
});

test('legacy root mirrors are compatibility debt, never justification to create more duplicate route files', async () => {
  const report = await audit({log:false});
  assert.deepEqual(baselinedMirrors.canonicalWorkspaces,['apps/web','apps/admin']);
  const approved = new Set(baselinedMirrors.existingPairs.map((pair) => pair.join('\0')));
  const newPairs = report.compatibilityMirrors.filter(({legacy,canonical}) => !approved.has([legacy,canonical].join('\0')));
  assert.deepEqual(newPairs,[], 'New duplicate root routes require replacing the clone with an owned feature or documented exception');
});
