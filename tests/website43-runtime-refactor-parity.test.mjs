import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const postcss = require('postcss');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
// Production baseline: ede3513af5b7ba5181885718663d6dc4edaa2250. Captured once; shallow CI needs no Git history.
const baseline = {
  "activeCss": "aa2c97c25232f2fbc30e6a5b456e829a27c0a8504ed0ee3bd38543b8b3cfb923",
  "responsiveCss": "57706f7a78a134699bf6fbe5b97452347c26b17c3b6ec2d101604f5384924310",
  "navbarCss": "f73888211aa36e60d00fb564b417e9cdcded8c4d6f7dc94b8cedafb98388d752",
  "navbarDom": "c9b2e505355783f485fc1609ffd769dc21700ec7a3ebd712e34b48fa1c7654ed",
  "footerDom": "db903aa6d7c7bdb589a3841c2a5be6cb59459e374cc314cfdaedf6b3855f489b"
};
// Approved 2026-10-14 footer tagline removal + blog-only end flush. Original Production golden object remains unchanged.
const reviewedCurrent = {
  "activeCss": "4c655ff9ca2484644114addcd7f9a5d53e70b6046a04b45600316eb788d3949d",
  "responsiveCss": "1d1f2510d7e6a64998498f47c8e668fc694f81710bb425558eddb0d43a1325c9",
  "navbarCss": "8bb36bb9ada57b280384145e56412db668663f1ee6cdc37d9bed7a2922498e99",
  "footerDesktopDom": "53e42deb5ddf5e7dd671694437c80e569b9e15094e1549d43ff3276b1ebf6122"
};
const directory = 'components/layout/website-43/';
const after = (file) => readFileSync(directory + file, 'utf8');
const inactive = new Set(['nav', 'hamburger', 'mobileMenu', 'mobileSubmenu', 'mobileTools', 'navBand', 'navChevron', 'navChevronOpen', 'navCta', 'navDropdown', 'navLinks', 'navOverlay', 'navSpacer', 'navTools', 'navToolsButton', 'notFoundNavBand', 'responsiveOverlayBand', 'reading']);

// Compare ordered selectors/declarations/media ancestry, ignoring only proven inactive selectors.
function stylesheetRules(source, responsive = false) {
  const css = responsive
    ? [...source.matchAll(/String\.raw`([\s\S]*?)`/g)].map(([, body]) => body.replace(/\$\{styles\.(\w+)\}/g, 'W43REF_$1')).join('\n')
    : source;
  const ast = postcss.parse(css);
  const records = [];
  ast.walkRules((rule) => {
    const selectors = postcss.list.comma(rule.selector).filter((selector) => ![...selector.matchAll(/\.([\w-]+)/g)].some(([, name]) => inactive.has(name.replace(/^W43REF_/, ''))));
    if (!selectors.length) return;
    const media = rule.parent.type === 'atrule' ? rule.parent.params : '';
    if (responsive && media === '(max-width: 1023px)' && selectors.join(', ') === '.W43REF_toolHero .W43REF_primaryButton') return;
    if (responsive && media === '(max-width: 639px)' && selectors[0] === '.W43REF_section' && rule.nodes.every((d) => ['padding-left', 'padding-right'].includes(d.prop) && d.value === 'var(--w43-content-gutter)')) return;
    const ancestry = [];
    for (let parent = rule.parent; parent.type !== 'root'; parent = parent.parent) ancestry.unshift([parent.name, parent.params]);
    records.push([selectors, rule.nodes.filter((n) => n.type === 'decl').map((n) => [n.prop, n.value, Boolean(n.important)]), ancestry]);
  });
  return records;
}


const styles = new Proxy({}, { get: (_, property) => String(property) });
function component(source, name, pathname, state = []) {
  const hooks = state === null ? React : { ...React, useState: (initial) => [state.length ? state.shift() : initial, () => {}] };
  const dependencies = (id) => {
    if (id.endsWith('.module.css')) return { __esModule: true, default: styles };
    if (id === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
    if (id === 'next/navigation') return { usePathname: () => pathname };
    if (id === 'react') return hooks;
    if (id === './constants') return { WEBSITE43_BASE: '', WEBSITE43_HOME: '/' };
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
const navbarSnapshots = (source) => {
  const snapshots = [];
  for (const pathname of ['/', '/blog/', '/blog/personal-finance/example/', '/play/money-story/', '/tools/financial-health-check/', '/ci-planning/']) {
    for (const props of [{}, { overlay: true }, { notFound: true }, { responsiveOverlay: true }]) {
      for (const state of [[false, false, false], [false, true, false], [true, false, false], [true, false, true]]) {
        snapshots.push(renderToStaticMarkup(React.createElement(component(source, 'Website43Navbar', pathname, [...state]), props)));
      }
    }
  }
  return snapshots;
};
const footerSnapshots = (source) => {
  const snapshots = [];
  for (const warnings of [false, true]) for (const notFound of [false, true]) snapshots.push(renderToStaticMarkup(React.createElement(component(source, 'Website43Footer', '/'), { warnings, notFound })));
  return snapshots;
};
test('reviewed stylesheet outputs stay frozen while original Production CSS goldens remain retained', () => {
  assert.equal(fingerprint(stylesheetRules(after('Website43.module.css'))), reviewedCurrent.activeCss);
  assert.equal(fingerprint(stylesheetRules(after('Website43ResponsiveStyles.tsx'), true)), reviewedCurrent.responsiveCss);
  assert.equal(fingerprint(after('Website43Navbar.module.css')), reviewedCurrent.navbarCss, 'canonical navbar styling includes only reviewed responsive/control feedback');
  assert.doesNotMatch(after('Website43ResponsiveStyles.tsx'), /styles\.(?:navBand|navOverlay|responsiveOverlayBand)/);
  for (const name of inactive) assert.doesNotMatch(after('Website43.module.css'), new RegExp(`\\.${name}\\b`), `inactive module class ${name}`);
});

test('96 navbar disclosure states preserve DOM, labels, links, aria and tracking attributes', () => {
  const source = after('Website43Navbar.tsx');
  assert.equal((source.match(/className=\{styles\.brandLink\}/g) ?? []).length, 1);
  const parts = source.replace(' className={styles.brandLink}', '').split('<div className={styles.mobileSubmenu}>');
  assert.equal(parts.length,2);
  assert.equal((parts[1].match(/<span aria-hidden="true" \/>\{label\}/g) ?? []).length,1);
  const originalUi = parts[0] + '<div className={styles.mobileSubmenu}>' + parts[1].replace('<span aria-hidden="true" />{label}', '{label}');
  assert.equal(fingerprint(navbarSnapshots(originalUi)),baseline.navbarDom,'Only approved brand class/mobile indicator are normalized; original96DOM properties retained');
});

test('unified footer preserves links while removing approved marketing tagline in all four reviewed variants', () => {
  assert.doesNotMatch(after('Website43Shared.tsx'), /วางแผนการเงินจากชีวิตจริง|เพื่อให้คุณตัดสินใจได้อย่างมั่นใจ/);
  assert.match(after('Website43Shared.tsx'), /Website43Brand/);
  assert.match(after('Website43Shared.tsx'), /CookieSettingsButton/);
  assert.doesNotMatch(after('Website43Shared.tsx'), /styles\.footerCompact/);
  assert.equal(fingerprint(footerSnapshots(after('Website43Shared.tsx'))),reviewedCurrent.footerDesktopDom);
  assert.equal(baseline.footerDom,'db903aa6d7c7bdb589a3841c2a5be6cb59459e374cc314cfdaedf6b3855f489b','Original full/compact baseline retained as history; duplicate compact removal is explicit');
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
