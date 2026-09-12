import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const layout = read('app/layout.tsx');
const clientWidgets = read('features/analytics/components/ClientWidgets.tsx');
const googleTagManager = read('features/analytics/components/GoogleTagManager.tsx');
const website43Shared = read('components/layout/website-43/Website43Shared.tsx');
const website43Navbar = read('components/layout/website-43/Website43Navbar.tsx');
const website43FinalPolish = read('components/layout/website-43/Website43FinalPolishStyles.tsx');

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
assert.match(
  layout,
  /\{IS_DRAFT_PREVIEW_ALLOWED \? <SanityLive includeDrafts=\{IS_DRAFT_PREVIEW_ALLOWED && isDraftMode\} \/> : null\}/,
  'Sanity Live must stay confined to environments that support Draft Preview',
);
assert.doesNotMatch(
  layout,
  /^\s*<SanityLive includeDrafts=/m,
  'Sanity Live must never mount unconditionally on the public shell',
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

console.log('Public shell performance regression checks passed.');
