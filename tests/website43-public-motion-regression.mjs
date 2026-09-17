import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');

const css = read('components/layout/website-43/Website43.module.css');
const functionalCss = read('components/ui/FunctionalMotion.module.css');
const home = read('features/home/website-43/Website43Home.tsx');
const blog = read('features/blog/website-43/Website43Blog.tsx');
const article = read('features/blog/website-43/Website43Article.tsx');
const fhc = read('features/financial-health-check/components/ClientFHC.tsx');
const fhcWizard = read('features/financial-health-check/components/LifeCoverageWizard.tsx');
const ci = read('features/ci-planning/page.tsx');
const ciWizard = read('features/ci-planning/components/CIWizard.tsx');
const ciResult = read('features/ci-planning/components/result/CIResult.tsx');
const calculatorCard = read('components/ui/HumanCalculatorCard.tsx');
const currencyInput = read('components/ui/CurrencyInput.tsx');
const toolHero = read('components/layout/website-43/Website43ToolHero.tsx');

const revealBlock = css.match(/@supports \(animation-timeline: view\(\)\) \{[\s\S]*?\n\}\n\n@media \(hover: hover\)/)?.[0] ?? '';
const functionalSources = [functionalCss, fhcWizard, ciWizard, ciResult, calculatorCard, currencyInput, toolHero];

test('public motion stays CSS-driven and adds no motion library or hydration boundary', () => {
  assert.equal(existsSync('components/layout/website-43/Website43MotionBoundary.tsx'), false);
  assert.equal(existsSync('components/layout/website-43/Website43Motion.module.css'), false);
  for (const source of [home, blog, article, fhc, ci, ...functionalSources]) {
    assert.doesNotMatch(source, /framer-motion|MotionConfig|Website43MotionBoundary/);
  }
  assert.match(functionalCss, /@keyframes calculatorStepIn/);
  assert.match(functionalCss, /@keyframes calculatorResultIn/);
});

test('scroll reveal is progressive and excludes hero/LCP-critical and calculator surfaces', () => {
  assert.match(css, /@keyframes w43Reveal/);
  assert.match(css, /from \{ opacity: \.9; translate: 0 8px; \}/);
  assert.match(css, /@supports \(animation-timeline: view\(\)\)/);
  assert.match(revealBlock, /animation-timeline: view\(\)/);
  assert.match(revealBlock, /animation-range: entry 0% entry 32%/);
  assert.match(revealBlock, /\.learnGrid > \.toolCtaCard/);
  assert.match(revealBlock, /\.articleGrid > \.articleCard/);
  assert.match(revealBlock, /\.articleSupportInner/);
  assert.doesNotMatch(revealBlock, /homeHero|blogHero|articleHeadline|articleFeature|featuredViewport|calculator|toolHero/);
  assert.doesNotMatch(revealBlock, /opacity:\s*0(?:[;\s}]|$)/);
});

test('card hover motion stays restrained and does not resize layout', () => {
  assert.match(css, /\.articleCard, \.featuredCard, \.toolCtaCard \{[\s\S]*?transform \.18s/);
  assert.match(css, /transform: translateY\(-3px\)/);
  assert.match(css, /scale: 1\.015/);
  assert.match(css, /box-shadow: 0 12px 28px rgba\(0,0,0,\.16\)/);
});

test('functional button press feedback is tactile and restrained', () => {
  assert.match(functionalCss, /\.tactileButton \{[\s\S]*?scale: 1;[\s\S]*?scale \.12s cubic-bezier\(\.2, 0, 0, 1\)/);
  assert.match(functionalCss, /\.tactileButton:not\(:disabled\):active \{\s*scale: \.98;/);
  assert.match(toolHero, /functionalMotion\.tactileButton/);
  assert.match(fhcWizard, /functionalMotion\.tactileButton/);
  assert.match(ciWizard, /functionalMotion\.tactileButton/);
});

test('calculator step and result motion use the restrained motion DNA', () => {
  assert.match(functionalCss, /calculatorStepIn[\s\S]*?opacity: \.92; translate: 0 6px;/);
  assert.match(functionalCss, /\.stepView\[data-motion-phase='out'\][\s\S]*?opacity: \.92;[\s\S]*?translate: 0 -4px;/);
  assert.match(functionalCss, /opacity \.1s cubic-bezier\(\.2, 0, 0, 1\)/);
  assert.match(functionalCss, /animation: calculatorStepIn \.14s cubic-bezier\(\.2, 0, 0, 1\) both/);
  assert.match(functionalCss, /calculatorResultIn[\s\S]*?opacity: \.9; translate: 0 6px;/);
  assert.match(functionalCss, /animation: calculatorResultIn \.22s cubic-bezier\(\.2, 0, 0, 1\) both/);
  for (const source of [fhcWizard, ciWizard]) {
    assert.match(source, /data-motion-phase=\{motionPhase\}/);
    assert.match(source, /prefers-reduced-motion: reduce/);
    assert.match(source, /STEP_OUT_MS = 100/);
    assert.match(source, /STEP_IN_MS = 140/);
  }
  assert.match(fhcWizard, /functionalMotion\.resultReveal/);
  assert.match(ciResult, /functionalMotion\.resultReveal/);
});

test('calculator progress input and selection feedback stay short and semantic', () => {
  assert.match(calculatorCard, /data-ui="calculator-progress-fill"/);
  assert.match(calculatorCard, /duration-\[240ms\]/);
  assert.match(calculatorCard, /motion-reduce:transition-none/);
  assert.match(currencyInput, /functionalMotion\.inputFeedback/);
  assert.match(functionalCss, /\.inputFeedback[\s\S]*?\.16s cubic-bezier\(\.2, 0, 0, 1\)/);
  assert.match(ciResult, /type="radio"[\s\S]*?checked=\{selected\}/);
  assert.match(ciResult, /functionalMotion\.selectionFeedback/);
  assert.match(ciResult, /functionalMotion\.selectionActive/);
});

test('FAQ article details TOC and menus keep their short feedback motion', () => {
  assert.match(css, /@keyframes w43DisclosureIn/);
  assert.match(css, /\.faqItem\[open\] \.faqAnswer/);
  assert.match(css, /\.tocSublist:not\(\[hidden\]\)/);
  assert.match(css, /animation: w43DisclosureIn \.18s/);
  assert.match(css, /\.navDropdown, \.mobileMenu, \.mobileSubmenu, \.categoryMenuPanel/);
  assert.match(css, /@starting-style/);
  assert.match(css, /translate: 0 -6px/);
});

test('functional motion never introduces 3D, looping, or layout-resizing animation', () => {
  const allMotionCss = `${css}\n${functionalCss}`;
  assert.doesNotMatch(allMotionCss, /rotateX|rotateY|perspective|animation-iteration-count:\s*infinite|animation[^;]*\binfinite\b/);
  assert.doesNotMatch(functionalCss, /transition[^;]*(?:height|width|max-height|min-height|top|left|right|bottom|margin|padding)/);
});

test('reduced-motion removes decorative and functional movement', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /transition: none !important; animation: none !important/);
  assert.match(css, /\.articleCard, \.featuredCard, \.toolCtaCard \{ translate: none !important; transform: none !important; \}/);
  assert.match(css, /\.articleCard img, \.featuredCard img, \.toolCtaCard img \{ scale: 1 !important; \}/);
  assert.match(functionalCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(functionalCss, /animation: none !important;\s*transition: none !important;\s*translate: 0 0 !important;/);
  assert.match(functionalCss, /scale: 1 !important/);
});

test('FHC and CI keep Website 4.3 visual language while functional motion stays separate from decorative reveal', () => {
  for (const source of [fhc, ci]) {
    assert.match(source, /Website43\.module\.css/);
    assert.match(source, /Website43ToolHero/);
    assert.doesNotMatch(source, /w43Reveal|toolCtaCard|framer-motion|MotionConfig/);
  }
  assert.match(fhcWizard, /FunctionalMotion\.module\.css/);
  assert.match(ciWizard, /FunctionalMotion\.module\.css/);
  assert.doesNotMatch(functionalCss, /animation-timeline|view\(\)|homeHero|blogHero|articleHeadline|articleFeature|featuredViewport/);
});
