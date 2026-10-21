import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read = file => readFileSync(file, 'utf8');
const css = read('components/layout/website-43/Website43.module.css');
const functional = read('components/ui/FunctionalMotion.module.css');
const navbar = read('components/layout/website-43/Website43Navbar.module.css');
const money = read('features/money-story/MoneyStory.module.css');
const ci = read('features/ci-planning/components/CIWizard.tsx');
const fhc = read('features/financial-health-check/components/LifeCoverageWizard.tsx');

test('readable content has no ancestor fade, intro reveal or delayed calculator commit', () => {
  assert.doesNotMatch(css, /w43Reveal|w43DisclosureIn|animation-timeline|@starting-style/);
  assert.doesNotMatch(functional, /@keyframes|opacity:\s*\.(?:9|8)|data-motion-phase/);
  for (const source of [ci, fhc]) assert.doesNotMatch(source, /STEP_OUT_MS|STEP_IN_MS|motionTimersRef|motionPhase/);
  assert.doesNotMatch(read('features/analytics/components/CookieConsent.tsx'), /cookieBannerUp|cookiePanelDown/);
});

test('explicit interactive cards use at most two pixels with no image zoom', () => {
  assert.match(css, /translateY\(-2px\)/);
  assert.doesNotMatch(css, /translateY\(-3px\)|scale: 1\.015/);
  assert.match(css, /transform \.14s/);
  assert.match(css, /hover: hover\) and \(pointer: fine\) and \(prefers-reduced-motion: no-preference/);
});

test('press feedback preserves disabled appearance and reduced-motion fallback', () => {
  assert.match(functional, /not\(:disabled\):active.*translateY\(1px\)/);
  assert.match(functional, /prefers-reduced-motion: reduce/);
  assert.match(functional, /transform: none/);
  assert.match(css, /:disabled \{ opacity: \.5; cursor: not-allowed/);
  assert.match(money, /not\(:disabled\):hover/);
  assert.match(money, /prefers-reduced-motion:reduce.*transform:none!important/);
});

test('reduced motion disables Website43 transitions, animations, scrolling and card transforms', () => {
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce) {'));
  assert.match(reduced, /\.root \*, \.root \*::before, \.root \*::after \{ transition: none !important; animation: none !important; scroll-behavior: auto !important;/);
  assert.match(reduced, /\.primaryButton:active, \.outlineButton:active \{ transform: none;/);
  assert.match(reduced, /\.articleCard, \.featuredCard, \.toolCtaCard \{ translate: none !important; transform: none !important;/);
  assert.match(reduced, /\.articleCard img, \.featuredCard img, \.toolCtaCard img \{ scale: 1 !important;/);
});

test('state indicators commit immediately; native interaction cues stay short', () => {
  assert.doesNotMatch(read('components/ui/HumanCalculatorCard.tsx'), /transition-\[width\]|duration-\[240ms\]/);
  assert.doesNotMatch(money, /transition:width/);
  assert.match(navbar, /transition: transform \.12s/);
  assert.match(functional, /border-color \.12s/);
});

test('motion introduces no library, observer, animation-frame loop or hydration boundary', () => {
  assert.equal(existsSync('components/layout/website-43/Website43MotionBoundary.tsx'), false);
  for (const file of ['features/home/website-43/Website43Home.tsx','features/blog/website-43/Website43Blog.tsx','features/blog/website-43/Website43Article.tsx', 'features/analytics/components/CookieConsent.tsx']) {
    assert.doesNotMatch(read(file), /framer-motion|MotionConfig|Website43MotionBoundary|IntersectionObserver/);
  }
});

test('functional motion is inherited from public shells without duplicate child imports', () => {
  for (const file of ['features/ci-planning/page.tsx','features/financial-health-check/components/ClientFHC.tsx']) assert.match(read(file), /FunctionalMotion\.module\.css/);
  for (const source of [ci, fhc, read('features/ci-planning/components/result/CIResult.tsx'), read('components/ui/HumanCalculatorCard.tsx'), read('components/ui/CurrencyInput.tsx')]) assert.doesNotMatch(source, /FunctionalMotion\.module\.css/);
  assert.doesNotMatch(css, /\.navDropdown\b|\.mobileMenu\b/);
  assert.doesNotMatch(functional, /animation-timeline|view\(\)|homeHero|blogHero|articleHeadline|articleFeature|featuredViewport/);
});

test('interaction cues do not resize layout, use three-dimensional transforms or add a frame loop', () => {
  const cardRule=css.slice(css.indexOf('.articleCard, .featuredCard, .toolCtaCard {'),css.indexOf('}',css.indexOf('.articleCard, .featuredCard, .toolCtaCard {')));
  assert.doesNotMatch(cardRule, /transition:\s*(?:all|width|height)|(?:width|height|font-size)\s+\.\d+s/);
  assert.doesNotMatch([css,functional,money].join('\n'), /translate3d|rotateX\s*\(|rotateY\s*\(|perspective:|transform-style:\s*preserve-3d/);
  assert.doesNotMatch([css,functional].join('\n'), /animation(?:-iteration-count)?:[^;{}]*\binfinite\b/);
  for (const declaration of functional.matchAll(/transition:\s*([^;{}]+);/g)) {
    assert.doesNotMatch(declaration[1], /(?:^|,)\s*(?:all|width|height|min-width|max-width|min-height|max-height|top|right|bottom|left|margin(?:-[a-z]+)?|padding(?:-[a-z]+)?|font-size)\b/);
  }
  for(const file of ['features/home/website-43/Website43Home.tsx','features/blog/website-43/Website43Blog.tsx','features/blog/website-43/Website43Article.tsx']) assert.doesNotMatch(read(file), /^['"]use client['"]/m);
  for(const source of [ci,fhc,read('features/home/website-43/Website43Home.tsx'),read('features/analytics/components/CookieConsent.tsx')]) assert.doesNotMatch(source, /requestAnimationFrame\(\s*(?:loop|tick|animate)\s*\)|setInterval\(/);
});
