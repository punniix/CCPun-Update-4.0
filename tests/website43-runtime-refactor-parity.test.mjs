import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(resolve('package.json'));
const postcss = require('postcss');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
// UX/UAT 3d909613 before the approved unified-footer revision.
// Footer hashes retain its original desktop DOM. Active/navbar CSS hashes include the
// COO-approved 2026-10-14 native interaction motion revision; responsive layout stays frozen.
// Frozen active CSS/DOM outputs require no Git history or network in CI.
const baseline = {
  "activeCss": "a20588d20bfe731e43a00dcac79e6c47697548315b2644f2b45329de2e7a3609",
  "responsiveCss": "3cd8efc41eec452c51c3fee2e874a6d3b3c7e06ab8fe573c503e90a5d9474c47",
  "navbarCss": "b0f79a2ee71084e32c2c0ee2e6bec4195dd3c128d040bf8442cf61c172e95e85",
  "navbarDomOff": "e0e96baf8e7bc3de1e06632b3ae6262f7b4b9e65740ae01246e657bdc23c566b",
  "navbarDomOn": "f2a1baf3334dce55b449c7bed10f5b802f352acde11e3137999f7b9644d9cd4c",
  "footerDomOff": "194a94f48d87c887966470a039725bbf06925bbdc648d2d6f56f8f8f486fdf10",
  "footerDomOn": "4216da5e34c0d40f7e811c02c78c94c128c392e1ff79fb79a0b9af958dd59893"
};
const directory = 'components/layout/website-43/';
const after = (file) => readFileSync(directory + file, 'utf8');
const inactive = new Set(['nav', 'hamburger', 'mobileMenu', 'mobileSubmenu', 'mobileTools', 'navBand', 'navChevron', 'navChevronOpen', 'navCta', 'navDropdown', 'navLinks', 'navOverlay', 'navSpacer', 'navTools', 'navToolsButton', 'notFoundNavBand', 'responsiveOverlayBand', 'reading']);

// Preserve non-footer styling. The approved footer revision has dedicated layout
// and hierarchy checks; its desktop content remains covered by the DOM baseline.
function stylesheetRules(source, responsive = false) {
  const css = responsive
    ? [...source.matchAll(/String\.raw`([\s\S]*?)`/g)].map(([, body]) => body.replace(/\$\{styles\.(\w+)\}/g, 'W43REF_$1')).join('\n')
    : source;
  const ast = postcss.parse(css);
  const records = [];
  ast.walkRules((rule) => {
    const selectors = postcss.list.comma(rule.selector).filter((selector) => ![...selector.matchAll(/\.([\w-]+)/g)].some(([, name]) => {
      const owner = name.replace(/^W43REF_/, '');
      return inactive.has(owner) || /^(?:footer|notFoundFooter)/.test(owner);
    }));
    if (!selectors.length) return;
    const ancestry = [];
    for (let parent = rule.parent; parent.type !== 'root'; parent = parent.parent) ancestry.unshift([parent.name, parent.params]);
    records.push([selectors, rule.nodes.filter((n) => n.type === 'decl').map((n) => [n.prop, n.value, Boolean(n.important)]), ancestry]);
  });
  return records;
}


let enabled = false;
const investmentCapable = after('constants.ts').includes('INVESTMENT_TOOL_LINK');
const investmentLink = { href: '/tools/investment-allocation/', label: 'วางแผนกองทุน (Beta)' };
const styles = new Proxy({}, { get: (_, property) => String(property) });
function component(source, name, pathname, state = []) {
  const hooks = state === null ? React : { ...React, useState: (initial) => [state.length ? state.shift() : initial, () => {}] };
  const dependencies = (id) => {
    if (id.endsWith('.module.css')) return { __esModule: true, default: styles };
    if (id === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
    if (id === 'next/navigation') return { usePathname: () => pathname };
    if (id === 'react') return hooks;
    if (id === './constants') return { INVESTMENT_TOOL_LINK: investmentLink, WEBSITE43_BASE: '', WEBSITE43_HOME: '/' };
    if (id === '@/lib/nav-config.json') return { __esModule: true, default: JSON.parse(readFileSync('lib/nav-config.json', 'utf8')) };
    if (id === '@/lib/runtime/investment-availability') return { INVESTMENT_ALLOCATION_ENABLED: enabled };
    if (id === './Website43Navbar') return {};
    if (id.includes('CookieSettingsButton')) return { __esModule: true, default: (props) => React.createElement('button', props, 'Cookie settings') };
    return require(id);
  };
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const compiledModule = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(dependencies, compiledModule, compiledModule.exports);
  return compiledModule.exports[name];
}


const fingerprint = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const navbarSnapshots = (source, investmentEnabled = false) => {
  const snapshots = [];
  for (const pathname of ['/', '/blog/', '/blog/personal-finance/example/', '/play/money-story/', '/tools/financial-health-check/', '/ci-planning/', '/tools/investment-allocation/']) {
    for (const props of [{}, { overlay: true }, { notFound: true }, { responsiveOverlay: true }]) {
      for (const state of [[false, false, false], [false, true, false], [true, false, false], [true, false, true]]) {
        snapshots.push(renderToStaticMarkup(React.createElement(component(source, 'Website43Navbar', pathname, [...state]), { ...props, investmentEnabled })));
      }
    }
  }
  return snapshots;
};
const footerSnapshots = (source, investmentEnabled = false) => {
  enabled = investmentEnabled;
  const snapshots = [];
  for (const warnings of [false, true]) for (const notFound of [false, true]) {
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(renderToStaticMarkup(React.createElement(component(source, 'Website43Footer', '/'), { warnings, notFound })));
    dom.window.document.querySelector('.footerCompact')?.remove();
    snapshots.push(dom.window.document.querySelector('footer').outerHTML);
    dom.window.close();
  }
  return snapshots;
};
test('approved motion styling and unchanged responsive media order match the frozen UAT baseline', () => {
  assert.equal(fingerprint(stylesheetRules(after('Website43.module.css'))), baseline.activeCss);
  assert.equal(fingerprint(stylesheetRules(after('Website43ResponsiveStyles.tsx'), true)), baseline.responsiveCss);
  assert.equal(fingerprint(after('Website43Navbar.module.css')), baseline.navbarCss, 'canonical navbar layout and approved short interaction cues remain frozen');
  assert.doesNotMatch(after('Website43ResponsiveStyles.tsx'), /styles\.(?:navBand|navOverlay|responsiveOverlayBand)/);
  for (const name of inactive) assert.doesNotMatch(after('Website43.module.css'), new RegExp(`\\.${name}\\b`), `inactive module class ${name}`);
});

test('navbar disclosure states preserve current UX DOM, labels, links, aria and tracking with Beta off/on', () => {
  assert.equal(fingerprint(navbarSnapshots(after('Website43Navbar.tsx'))), baseline.navbarDomOff);
  if (investmentCapable) assert.equal(fingerprint(navbarSnapshots(after('Website43Navbar.tsx'), true)), baseline.navbarDomOn);
});

test('unified footer preserves original desktop content with Beta off/on including 404', () => {
  assert.doesNotMatch(after('Website43Shared.tsx'), /styles\.footerCompact/);
  assert.equal(fingerprint(footerSnapshots(after('Website43Shared.tsx'))), baseline.footerDomOff);
  if (investmentCapable) assert.equal(fingerprint(footerSnapshots(after('Website43Shared.tsx'), true)), baseline.footerDomOn);
});

test('native navbar clicks and Escape keep existing disclosure and focus behavior', async () => {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://ccpun.com/' });
  const original = new Map();
  for (const name of ['window', 'self', 'document', 'Element', 'HTMLElement', 'Event', 'KeyboardEvent', 'MouseEvent']) {
    original.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  }
  const previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = require('react-dom/client');
  const root = createRoot(document.getElementById('root'));
  try {
    await React.act(() => root.render(React.createElement(component(after('Website43Navbar.tsx'), 'Website43Navbar', '/play/money-story/', null))));
    const click = async (selector) => { await React.act(() => document.querySelector(selector).click()); };
    const escape = async () => { await React.act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))); };
    await click('.navToolsButton');
    assert.equal(document.querySelectorAll('#home-tools-navigation a').length, 3);
    assert.equal(document.querySelector('#home-tools-navigation a').getAttribute('aria-current'), 'page');
    await escape();
    assert.equal(document.querySelector('#home-tools-navigation'), null);
    assert.equal(document.activeElement, document.querySelector('.navToolsButton'));
    await click('.hamburger');
    await click('.mobileTools > button');
    assert.equal(document.querySelectorAll('.mobileSubmenu a').length, 3);
    document.querySelector('.mobileSubmenu a').addEventListener('click', (event) => event.preventDefault());
    await click('.mobileSubmenu a');
    assert.equal(document.querySelector('#mobile-navigation'), null);
    await click('.hamburger');
    await escape();
    assert.equal(document.querySelector('#mobile-navigation'), null);
    assert.equal(document.activeElement, document.querySelector('.hamburger'));
  } finally {
    await React.act(() => root.unmount());
    dom.window.close();
    for (const [name, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  }
});
