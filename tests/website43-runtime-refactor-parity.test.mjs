import { assertReviewedMasterUatOwner, reviewedMasterUatOwners, canonicalNavigationPredecessor } from '../qa/phase2-source-proof.mjs';
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
  "activeCss": "b0667b266057590903178ab882dc6531de433464273dcb7ef698cdf7d5f2f240",
  "responsiveCss": "1d1f2510d7e6a64998498f47c8e668fc694f81710bb425558eddb0d43a1325c9",
  "navbarCss": "8bb36bb9ada57b280384145e56412db668663f1ee6cdc37d9bed7a2922498e99",
  "footerDesktopDom": "53e42deb5ddf5e7dd671694437c80e569b9e15094e1549d43ff3276b1ebf6122"
};
const articleV4CssFingerprint = 'e5ee6c0fda60766b8e2cb32a55f2d537fc52058236547287bab33c727ab6ba98';
const retainedLegalCssFingerprint = '8a09ef8b30735b69df506bb91acfe9aa63f4055219aca4a3a2e2ac3c4af7b227';
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


function dataExports(pathname) {
  const fixtureModule = { exports: {} };
  const compiled = ts.transpileModule(readFileSync(pathname, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('exports', 'module', compiled)(fixtureModule.exports, fixtureModule);
  return fixtureModule.exports;
}
const { SITE_COPY_DEFAULTS } = dataExports('lib/content/site-copy-defaults.ts');
const runtimeConstants = dataExports(directory + 'constants.ts');
const defaultCopyText = (values = SITE_COPY_DEFAULTS) => {
  const text = key => {
    assert.ok(Object.hasOwn(SITE_COPY_DEFAULTS, key), `Known site copy key: ${key}`);
    return values[key] ?? SITE_COPY_DEFAULTS[key];
  };
  // Unsized copy renders the same plain string through `.node` (see lib/content/public-copy-text.ts).
  return Object.assign(text, { node: text });
};
const styles = new Proxy({}, { get: (_, property) => String(property) });
function component(source, name, pathname, state = [], investmentEnabled = false) {
  const hooks = state === null ? React : { ...React, useState: (initial) => [state.length ? state.shift() : initial, () => {}] };
  const dependencies = (id) => {
    if (id.endsWith('.module.css')) return { __esModule: true, default: styles };
    if (id === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
    if (id === 'next/navigation') return { usePathname: () => pathname };
    if (id === 'react') return hooks;
    if (id === './constants' || id === '@/components/layout/website-43/constants') return runtimeConstants;
    if (id === '@/components/ui/PublicCopyProvider') return { usePublicCopy: () => defaultCopyText() };
    if (id === '@/lib/content/public-copy') return { getPublicCopy: async scope => { assert.equal(scope, 'site'); return { ...SITE_COPY_DEFAULTS }; } };
    if (id === '@/lib/content/public-copy-registry') return { publicCopyText: defaultCopyText };
    if (id === '@/lib/runtime/investment-availability') return { INVESTMENT_ALLOCATION_ENABLED: investmentEnabled };
    if (id === './Website43Navbar') return {};
    if (id.includes('CookieSettingsButton')) return { __esModule: true, default: (props) => React.createElement('button', props, 'Cookie settings') };
    return require(id);
  };
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const compiledModule = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(dependencies, compiledModule, compiledModule.exports);
  return compiledModule.exports[name];
}


// Admit only the already-deployed portrait crop fix; keep every original CSS golden.
function originalStylesExceptApprovedPortrait(source) {
  const ast = postcss.parse(source);
  const portraits = [];
  ast.walkRules('.authorAvatar', rule => { if (rule.parent.type === 'root') portraits.push(rule); });
  assert.equal(portraits.length, 1, 'One canonical author portrait rule');
  const positions = portraits[0].nodes.filter(node => node.type === 'decl' && node.prop === 'object-position');
  assert.equal(positions.length, 1, 'Only one approved author portrait position');
  assert.equal(positions[0].value, 'center top');
  assert.equal(Boolean(positions[0].important), false);
  positions[0].remove();
  return ast.toString();
}

// Current UAT approval: retire the inactive CI image carousel and add a text-only hero.
// Reconstruct the prior CSS before comparing historical goldens; never reseal a drifted stylesheet.
const retiredCiCarouselRules = [
  {
    "anchor": "\n@media (min-width: 1200px) {\n  .calculatorSection {\n    display: grid;\n",
    "rules": ".ciStoryCarouselWrap { position: relative; }\n.ciStoryViewport { position: relative; margin-top: 36px; }\n.ciStoryGrid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 16px; }\n.ciStoryGrid > :nth-child(n+4) { display: none; }\n.ciStoryCarouselControls { display: none; }\n.ciStoryCard { overflow: hidden; border: 1px solid var(--w43-border); border-radius: 16px; background: var(--w43-surface); }\n.ciStoryCard img { width: 100%; aspect-ratio: 4/3; object-fit: cover; }\n.ciStoryCard div { padding: 20px; }\n.ciStoryCard h3 { margin: 0; font-size: 20px; }\n.ciStoryCard p { margin: 10px 0 0; color: var(--w43-muted); font-size: 15px; line-height: 1.6; }\n"
  },
  {
    "anchor": "\n\n  .notFound { height: auto; padding: 72px 40px 48px; }\n  .notFoundCode { font-size: 96px; }\n",
    "rules": "  .ciStoryGrid { gap: 12px; }\n"
  },
  {
    "anchor": "\n\n\n  .notFound { padding: 48px 24px 40px; }\n",
    "rules": "  .ciStoryCarouselWrap { --ci-story-card-width: min(78vw, 430px); margin-inline: -24px; }\n  .ciStoryGrid { position: relative; display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; scroll-padding-inline: calc(50% - min(39vw, 215px)); padding-inline: calc(50% - min(39vw, 215px)); scrollbar-width: none; -webkit-overflow-scrolling: touch; }\n  .ciStoryGrid > :nth-child(n+4) { display: block; }\n  .ciStoryGrid::-webkit-scrollbar { display: none; }\n  .ciStoryGrid:focus-visible { outline: 2px solid var(--w43-gold); outline-offset: 2px; }\n  .ciStoryCard { flex: 0 0 var(--ci-story-card-width); scroll-snap-align: center; scroll-snap-stop: always; }\n  .ciStoryCarouselControls { position: absolute; inset: 0; display: block; pointer-events: none; }\n  .ciStoryCarouselControls button { position: absolute; top: 50%; width: 44px; height: 44px; display: grid; place-items: center; padding: 0; border: 1px solid var(--w43-border); border-radius: 999px; background: rgba(37,24,24,.82); color: var(--w43-gold); cursor: pointer; pointer-events: auto; transform: translateY(-50%); }\n  .ciStoryCarouselControls button:first-child { left: calc(50% - min(39vw, 215px) + 8px); }\n  .ciStoryCarouselControls button:last-child { right: calc(50% - min(39vw, 215px) + 8px); }\n  .ciStoryCarouselControls button:focus-visible { outline: 2px solid var(--w43-gold); outline-offset: 2px; }\n  .ciStoryCarouselControls svg { width: 18px; height: 18px; }\n"
  }
];
const approvedCiTextHeroCss = "\n/* ponytail: text-only tools use natural content height, without an empty image stage. */\n.root .toolHeroTextOnly { height: auto; min-height: 0; padding: 152px max(24px, calc((100% - 1280px) / 2)) 48px; background: var(--w43-bg); }\n.root .toolHeroTextOnly::after { display: none; }\n.root .toolHeroTextOnly .toolHeroCopy { position: relative; top: auto; left: auto; width: min(100%, 760px); }\n@media (max-width: 639px) {\n  .root .toolHeroTextOnly { padding-top: 120px; padding-bottom: 32px; }\n}\n";
function beforeApprovedCiTrustCss(source) {
  assert.ok(source.endsWith(approvedCiTextHeroCss), 'Only the exact reviewed text-only hero rules are admitted');
  let restored = source.slice(0, -approvedCiTextHeroCss.length);
  assert.doesNotMatch(restored, /\.ciStory(?:Card|Grid|Carousel|Viewport)/, 'Retired carousel styles must remain absent');
  for (const { anchor, rules } of retiredCiCarouselRules) {
    assert.equal(restored.split(anchor).length, 2, 'Each historical restoration anchor must be unique');
    restored = restored.replace(anchor, rules + anchor);
  }
  return restored;
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
const footerSnapshots = async (source) => {
  const snapshots = [];
  for (const warnings of [false, true]) for (const notFound of [false, true]) snapshots.push(renderToStaticMarkup(await component(source, 'Website43Footer', '/')({ warnings, notFound })));
  return snapshots;
};
test('portrait admission rejects changed position, duplicates and unrelated active CSS drift', () => {
  const css = after('Website43.module.css');
  const portrait = css.match(/\.authorAvatar\s*\{[^}]+\}/)?.[0];
  assert.ok(portrait);
  assert.throws(() => originalStylesExceptApprovedPortrait(css.replace(portrait, portrait.replace('center top', 'center bottom'))));
  assert.throws(() => originalStylesExceptApprovedPortrait(css.replace(portrait, portrait.replace('object-position: center top;', 'object-position: center top; object-position: center top;'))));
  const unrelated = css.replace(portrait, portrait.replace('width: 96px;', 'width: 97px;'));
  assert.notEqual(unrelated, css, 'Synthetic unapproved width change is present');
  assert.notEqual(fingerprint(stylesheetRules(originalStylesExceptApprovedPortrait(beforeApprovedCiTrustCss(unrelated)))), retainedLegalCssFingerprint);
});

test('reviewed stylesheet outputs stay frozen while original Production CSS goldens remain retained', () => {
  assert.equal(reviewedCurrent.activeCss, 'b0667b266057590903178ab882dc6531de433464273dcb7ef698cdf7d5f2f240', 'previous reviewed CSS pin retained');
  assert.equal(articleV4CssFingerprint, 'e5ee6c0fda60766b8e2cb32a55f2d537fc52058236547287bab33c727ab6ba98', 'pre-cleanup Article V4 output retained');
  assert.equal(reviewedCurrent.responsiveCss, '1d1f2510d7e6a64998498f47c8e668fc694f81710bb425558eddb0d43a1325c9', 'pre-cleanup responsive output retained');
  assert.equal(createHash('sha256').update(beforeApprovedCiTrustCss(after('Website43.module.css'))).digest('hex'), '973eed337a31212f28ee1210327773568a8534b6d85142ade317872ac7e49b6d', 'pre-UAT stylesheet bytes stay frozen after exact approved CI reconstruction');
  assert.equal(fingerprint(stylesheetRules(originalStylesExceptApprovedPortrait(beforeApprovedCiTrustCss(after('Website43.module.css'))))), retainedLegalCssFingerprint);
  assert.equal(fingerprint(stylesheetRules(after('Website43ResponsiveStyles.tsx'), true)), '292cfa5edc576889aeaea3bcf9eab885b839ee114154068e7959bf23ae274024');
  assert.doesNotMatch(after('Website43.module.css') + after('Website43ResponsiveStyles.tsx'), /\b(?:legalHeader|legalBody|legalGrid)\b/);
  assert.equal(fingerprint(after('Website43Navbar.module.css')), reviewedCurrent.navbarCss, 'canonical navbar styling includes only reviewed responsive/control feedback');
  assert.doesNotMatch(after('Website43ResponsiveStyles.tsx'), /styles\.(?:navBand|navOverlay|responsiveOverlayBand)/);
  for (const name of inactive) assert.doesNotMatch(after('Website43.module.css'), new RegExp(`\\.${name}\\b`), `inactive module class ${name}`);
});

test('96 navbar disclosure states preserve DOM, labels, links, aria and tracking attributes', () => {
  const current = after('Website43Navbar.tsx');
  const file = directory + 'Website43Navbar.tsx';
  assertReviewedMasterUatOwner(file, reviewedMasterUatOwners[file].before, current);
  const source = canonicalNavigationPredecessor(file, current);
  assert.equal((source.match(/className=\{styles\.brandLink\}/g) ?? []).length, 1);
  const parts = source.replace(' className={styles.brandLink}', '').split('<div className={styles.mobileSubmenu}>');
  assert.equal(parts.length,2);
  assert.equal((parts[1].match(/<span aria-hidden="true" \/>\{label\}/g) ?? []).length,1);
  const originalUi = parts[0] + '<div className={styles.mobileSubmenu}>' + parts[1].replace('<span aria-hidden="true" />{label}', '{label}');
  assert.equal(fingerprint(navbarSnapshots(originalUi)),baseline.navbarDom,'Only approved brand class/mobile indicator are normalized; original96DOM properties retained');
});

test('unified footer preserves links while removing approved marketing tagline in all four reviewed variants', async () => {
  assert.doesNotMatch(after('Website43Shared.tsx'), /วางแผนการเงินจากชีวิตจริง|เพื่อให้คุณตัดสินใจได้อย่างมั่นใจ/);
  assert.match(after('Website43Shared.tsx'), /Website43Brand/);
  assert.match(after('Website43Shared.tsx'), /CookieSettingsButton/);
  assert.doesNotMatch(after('Website43Shared.tsx'), /styles\.footerCompact/);
  const current = after('Website43Shared.tsx');
  const file = directory + 'Website43Shared.tsx';
  assertReviewedMasterUatOwner(file, reviewedMasterUatOwners[file].before, current);
  assert.equal(fingerprint(await footerSnapshots(canonicalNavigationPredecessor(file, current))),reviewedCurrent.footerDesktopDom);
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


test('CI trust CSS admission rejects changed rules while UAT investment links stay lane-gated', async () => {
  const css = after('Website43.module.css');
  assert.throws(() => beforeApprovedCiTrustCss(css.replace('padding-top: 120px; padding-bottom: 32px;', 'padding-top: 999px; padding-bottom: 32px;')));
  for (const enabled of [false, true]) {
    const Footer = component(after('Website43Shared.tsx'), 'Website43Footer', '/', [], enabled);
    const footer = renderToStaticMarkup(await Footer({}));
    assert.equal(footer.includes(runtimeConstants.INVESTMENT_TOOL_LINK.href), enabled);
    const Navbar = component(after('Website43Navbar.tsx'), 'Website43Navbar', '/tools/investment-allocation/', [false, true, false]);
    const navbar = renderToStaticMarkup(React.createElement(Navbar, { investmentEnabled: enabled }));
    assert.equal(navbar.includes(runtimeConstants.INVESTMENT_TOOL_LINK.href.replace(/\/$/, '')), enabled);
    if (enabled) assert.match(navbar, /aria-current="page"/);
  }
});


test('FHC public article link falls back only in UAT when absent, draft, partial or unavailable', async () => {
  const path = '/blog/personal-finance/financial-pyramid/';
  const source = readFileSync('features/financial-health-check/article-availability.ts', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  async function resolveLink(environment, article, failure = false) {
    let reads = 0;
    const dependencies = id => {
      if (id === 'server-only') return {};
      if (id === '@/lib/content/article-availability') {
        const sharedModule = { exports: {} };
        const sharedSource = readFileSync('lib/content/article-availability.ts', 'utf8');
        const sharedCompiled = ts.transpileModule(sharedSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
        new Function('require', 'module', 'exports', sharedCompiled)(dependencies, sharedModule, sharedModule.exports);
        return sharedModule.exports;
      }
      if (id === '@/lib/content/sanity-lane') return { resolveContentEnvironment: () => environment };
      if (id === '@/lib/content/url') return { getArticlePath: value => value.path };
      if (id === '@/lib/content/provider') return { getContentProvider: () => ({ getArticleBySlug: async (slug, options) => {
        reads++;
        assert.equal(slug, 'financial-pyramid');
        assert.deepEqual(options, { includeDrafts: false });
        if (failure) throw new Error('Synthetic provider failure');
        return article;
      } }) };
      throw new Error(`Unexpected dependency: ${id}`);
    };
    const fixtureModule = { exports: {} };
    new Function('require', 'module', 'exports', compiled)(dependencies, fixtureModule, fixtureModule.exports);
    return { href: await fixtureModule.exports.getFhcPyramidHref(), reads };
  }
  assert.deepEqual(await resolveLink('production', null, true), { href: path, reads: 0 });
  for (const environment of ['web-uat', 'local-uat', 'admin-uat']) {
    for (const article of [null, { status: 'draft', path }, { status: 'published', path: '/blog/health-insurance/financial-pyramid/' }, { status: 'published' }]) {
      assert.deepEqual(await resolveLink(environment, article), { href: '/blog/', reads: 1 });
    }
    assert.deepEqual(await resolveLink(environment, null, true), { href: '/blog/', reads: 1 });
    assert.deepEqual(await resolveLink(environment, { status: 'published', path }), { href: path, reads: 1 });
  }
  const context = readFileSync('features/financial-health-check/components/FHCLandingIntro.tsx', 'utf8');
  assert.match(context, /href=\{pyramidHref\}/);
  assert.match(context, /siteText\("site\.nav\.blog"\)/, 'Unavailable UAT article uses a truthful Blog label');
});
