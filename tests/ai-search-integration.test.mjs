import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { main as audit } from '../scripts/audit-monorepo-boundaries.mjs';

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('Cloudflare integration does not add an unrequested public search page or runtime widget', async () => {
  for (const file of ['apps/web/app/search/page.tsx', 'features/ai-search/SearchPage.tsx', 'features/ai-search/SearchPage.module.css']) {
    assert.equal(existsSync(new URL('../' + file, import.meta.url)), false, 'No dedicated search page is requested');
  }
  // Dead AI-search widget is removed, not merely disconnected from the entry graph.
  assert.equal(existsSync(new URL('../features/ai-search/CCPunAiSearchWidgets.tsx', import.meta.url)), false, 'Deprecated unmounted widget must remain absent');
  for (const file of ['app/layout.tsx', 'apps/web/app/layout.tsx', 'components/layout/website-43/Website43Navbar.tsx']) {
    assert.doesNotMatch(read(file), /CCPunAiSearch|href=.*\/search/);
  }
  assert.doesNotMatch(read('apps/web/next.config.ts'), /search\.ai\.cloudflare\.com/);
  const report = await audit({ log: false });
  assert.ok(!report.compatibilityMirrors.some(({ legacy }) => legacy === 'app/search/page.tsx'));
  assert.ok(!report.sharedRuntimeFiles.some((file) => file.startsWith('features/ai-search/')), 'Admin must not import public search');
  assert.deepEqual(report.crossWorkspaceImports, { webToAdmin: [], adminToWeb: [] });
  assert.ok(!report.dependencies.some(({ name }) => name === '@cloudflare/ai-search-snippet'), 'Removed widget must leave no SDK references in the source graph');
});
