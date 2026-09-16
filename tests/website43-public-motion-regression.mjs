import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');

const css = read('components/layout/website-43/Website43.module.css');
const home = read('features/home/website-43/Website43Home.tsx');
const blog = read('features/blog/website-43/Website43Blog.tsx');
const article = read('features/blog/website-43/Website43Article.tsx');
const fhc = read('features/financial-health-check/components/ClientFHC.tsx');
const ci = read('features/ci-planning/page.tsx');

const revealBlock = css.match(/@supports \(animation-timeline: view\(\)\) \{[\s\S]*?\n\}\n\n@media \(hover: hover\)/)?.[0] ?? '';

test('public motion is CSS-only and adds no hydration boundary', () => {
  assert.equal(existsSync('components/layout/website-43/Website43MotionBoundary.tsx'), false);
  assert.equal(existsSync('components/layout/website-43/Website43Motion.module.css'), false);
  for (const source of [home, blog, article, fhc, ci]) {
    assert.doesNotMatch(source, /Website43MotionBoundary|framer-motion|MotionConfig/);
  }
});

test('scroll reveal is progressive and excludes hero/LCP-critical surfaces', () => {
  assert.match(css, /@keyframes w43Reveal/);
  assert.match(css, /from \{ opacity: \.9; translate: 0 8px; \}/);
  assert.match(css, /@supports \(animation-timeline: view\(\)\)/);
  assert.match(revealBlock, /animation-timeline: view\(\)/);
  assert.match(revealBlock, /animation-range: entry 0% entry 32%/);
  assert.match(revealBlock, /\.learnGrid > \.toolCtaCard/);
  assert.match(revealBlock, /\.articleGrid > \.articleCard/);
  assert.match(revealBlock, /\.articleSupportInner/);
  assert.doesNotMatch(revealBlock, /homeHero|blogHero|articleHeadline|articleFeature|featuredViewport/);
  assert.doesNotMatch(revealBlock, /opacity:\s*0(?:[;\s}]|$)/);
});

test('card hover motion stays restrained and does not resize layout', () => {
  assert.match(css, /\.articleCard, \.featuredCard, \.toolCtaCard \{[\s\S]*?transform \.18s/);
  assert.match(css, /transform: translateY\(-3px\)/);
  assert.match(css, /scale: 1\.015/);
  assert.match(css, /box-shadow: 0 12px 28px rgba\(0,0,0,\.16\)/);
  assert.doesNotMatch(css, /rotateX|rotateY|perspective|animation-iteration-count:\s*infinite/);
});

test('FAQ article details TOC and menus have short feedback motion', () => {
  assert.match(css, /@keyframes w43DisclosureIn/);
  assert.match(css, /\.faqItem\[open\] \.faqAnswer/);
  assert.match(css, /\.tocSublist:not\(\[hidden\]\)/);
  assert.match(css, /animation: w43DisclosureIn \.18s/);
  assert.match(css, /\.navDropdown, \.mobileMenu, \.mobileSubmenu, \.categoryMenuPanel/);
  assert.match(css, /@starting-style/);
  assert.match(css, /translate: 0 -6px/);
});

test('reduced-motion removes all decorative movement', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /transition: none !important; animation: none !important/);
  assert.match(css, /\.articleCard, \.featuredCard, \.toolCtaCard \{ translate: none !important; transform: none !important; \}/);
  assert.match(css, /\.articleCard img, \.featuredCard img, \.toolCtaCard img \{ scale: 1 !important; \}/);
});

test('FHC and CI share the Production Website 4.3 visual language without opting into decorative reveal motion', () => {
  for (const source of [fhc, ci]) {
    assert.match(source, /Website43\.module\.css/);
    assert.match(source, /Website43ToolHero/);
    assert.doesNotMatch(source, /Website43Motion|w43Reveal|toolCtaCard|framer-motion|MotionConfig/);
  }
});
