import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const layout = read('app/layout.tsx');
const clientWidgets = read('features/analytics/components/ClientWidgets.tsx');
const website43Shared = read('components/layout/website-43/Website43Shared.tsx');
const website43Navbar = read('components/layout/website-43/Website43Navbar.tsx');

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

console.log('Public shell performance regression checks passed.');
