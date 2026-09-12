import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
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
const website43FinalPolish = read('components/layout/website-43/Website43FinalPolishStyles.tsx');
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
  /if \(!enabled\) return null;[\s\S]*import\(["']@\/lib\/admin\/sanity-preview-live["']\)[\s\S]*import\(["']next-sanity\/visual-editing["']\)/,
  'Sanity Live and Visual Editing must only be imported from preview-only modules after the preview gate passes',
);
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
  /<Website43TransitionStyles \/>[\s\S]*<Website43FinalPolishStyles \/>/,
  'Website 4.3 responsive style bridges must render on the server shell',
);
assert.doesNotMatch(
  website43Shared,
  /Website43(?:Transition|FinalPolish)Styles/,
  'Large static Website 4.3 style strings must stay out of the hydrated navbar bundle',
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
  website43FinalPolish,
  /\.\$\{styles\.homeHero\}\s*\{[\s\S]*height:\s*clamp\(740px,[\s\S]*760px\)/,
  'Mobile Home hero must interpolate between the 390 canonical and 600 transition reference instead of locking one height',
);
assert.match(
  website43FinalPolish,
  /\.\$\{styles\.homeHeroPicture\}\s*\{[\s\S]*contain:\s*layout paint/,
  'Mobile Home LCP image paint must remain isolated from the rest of the page layout',
);
assert.match(
  website43FinalPolish,
  /\.\$\{styles\.homeHeroBottomGradient\}\s*\{\s*display:\s*none;/,
  'Mobile Home must keep the lower readability fade folded into the primary gradient layer',
);

assert.doesNotMatch(
  website43Blog,
  /^['\"]use client['\"];?/m,
  'Blog Hero, shared shell, topic content and footer must stay server-rendered',
);
assert.match(
  website43Blog,
  /<Website43Navbar overlay \/>[\s\S]*<Website43BlogInteractive[\s\S]*<Website43Footer \/>/,
  'Blog shell must keep the existing Hero/Navbar/content/Footer order while delegating only interactions to the client island',
);
assert.match(
  website43Blog,
  /BLOG_TOPIC_HUBS\.map\(\(\{ slug, title \}\) => \(\{ slug, title \}\)\)/,
  'Blog shell must pass only the minimal category label/slug data required by the interactive island',
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
  /Website43\.module\.css|Website43Footer|Website43Navbar|BLOG_TOPIC_HUBS/,
  'Blog client island must not pull the all-surface CSS map, static shell, or full taxonomy module into its client bundle',
);
assert.match(
  website43BlogInteractive,
  /featuredScrollerRef[\s\S]*syncFeaturedDot[\s\S]*window\.history\.replaceState/,
  'Blog client island must preserve carousel state and live search URL behavior',
);
assert.match(
  blogCategoryPage,
  /const getPublishedArticlesForRequest = cache\(\(\) =>[\s\S]*listArticles\(\{ includeDrafts: false \}\)/,
  'Blog category metadata and page render must share one request-scoped published-article read',
);
assert.equal(
  (blogCategoryPage.match(/listArticles\(\{ includeDrafts: false \}\)/g) ?? []).length,
  1,
  'Blog category must keep exactly one underlying published listArticles read declaration',
);
assert.equal(
  (blogCategoryPage.match(/await getPublishedArticlesForRequest\(\)/g) ?? []).length,
  2,
  'Blog category metadata and page render must both use the request-scoped accessor',
);

console.log('Public shell performance regression checks passed.');
