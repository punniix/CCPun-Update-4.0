import { readFileSync, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const React = require('react');

// The existing native component regression technique, shared by the bounded Phase 1 fixtures.
// Only synthetic services/SDK boundaries are injected; candidate domain helpers execute normally.
export function loadFixtureModule(file, { sources = new Map(), mocks = new Map(), globals = {} } = {}) {
  const cache = new Map();
  const resolve = (id, from) => {
    const base = id.startsWith('@/') ? id.slice(2) : path.join(path.dirname(from), id);
    for (const p of [base, base + '.ts', base + '.tsx', base + '.mjs', base + '/index.ts']) {
      if (sources.has(p) || (existsSync(p) && statSync(p).isFile())) return p;
    }
    throw new Error(`Missing fixture source ${id} from ${from}`);
  };
  function load(p) {
    const mockId = '@/' + p.replace(/\.(?:ts|tsx|mjs)$/, '');
    if (mocks.has(mockId)) return mocks.get(mockId);
    if (cache.has(p)) return cache.get(p).exports;
    const compiledModule = { exports: {} };
    cache.set(p, compiledModule);
    const dependencies = (id) => {
      if (mocks.has(id)) return mocks.get(id);
      if (id === 'server-only') return {};
      if (id === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
      if (id === 'next/image') return { __esModule: true, default: props => { const imageProps = { ...props }; delete imageProps.fill; delete imageProps.priority; delete imageProps.unoptimized; return React.createElement('img', imageProps); } };
      if (id === 'next/navigation') return {
        redirect: (url) => { throw Object.assign(new Error('fixture-redirect'), { url }); },
        notFound: () => { throw Object.assign(new Error('fixture-not-found'), { code: 'not-found' }); },
      };
      if (id.startsWith('@/features/admin/components/') && !['SeoReviewInboxPage', 'ArticleDetailPage', 'AdminCapabilityState', 'ContentArticlesPage', 'ContentCalendarPage', 'AuditLogPage', 'SeoOverviewPage', 'SeoAuditDetailPage', 'HealthStatus', 'SettingsIndexPage', 'ReadinessRows', 'AdminProtectedChrome', 'AdminLoginView', 'AdminErrorView', 'AdminNotFoundView', 'StudioUnavailableView'].some(name => id.endsWith('/' + name))) {
        const component = ({ children, ...props }) => React.createElement('button', { 'data-fixture-component': id.split('/').at(-1), 'data-fixture-props': JSON.stringify(props) }, children);
        return { __esModule: true, default: component, [id.split('/').at(-1)]: component };
      }
      if (id.endsWith('.css')) return {};
      if (id.startsWith('@/public/') && id.endsWith('.webp')) {
        const asset = path.normalize(resolve(id, p));
        if (!asset.startsWith('public/')) throw new Error('Fixture asset must remain public');
        return { __esModule: true, default: { src: '/' + asset.slice('public/'.length) } };
      }
      if (id.startsWith('@/') || id.startsWith('.')) return load(resolve(id, p));
      return require(id);
    };
    const source = sources.get(p) ?? readFileSync(p, 'utf8');
    // .mjs is native ESM in runtime; this isolated CJS fixture must request a TS
    // compilation identity to evaluate its original exports in the same harness.
    const compiled = ts.transpileModule(source, { fileName: p.replace(/\.mjs$/, '.ts'), compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', 'process', 'console', 'Date', compiled)(dependencies, compiledModule, compiledModule.exports, globals.process ?? { env: {} }, globals.console ?? console, globals.Date ?? Date);
    return compiledModule.exports;
  }
  return load(file);
}
