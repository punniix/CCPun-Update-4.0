import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { main as audit } from '../scripts/audit-monorepo-boundaries.mjs';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');
const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('Web owns the search page and its unavailable state renders without a network widget', async () => {
  assert.equal(read('apps/web/app/search/page.tsx'), 'export { metadata, default } from "@/features/ai-search/SearchPage";\n');
  const source = read('features/ai-search/SearchPage.tsx');
  const dependencies = (id) => {
    if (id.endsWith('.module.css')) return { __esModule: true, default: {} };
    if (id === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
    if (id.endsWith('/Website43Navbar')) return { Website43Navbar: () => React.createElement('nav') };
    if (id.endsWith('/Website43Shared')) return { Website43Footer: () => React.createElement('footer') };
    // Fail if the page starts loading a widget, deployment data or any new dependency.
    if (id === 'react/jsx-runtime') return require(id);
    throw new Error('Unexpected search page dependency: ' + id);
  };
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const compiledModule = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(dependencies, compiledModule, compiledModule.exports);
  const html = renderToStaticMarkup(React.createElement(compiledModule.exports.default));
  assert.equal((html.match(/<h1>/g) ?? []).length, 1);
  assert.match(html, /role="status"/);
  assert.match(html, /ยังไม่เปิดให้ใช้งาน/);
  assert.match(html, /href="\/blog\/"/);
  assert.doesNotMatch(html, /search-(?:bar|modal)-snippet|chat-bubble-snippet|api-url|search\.ai\.cloudflare\.com|<script/);
  assert.equal(compiledModule.exports.metadata.robots.index, false, 'Search remains noindex on every lane');
  for (const file of ['app/layout.tsx', 'apps/web/app/layout.tsx', 'components/layout/website-43/Website43Navbar.tsx']) {
    assert.doesNotMatch(read(file), /CCPunAiSearch|href=.*\/search/);
  }
  assert.doesNotMatch(read('apps/web/next.config.ts'), /search\.ai\.cloudflare\.com/);
  const report = await audit({ log: false });
  assert.ok(!report.compatibilityMirrors.some(({ legacy }) => legacy === 'app/search/page.tsx'));
  assert.ok(!report.sharedRuntimeFiles.some((file) => file.startsWith('features/ai-search/')), 'Admin must not import public search');
  assert.deepEqual(report.crossWorkspaceImports, { webToAdmin: [], adminToWeb: [] });
  assert.deepEqual(report.dependencies.find(({ name }) => name === '@cloudflare/ai-search-snippet')?.owners, ['unassigned'], 'The disabled SDK must not enter a runtime import graph');
});
