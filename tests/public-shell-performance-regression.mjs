import { productionCmsDisplaySource, assertProductionCmsOwner, cmsNativeFollowupOwners } from '../qa/production-cms-source-proof.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';

const read = (path) => productionCmsDisplaySource(path,readFileSync(new URL(`../${path}`, import.meta.url),'utf8'));
const layout = read('app/layout.tsx');
const nextConfig = read('next.config.ts');
const draftPreviewRuntime = read('components/preview/DraftPreviewRuntime.tsx');
const draftPreviewRuntimeNoop = read('components/preview/DraftPreviewRuntimeNoop.tsx');
const sanityLive = read('lib/sanity-live.ts');
const sanityPreviewLive = read('lib/admin/sanity-preview-live.ts');
const sanityFetch = read('lib/content/sanity-fetch.ts');
const clientWidgets = read('features/analytics/components/ClientWidgets.tsx');
const googleTagManager = read('features/analytics/components/GoogleTagManager.tsx');
const website43Shared = read('components/layout/website-43/Website43Shared.tsx');
const website43Navbar = read('components/layout/website-43/Website43Navbar.tsx');
const website43NavbarStyles = read('components/layout/website-43/Website43Navbar.module.css');
const website43ResponsiveStyles = read('components/layout/website-43/Website43ResponsiveStyles.tsx');
const website43Blog = read('features/blog/website-43/Website43Blog.tsx');
const website43BlogInteractive = read('features/blog/website-43/Website43BlogInteractive.tsx');
const blogCategoryPage = read('features/blog/pages/BlogCategoryPage.tsx');

assert.match(
  layout,
  /preload:\s*false/,
  'Kanit must not preload every Thai and Latin weight ahead of the Home LCP image',
);
assert.match(
  layout,
  /const isDraftMode = IS_DRAFT_PREVIEW_ALLOWED \? \(await draftMode\(\)\)\.isEnabled : false;/,
  'Public web must not read Draft Mode when Draft Preview is unavailable',
);
assert.doesNotMatch(
  layout,
  /import\s+DraftPreviewRuntime\s+from\s+["']@\/components\/preview\/DraftPreviewRuntime["']/,
  'Public root layout must not statically import the preview boundary into the shared graph',
);
const previewRuntimeEnvironmentBlock = nextConfig.match(
  /const USE_REAL_DRAFT_PREVIEW_RUNTIME = \[([\s\S]*?)\]\.includes\(APP_ENVIRONMENT\);/,
)?.[1] ?? '';
for (const environment of ['development', 'local-uat', 'local-production', 'admin-uat', 'production-admin']) {
  assert.match(
    previewRuntimeEnvironmentBlock,
    new RegExp(`['"]${environment}['"]`),
    `${environment} must keep the real Draft Preview runtime`,
  );
}
assert.doesNotMatch(
  previewRuntimeEnvironmentBlock,
  /["'](?:web-uat|production)["']/,
  'Public web build environments must resolve Draft Preview to the no-op boundary',
);
assert.match(
  nextConfig,
  /resolveAlias:[\s\S]*["']@\/components\/preview\/DraftPreviewRuntime["']:[\s\S]*USE_REAL_DRAFT_PREVIEW_RUNTIME[\s\S]*DraftPreviewRuntime\.tsx[\s\S]*DraftPreviewRuntimeNoop\.tsx/,
  'Turbopack must resolve the root Draft Preview import at build time',
);
assert.match(draftPreviewRuntimeNoop, /import ["']server-only["'];/);
assert.match(draftPreviewRuntimeNoop, /return null;/);
assert.doesNotMatch(
  draftPreviewRuntimeNoop,
  /SanityLive|VisualEditing|next-sanity|sanity-preview-live/,
  'Public Draft Preview no-op must contain no preview client references',
);
assert.match(
  layout,
  /if \(IS_DRAFT_PREVIEW_ALLOWED\) \{[\s\S]*await import\(["']@\/components\/preview\/DraftPreviewRuntime["']\)[\s\S]*draftPreviewRuntime =/,
  'Root shell must import the entire preview boundary only after the deployment preview gate passes',
);
assert.match(
  layout,
  /\{draftPreviewRuntime\}/,
  'Root shell must render only the gated server-side preview boundary result',
);
assert.doesNotMatch(
  layout,
  /from ["']next-sanity\/visual-editing["']|from ["']@\/lib\/(?:sanity-live|admin\/sanity-preview-live)["']/,
  'Public root layout must not statically import preview client runtimes',
);
assert.match(
  draftPreviewRuntime,
  /import ["']server-only["'];/,
  'Draft preview boundary must remain server-only',
);
assert.match(
  draftPreviewRuntime,
  /if \(!enabled\) return null;[\s\S]*import\(["']@\/lib\/admin\/sanity-preview-live["']\)[\s\S]*import\(["']\.\/LiveVisualEditing["']\)/,
  'Sanity Live and Visual Editing must only be imported from preview-only modules after the preview gate passes',
);
assert.match(read('components/preview/LiveVisualEditing.tsx'), /from "next-sanity\/visual-editing"[\s\S]*<VisualEditing refresh=\{async \(\) => \{ router\.refresh\(\); \}\}/, 'native mutation refresh remains inside the gated preview client wrapper');
assert.match(
  draftPreviewRuntime,
  /<SanityLive includeDrafts=\{isDraftMode\} \/>[\s\S]*isDraftMode \? <VisualEditing \/>/,
  'Allowed preview environments must preserve Sanity Live and draft visual editing behavior',
);
assert.match(
  sanityLive,
  /export \{ sanityFetch \} from ["']@\/lib\/content\/sanity-fetch["']/,
  'Legacy public Sanity entry must delegate only to the content-owned server fetch module',
);
assert.doesNotMatch(
  sanityLive,
  /defineLive|next-sanity\/live|SanityLive/,
  'Public Sanity fetch entry must not carry preview live client references',
);
assert.match(
  sanityPreviewLive,
  /defineLive[\s\S]*export const SanityLive/,
  'Preview-only Sanity module must retain the live preview bridge',
);
assert.doesNotMatch(
  sanityFetch,
  /defineLive|next-sanity\/live|VisualEditing/,
  'Public server fetch implementation must stay free of preview client tooling',
);
assert.match(
  clientWidgets,
  /metaPixelId && isMetaPixelSurface && <MetaPixel pixelId=\{metaPixelId\} \/>/,
  'Meta Pixel bundle must stay off Home, Blog, legal, and other non-paid-tool routes',
);
assert.match(
  clientWidgets,
  /pathname === '\/ci-planning'[\s\S]*pathname === '\/tools\/financial-health-check'/,
  'Meta Pixel route gate must retain both paid tool surfaces',
);
assert.match(
  clientWidgets,
  /<GoogleTagManager gtmId=\{gtmId\} deferUntilLoad=\{pathname === '\/'\} \/>/,
  'Home must defer GTM provider startup beyond the critical paint while other public routes keep the existing startup behavior',
);
assert.match(
  googleTagManager,
  /deferUntilLoad = false[\s\S]*document\.readyState === 'complete'[\s\S]*window\.addEventListener\('load', scheduleAfterLoad, \{ once: true \}\)/,
  'Deferred GTM must wait until the Home load boundary before provider startup',
);
assert.match(
  googleTagManager,
  /requestIdleCallback\(start, \{ timeout: 1000 \}\)/,
  'Deferred Home GTM must prefer an idle slot after load instead of competing with LCP paint',
);
assert.match(
  googleTagManager,
  /const onConsent = \(\) => \{[\s\S]*if \(started\) apply\(\);/,
  'Consent changes before deferred startup must stay persisted without waking GTM during Home critical paint',
);
assert.match(
  layout,
  /<Website43ResponsiveStyles \/>/,
  'Website 4.3 responsive interpolation must have one server-rendered root owner',
);
assert.doesNotMatch(
  layout,
  /Website43(?:Transition|FinalPolish)Styles/,
  'Root shell must not reintroduce layered Website 4.3 transition/final-polish style owners',
);
assert.doesNotMatch(
  website43Shared,
  /Website43ResponsiveStyles/,
  'Large static Website 4.3 responsive style strings must stay out of the hydrated navbar bundle',
);
assert.doesNotMatch(
  website43Shared,
  /^['\"]use client['\"];?/m,
  'Static Website 4.3 footer, brand, and headings must stay server-rendered',
);
assert.match(
  website43Shared,
  /export \{ Website43Navbar \} from '\.\/Website43Navbar';/,
  'Shared Website 4.3 API must delegate only the interactive navbar to its client island',
);
assert.match(
  website43Navbar,
  /^['\"]use client['\"];?/m,
  'Interactive Website 4.3 navbar must remain an explicit client island',
);
assert.doesNotMatch(
  website43Navbar,
  /CookieSettingsButton|Website43Footer|SectionHeading/,
  'Navbar client island must not carry static footer or heading code',
);
assert.match(
  website43Navbar,
  /import styles from '\.\/Website43Navbar\.module\.css';/,
  'Navbar client island must use its narrow dedicated CSS module',
);
assert.doesNotMatch(
  website43Navbar,
  /Website43\.module\.css/,
  'Navbar client island must not import the all-surface Website 4.3 CSS map',
);
assert.match(
  website43NavbarStyles,
  /\.navBand[\s\S]*--w43-nav-gutter[\s\S]*@media \(max-width: 1023px\)[\s\S]*@media \(max-width: 639px\)/,
  'Dedicated navbar styles must preserve the existing fluid desktop, tablet, and mobile gutter contract',
);
assert.doesNotMatch(
  website43NavbarStyles,
  /\.navOverlay\s*\{[^}]*max-width:/,
  'Overlay navbar must keep the existing wide-screen fluid width instead of introducing a new 1280px cap',
);
assert.doesNotMatch(
  website43NavbarStyles,
  /\.homeHero|\.articleHeader|\.toolHero|\.footerWrap/,
  'Dedicated navbar CSS must not carry unrelated Home, Article, Tool, or Footer style maps',
);
assert.match(
  website43ResponsiveStyles,
  /\.\$\{styles\.homeHero\}\s*\{\s*height:\s*auto;\s*min-height:\s*780px;\s*isolation:\s*isolate;/,
  'Mobile Home hero must grow with readable content while retaining its minimum image area and paint isolation',
);
assert.match(
  website43ResponsiveStyles,
  /\.\$\{styles\.homeHeroPicture\}\s*\{[\s\S]*contain:\s*layout paint/,
  'Mobile Home LCP image paint must remain isolated from the rest of the page layout',
);
assert.match(
  website43ResponsiveStyles,
  /\.\$\{styles\.homeHeroBottomGradient\}\s*\{\s*display:\s*none;/,
  'Mobile Home must keep the lower readability fade folded into the primary gradient layer',
);
assert.match(
  website43ResponsiveStyles,
  /Keep all responsive[\s\S]*here instead of adding another hotfix\/polish style layer/,
  'Responsive style ownership must document the no-new-patch-layer rule',
);

assert.doesNotMatch(
  website43Blog,
  /^['\"]use client['\"];?/m,
  'Blog Hero, shared shell, topic content and footer must stay server-rendered',
);
assert.match(
  website43Blog,
  /<Website43Navbar overlay \/>[\s\S]*<Website43BlogInteractive[\s\S]*<Website43Footer flushBottom copy=\{siteCopyOverride\} \/>/,
  'Blog shell must keep the existing Hero/Navbar/content/Footer order while delegating only interactions to the client island',
);
assert.match(
  website43Blog,
  /categories\?: Website43BlogCategoryItem\[\]/,
  'Blog shell must accept only the minimal category label/slug registry projection required by the interactive island',
);
assert.match(
  website43Blog,
  /const blogCategories: Website43BlogCategoryItem\[\] = \[\{ slug: null, title: 'ทุกหมวดหมู่' \}, \.\.\.categories\]/,
  'Blog shell must prepend the all-category option without importing a client-side taxonomy registry',
);
assert.doesNotMatch(
  website43Blog,
  /BLOG_TOPIC_HUBS|ACTIVE_ARTICLE_CATEGORIES/,
  'Blog shell must not bundle semantic hubs or a hard-coded physical category registry',
);
assert.match(
  website43Blog,
  /classNames=\{BLOG_CLIENT_CLASS_NAMES\}/,
  'Blog client island must receive exact server-resolved Website 4.3 class names without importing the full CSS-module map',
);
assert.match(
  website43BlogInteractive,
  /^['\"]use client['\"];?/m,
  'Blog carousel/search/category behavior must remain in an explicit client island',
);
assert.doesNotMatch(
  website43BlogInteractive,
  /Website43\.module\.css|Website43Footer|Website43Navbar|BLOG_TOPIC_HUBS|ACTIVE_ARTICLE_CATEGORIES/,
  'Blog client island must not pull the all-surface CSS map, static shell, or taxonomy registry into its client bundle',
);
assert.match(
  website43BlogInteractive,
  /featuredScrollerRef[\s\S]*syncFeaturedDot[\s\S]*nativeReplaceState\.call/,
  'Blog client island must preserve carousel state and live search URL behavior through native History state updates',
);
assert.match(
  website43BlogInteractive,
  /FEATURED_AUTOPLAY_MS = 4000[\s\S]*featuredCount < 2 \|\| autoplayStopped[\s\S]*setInterval\([\s\S]*document\.hidden[\s\S]*featuredHoverRef\.current[\s\S]*viewport\.contains\(document\.activeElement\)[\s\S]*prefers-reduced-motion[\s\S]*centerFeaturedCard\(featuredCount \+ activeFeatured \+ 1\)/,
  'Featured articles should advance every four seconds without moving while hovered, focused, hidden, or in reduced-motion mode',
);
assert.match(
  website43BlogInteractive,
  /scrollFeaturedTo = \(index: number\) => \{\s*setAutoplayStopped\(true\)[\s\S]*onPointerDown=\{\(\) => setAutoplayStopped\(true\)\}/,
  'Manual dot selection or swipe should stop featured autoplay for the current session',
);
assert.doesNotMatch(website43BlogInteractive, /featuredAutoplayButtonRef|เลื่อนอัตโนมัติ:/, 'Featured carousel should not render a visible autoplay toggle');
assert.match(
  blogCategoryPage,
  /const getArticlesForRequest = cache\(\(includeDrafts: boolean\) =>[\s\S]*listArticles\(\{ includeDrafts \}\)/,
  'Blog category metadata and page render must share one request-scoped article accessor keyed by preview visibility',
);
assert.match(
  blogCategoryPage,
  /const getRegistryForRequest = cache\(\(includeDrafts: boolean\) =>[\s\S]*listCategoryRegistry\(\{ includeDrafts \}\)/,
  'Blog category metadata and page render must share one request-scoped Category Registry accessor',
);
assert.match(
  blogCategoryPage,
  /const includeDrafts = IS_DRAFT_PREVIEW_ALLOWED && isEnabled/,
  'Draft cookies must not bypass the deployment preview gate while category and article reads share preview state',
);

// Exercise the actual navbar with both menus open, including each canonical and
// pre-redirect pathname. Hooks are controlled here; link and active-state logic run.
{
  const require = createRequire(import.meta.url);
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { JSDOM } = require('jsdom');
  const registry = loadFixtureModule('lib/content/public-copy-registry.ts');
  const tools = ['/play/money-story/', '/tools/financial-health-check/', '/ci-planning/'];
  for (const pathname of ['/', '/blog', '/blog/', '/blog/health/example/', ...tools.flatMap(path => [path, path.slice(0, -1)])]) {
    const mocks = new Map([
      ['react', { ...React, useState: () => [true, () => {}], useRef: () => ({ current: null }), useEffect: () => {} }],
      ['next/navigation', { usePathname: () => pathname }],
      ['@/components/ui/PublicCopyProvider', { usePublicCopy: () => registry.publicCopyText(registry.parsePublicCopy('site', null)) }],
      ['./Website43Navbar.module.css', { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }],
    ]);
    const { Website43Navbar } = loadFixtureModule('components/layout/website-43/Website43Navbar.tsx', { mocks });
    const dom = new JSDOM(renderToStaticMarkup(Website43Navbar({})));
    const document = dom.window.document;
    for (const path of ['/blog/', ...tools]) {
      assert.equal(document.querySelectorAll(`a[href="${path}"]`).length, 2, 'desktop and mobile use the final canonical route');
      assert.equal(document.querySelectorAll(`a[href="${path.slice(0, -1)}"]`).length, 0, 'no redirecting nav link');
    }
    const activeTool = tools.find(path => path === pathname || path.slice(0, -1) === pathname);
    assert.equal(document.querySelectorAll('button[data-active="true"]').length, activeTool ? 2 : 0, 'both Tools buttons retain current-page state');
    for (const path of tools) assert.equal(document.querySelectorAll(`a[href="${path}"][aria-current="page"]`).length, path === activeTool ? 2 : 0);
    assert.equal(document.querySelectorAll('a[href="/blog/"][aria-current="page"]').length, /^\/blog\/?$/.test(pathname) ? 2 : 0);
    assert.equal(document.querySelectorAll('a[href="/blog/"][aria-current="location"]').length, pathname.startsWith('/blog/') && pathname !== '/blog/' ? 2 : 0);
    dom.window.close();
  }
  for (const file of ['components/layout/website-43/Website43Navbar.tsx', 'components/layout/website-43/Website43Shared.tsx', 'features/home/website-43/Website43HomeStatic.tsx', 'features/home/website-43/Website43Home.tsx', 'features/blog/website-43/Website43Article.tsx']) {
    const source = readFileSync(file, 'utf8');
    assertProductionCmsOwner(file, source);
    for (const changed of [source.replace('/blog/`', '/blog`'), source.replace('/blog/`', '/unowned/`'), source + '\n// unknown source change\n', source.replace('href={`${BASE}/blog/`}', 'href={`${BASE}/blog/`} data-unreviewed="yes"')]) {
      assert.notEqual(changed, source);
      assert.throws(() => assertProductionCmsOwner(file, changed), 'only exact canonical href changes can bridge the frozen source');
    }
    if (file.endsWith('/Website43Navbar.tsx')) assert.throws(() => assertProductionCmsOwner(file, source.replace("href.replace(/\\/$/, '')", 'href')), 'missing normalization cannot silently clear the active tool');
  }
  const authorFile = 'lib/content/sanity.ts';
  const authorSource = readFileSync(authorFile, 'utf8');
  assertProductionCmsOwner(authorFile, authorSource);
  for (const mutant of [
    authorSource.replace('cache(unstable_cache(', 'unstable_cache('),
    authorSource.replace('revalidate: 300', 'revalidate: 3600'),
    authorSource.replace('PRIMARY_AUTHOR_FETCH_TIMEOUT_MS = 2000', 'PRIMARY_AUTHOR_FETCH_TIMEOUT_MS = 20000'),
    authorSource.replace('tags: ["ccpun-primary-author"]', 'tags: []'),
    authorSource.replace('  getSanityPreviewClient();\n', ''),
    authorSource.replace('perspective: "published" | "drafts" = "published"', 'perspective: "published" | "drafts" = "drafts"'),
    authorSource + '\n// unknown author change\n',
  ]) assert.throws(() => assertProductionCmsOwner(authorFile, mutant), 'request memoization cannot admit a changed author reader');
  for (const [file, { before, after }] of Object.entries(cmsNativeFollowupOwners)) {
    assert.notEqual(before, after, 'the exact reviewed successor never admits the predecessor');
    const source = readFileSync(file, 'utf8');
    assertProductionCmsOwner(file, source);
    assert.throws(() => assertProductionCmsOwner(file, source + '\n// unknown successor edit\n'));
  }
}

// Execute the real progressive enhancer through phone/tablet/desktop resizing.
{
  const require=createRequire(import.meta.url),React=require('react');
  const {JSDOM}=require('jsdom');
  const dom=new JSDOM(`<div id="enhancer-root"></div><header data-v5-header><nav><ul><li data-v5-dropdown><button aria-expanded="false">Topics</button><a href="/blog/">Article</a></li></ul></nav><button data-v5-theme-toggle data-labels='{"light":"Light","system":"System","dark":"Dark"}'>Theme</button><div data-v5-theme-group><button data-v5-theme-choice="light" tabindex="-1">Light</button><button data-v5-theme-choice="system" tabindex="0">System</button><button data-v5-theme-choice="dark" tabindex="-1">Dark</button></div><button data-v5-menu-toggle data-label-open="Open" data-label-close="Close">Menu</button><nav id="mobile-navigation" hidden><a href="/about/">About</a></nav></header>`,{url:'https://test.ccpun.com/'});
  const saved=new Map(['window','document','localStorage'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const key of saved.keys())Object.defineProperty(globalThis,key,{configurable:true,value:dom.window[key]});
  let width=390;const media=[];
  window.matchMedia=query=>{const min=Number(query.match(/min-width:\s*(\d+)/)?.[1]??Infinity);const listeners=new Set();const item={matches:width>=min,media:query,addEventListener(_name,fn){listeners.add(fn);},removeEventListener(_name,fn){listeners.delete(fn);},listeners,min};media.push(item);return item;};
  window.requestAnimationFrame=()=>1;window.cancelAnimationFrame=()=>{};
  const {createRoot}=require('react-dom/client'),{flushSync}=require('react-dom');
  const Enhancer=loadFixtureModule('components/layout/v5/V5HeaderEnhancer.tsx').default;
  const root=createRoot(document.getElementById('enhancer-root'));
  try{
    flushSync(()=>root.render(React.createElement(Enhancer,{storageKey:'header-fixture-theme'})));
    const menu=document.getElementById('mobile-navigation'),toggle=document.querySelector('[data-v5-menu-toggle]');
    const mobileTheme=document.querySelector('[data-v5-theme-toggle]');
    const resize=next=>{width=next;for(const item of media){const matches=width>=item.min;if(item.matches!==matches){item.matches=matches;for(const listener of item.listeners)listener({matches});}}};
    for(const target of [768,820,834,1024]){
      resize(390);toggle.click();assert.equal(menu.hidden,false);menu.querySelector('a').focus();resize(target);
      assert.equal(menu.hidden,true,`open phone menu closes at ${target}`);assert.equal(toggle.getAttribute('aria-expanded'),'false');
      assert.ok(document.activeElement.matches('[data-v5-theme-choice]'),`focus moves to visible full theme control at ${target}`);
      resize(390);assert.equal(document.activeElement,mobileTheme,'returning to phone moves theme focus to its visible toggle');
      assert.equal(menu.hidden,true);assert.equal(document.body.style.overflow,'');assert.equal(document.querySelector('[inert]'),null);
    }
    resize(820);const light=document.querySelector('[data-v5-theme-choice="light"]');light.click();assert.equal(document.documentElement.dataset.themeChoice,'light');
    light.dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));assert.equal(document.documentElement.dataset.themeChoice,'system');
    assert.equal(document.activeElement.dataset.v5ThemeChoice,'system');
    const dropdown=document.querySelector('[data-v5-dropdown] > button');dropdown.click();assert.equal(dropdown.getAttribute('aria-expanded'),'true');dropdown.focus();resize(390);assert.equal(dropdown.getAttribute('aria-expanded'),'false');assert.equal(document.activeElement,toggle);
  }finally{flushSync(()=>root.unmount());await new Promise(resolve=>setImmediate(resolve));dom.window.close();for(const[key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
}

// Keep the existing author regression in test:public/check:foundation, including
// the actual RSC request cache and private preview guard checks.
execFileSync(process.execPath, ['--import', 'tsx', '--test', 'tests/author-profile-schema-sync.test.ts'], { stdio: 'inherit' });
// Sanity text editor: sizes, plain-text safety, and a current page-location map
// for every editable key (regenerate with scripts/generate-public-copy-locations.mjs).
execFileSync(process.execPath, ['--import', 'tsx', '--test', 'tests/public-copy-editor.test.ts'], { stdio: 'inherit' });
execFileSync(process.execPath, ['--import', 'tsx', 'scripts/generate-public-copy-locations.mjs', '--check'], { stdio: 'inherit' });
console.log('Public shell performance regression checks passed, including canonical navigation and active states.');
