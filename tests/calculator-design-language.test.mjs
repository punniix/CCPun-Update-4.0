import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';

const read = (path) => readFileSync(path, 'utf8');

const fhcShell = read('features/financial-health-check/components/ClientFHC.tsx');
const fhcIntro = read('features/financial-health-check/components/FHCLandingIntro.tsx');
const ciShell = read('features/ci-planning/page.tsx');
const ciIntro = read('features/ci-planning/components/CILandingIntro.tsx');
const ciRecoverySection = read('features/ci-planning/components/steps/RecoveryReserveSection.tsx');
const card = read('components/ui/HumanCalculatorCard.tsx');
const fhcWizard = read('features/financial-health-check/components/LifeCoverageWizard.tsx');
const ciResult = read('features/ci-planning/components/result/CIResult.tsx');
const ciImageActions = read('features/ci-planning/components/ResultImageDownloadButton.tsx');
const website43Css = read('components/layout/website-43/Website43.module.css');
const { CI_COPY_DEFAULTS, FHC_COPY_DEFAULTS } = loadFixtureModule('lib/content/tool-copy-defaults.ts');
const registry = loadFixtureModule('lib/content/public-copy-registry.ts');

async function resolveServer(node) {
  if (Array.isArray(node)) return Promise.all(node.map(resolveServer));
  if (!React.isValidElement(node)) return node;
  if (typeof node.type === 'function' && ['Website43Footer', 'ClientFHC'].includes(node.type.name)) return resolveServer(await node.type(node.props));
  const children = await resolveServer(node.props.children);
  return React.cloneElement(node, {}, ...(Array.isArray(children) ? children : [children]));
}
async function renderedTool(scope, override = {}) {
  const provider = loadFixtureModule('components/ui/PublicCopyProvider.tsx');
  const values = { ...registry.parsePublicCopy(scope, null), ...override };
  const mocks = new Map([
    ['@/components/ui/PublicCopyProvider', provider],
    ['@/lib/content/public-copy', { getPublicCopy: async requested => requested === scope ? values : registry.parsePublicCopy(requested, null) }],
    ['@/features/financial-health-check/article-availability', { getFhcPyramidHref: async () => '/blog/' }],
    ['@/components/layout/website-43/Website43Navbar', { Website43Navbar: () => null }],
    ['@/lib/analytics', { trackEvent: () => assert.fail('SSR must not emit analytics') }],
  ]);
  const path = scope === 'ci' ? 'features/ci-planning/page.tsx' : 'features/financial-health-check/page.tsx';
  const featureModule = loadFixtureModule(path, { mocks });
  const render = scope === 'ci' ? featureModule.renderCiPlanningPage : featureModule.renderFinancialHealthCheckPage;
  const tree = await resolveServer(await render(values));
  const html = renderToStaticMarkup(React.createElement(provider.PublicCopyProvider, { values }, tree));
  const document = new JSDOM(html).window.document;
  const visible = document.body.cloneNode(true);
  visible.querySelectorAll('script').forEach(node => node.remove());
  return { document, visibleText: visible.textContent };
}

test('FHC and CI retain Website 4.3 shells while CI uses the reviewed text-only trust hero', async () => {
  for (const source of [fhcShell, ciShell]) {
    assert.match(source, /Website43ToolHero/);
    assert.match(source, /Website43Footer/);
    assert.match(source, /className=\{styles\.root\}/);
    assert.doesNotMatch(source, /components\/layout\/ToolHero/);
    assert.doesNotMatch(source, /components\/layout\/Navbar/);
    assert.doesNotMatch(source, /components\/layout\/Footer/);
  }
  assert.match(fhcShell, /\/assets\/website-43\/fhc-hero\.png/);
  assert.doesNotMatch(ciShell, /image="\/assets\/website-43\/ci-hero\.png"/);
  const fhc = (await renderedTool('fhc')).document.querySelector('section[aria-labelledby="tool-hero-title"]');
  const ci = (await renderedTool('ci')).document.querySelector('section[aria-labelledby="tool-hero-title"]');
  assert.equal(fhc.querySelectorAll('img').length, 1);
  assert.equal(fhc.querySelector('img').getAttribute('src'), '/assets/website-43/fhc-hero.png');
  assert.equal(ci.querySelectorAll('img').length, 0);
  assert.equal(ci.querySelector('h1').id, 'tool-hero-title');
  assert.equal(ci.querySelector('a[href="#ci-calculator"]').textContent, CI_COPY_DEFAULTS['ci.landing.ctaLabel']);
});

test('latest calculator content is retained through CMS bindings while confusing duplicate framing is removed', async () => {
  const fhc = await renderedTool('fhc');
  const ci = await renderedTool('ci');
  assert.match(fhc.visibleText, /ประเมินความต้องการทุนประกันชีวิต/);
  assert.match(fhc.visibleText, /3 เรื่องที่ควรทบทวนให้เชื่อมกัน/);
  assert.equal(fhc.document.getElementById('fhc-context-title').textContent, FHC_COPY_DEFAULTS['fhc.intro.contextTitle.heading']);
  assert.doesNotMatch(fhc.visibleText, /7 เรื่องใน 3 กลุ่ม/);
  assert.match(fhc.visibleText, /เรื่องที่ควรรู้ก่อนใช้ผลประเมิน/);

  assert.match(ci.visibleText, /รายได้ที่หายไป/);
  assert.match(ci.visibleText, /ทุนประกันโรคร้ายแรงที่มีอยู่ และสินทรัพย์/);
  assert.doesNotMatch(ciIntro, /border-l/);
  assert.match(ci.visibleText, /ทุนสำรองช่วงพักฟื้น · ข้อพิจารณาเพิ่มเติม/);
  assert.match(ci.visibleText, /Recovery Reserve/);
  assert.match(ciRecoverySection, /CI_RECOVERY_SOURCES\.map\(\(source\)/);
  const { CI_RECOVERY_SOURCES } = loadFixtureModule('features/ci-planning/recovery-evidence.ts');
  const sourceLinks = [...ci.document.querySelectorAll('[data-ui="ci-recovery-reserve"] a[target="_blank"]')];
  assert.equal(sourceLinks.length, CI_RECOVERY_SOURCES.length);
  for (const source of CI_RECOVERY_SOURCES) {
    const link = sourceLinks.find(link => link.getAttribute('href') === source.url);
    assert.ok(link, source.id);
    assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
    assert.ok(link.textContent.includes(CI_COPY_DEFAULTS[`ci.recovery.source.${source.id}.publisher`]));
    assert.ok(link.textContent.includes(String(source.year)));
  }
  assert.match(ci.visibleText, /ผลลัพธ์มี 2 มุม เลือกอ่านแยกกัน/);
  assert.match(ci.visibleText, /ระบบแสดงแยกกันและไม่นำมาบวกกัน/);
  const changed = await renderedTool('ci', { 'ci.landing.readingTitle.heading': 'UAT CMS READING HEADING' });
  assert.equal(changed.document.getElementById('ci-reading-title').textContent, 'UAT CMS READING HEADING');
  const changedFhc = await renderedTool('fhc', { 'fhc.intro.contextTitle.heading': 'UAT CMS CONTEXT HEADING' });
  assert.equal(changedFhc.document.getElementById('fhc-context-title').textContent, 'UAT CMS CONTEXT HEADING');
});

test('calculator surfaces follow Production flat-by-default styling instead of the old generic glass shell', () => {
  assert.match(card, /var\(--w43-surface\)/);
  assert.match(card, /var\(--w43-border\)/);
  assert.doesNotMatch(card, /backdrop-blur/);
  assert.doesNotMatch(card, /shadow-\[0_22px_70px/);
  assert.match(website43Css, /\.calculatorStage :global\(\.gold-button\).*border-radius: 12px/);
  assert.match(website43Css, /\.calculatorStage :global\(\.glass-button\).*background: transparent/);
  assert.match(website43Css, /\.toolMethodGrid/);
});

test('desktop spacing follows the Production 1280px shell and avoids centered dead space', () => {
  assert.match(fhcIntro, /className=\{styles\.inner\}/);
  assert.match(ciIntro, /className=\{styles\.inner\}/);
  assert.match(ciShell, /className=\{styles\.inner\}/);
  assert.match(fhcShell, /toolFaqStandalone/);
  assert.match(card, /max-w-\[48rem\]/);
  assert.match(website43Css, /@media \(min-width: 1200px\)/);
  assert.match(website43Css, /grid-template-columns: minmax\(300px, 360px\) minmax\(0, 768px\)/);
  assert.match(website43Css, /\.toolFaqStandalone \{ margin-top: 0; \}/);
});

test('FHC and CI result states keep the same Production Website 4.3 visual language', () => {
  assert.match(fhcWizard, /ccpun-calculator-result/);
  assert.match(fhcWizard, /ccpun-calculator-result-lead/);
  assert.match(fhcWizard, /ccpun-calculator-result-cta/);
  assert.doesNotMatch(fhcWizard, /border-primary\/25 bg-primary\/\[0\.06\]/);
  assert.match(ciResult, /ccpun-calculator-result/);
  assert.match(ciResult, /ccpun-calculator-result-lead/);
  assert.match(ciResult, /ccpun-calculator-result-method/);
  assert.match(ciResult, /ccpun-calculator-result-cta/);
  assert.doesNotMatch(ciResult, /border-white\/10 bg-white\/\[0\.035\]/);
  assert.match(website43Css, /ccpun-calculator-result-lead/);
});

test('FHC and CI use the new Website 4.3 tool hero without rewriting the legacy ToolHero surface', () => {
  for (const source of [fhcShell, ciShell]) {
    assert.match(source, /components\/layout\/website-43\/Website43ToolHero/);
    assert.doesNotMatch(source, /components\/layout\/ToolHero/);
  }
});

test('FHC reaches the calculator before the deeper planning context and keeps the mobile hero readable', async () => {
  const introIndex = fhcShell.indexOf('<FHCLandingIntro />');
  const calculatorIndex = fhcShell.indexOf('id="fhc-calculator"');
  const contextIndex = fhcShell.indexOf('<FHCPlanningContext pyramidHref={pyramidHref} />');
  assert.ok(introIndex >= 0 && calculatorIndex > introIndex && contextIndex > calculatorIndex);
  const { document } = await renderedTool('fhc');
  const intro = document.getElementById('fhc-intro-title').closest('section');
  const calculator = document.getElementById('fhc-calculator');
  const context = document.getElementById('fhc-context-title').closest('section');
  assert.ok(intro.compareDocumentPosition(calculator) & 4);
  assert.ok(calculator.compareDocumentPosition(context) & 4);
  assert.match(fhcShell, /strongContrast/);
  assert.match(fhcIntro, /fhcIntroCompact/);
  assert.match(fhcIntro, /FHCPlanningContext/);
  assert.match(website43Css, /\.fhcIntroCompact \{ padding-bottom: 8px; \}/);
  assert.match(website43Css, /\.toolHeroReadabilityOverlay \{ background: linear-gradient\(180deg,rgba\(6,11,9,\.92\).*rgba\(6,11,9,\.74\) 100%\)/);
});

test('tool FAQ answers keep breathing room from divider lines on mobile', () => {
  assert.match(website43Css, /\.faqDetails summary \{ padding: 22px 0 14px; \}/);
  assert.match(website43Css, /\.faqDetails p \{ padding: 6px 0 34px; \}/);
});

test('CI gap and its income or expense breakdown share one card, separate from Recovery Reserve', () => {
  const cardStart = ciResult.indexOf('<section className="ccpun-calculator-result-panel">');
  const cardEnd = ciResult.indexOf('</section>', cardStart);
  const card = ciResult.slice(cardStart, cardEnd);
  assert.ok(cardStart >= 0 && cardEnd > cardStart);
  assert.match(card, /differenceLabel[\s\S]*baht\(difference\)[\s\S]*availableResources[\s\S]*<details className="ccpun-calculator-result-details">/);
  assert.match(card, /activeMethod === 'expense'[\s\S]*incomeBaseNeed/);
  assert.equal((card.match(/<dl className="ccpun-calculator-result-rows ccpun-calculator-result-breakdown">/g) ?? []).length, 2);
  assert.doesNotMatch(card, /lg:grid-cols-4|sm:grid-cols-2/);
  assert.doesNotMatch(card, /sm:flex-row/);
  assert.ok(ciResult.indexOf('aria-labelledby="ci-recovery-result-title"') > cardEnd);
  assert.match(website43Css, /ccpun-calculator-result-details\) \{ margin-top: 18px; padding-top: 16px; border-top:/);
  assert.match(website43Css, /ccpun-calculator-result-breakdown \.ccpun-calculator-result-row\) \{ display: grid; grid-template-columns: minmax\(0,1fr\) auto/);
});

test('CI result actions and FAQ spacing stay aligned without changing shared FHC styles', () => {
  assert.match(ciResult, /ccpun-calculator-result-cta ccpun-ci-result-cta/);
  assert.equal(CI_COPY_DEFAULTS['ci.result.heading2'], 'อยากทบทวนตัวเลขต่อ?');
  assert.match(ciResult, /<h3>\{t(?:\.node)?\("ci\.result\.heading2"\)\}<\/h3>[\s\S]*ccpun-ci-result-cta-copy[\s\S]*<ResultImageDownloadButton[\s\S]*ccpun-ci-result-cta-line/);
  assert.match(ciImageActions, /canShareFile \? 'grid gap-3 sm:grid-cols-2' : 'grid gap-3'/);
  assert.match(ciImageActions, /empty:sr-only/);
  assert.doesNotMatch(ciImageActions, /min-h-5/);
  assert.match(website43Css, /\.calculatorStage :global\(\.ccpun-ci-result-cta-inner\) \{ width: min\(560px,100%\); margin-inline: auto; \}/);
  assert.match(website43Css, /\.toolStorySection\[aria-labelledby="ci-reading-title"\] \.faqDetails \{ margin-top: 24px; \}/);
  assert.match(website43Css, /\.toolStorySection\[aria-labelledby="ci-reading-title"\] \.faqDetails \{ margin-top: 20px; \}/);
  assert.match(fhcWizard, /className="ccpun-calculator-result-cta"/);
});

test('reviewed CI scenarios render exactly three static accessible panels with no duplicated images, timers or controls', async () => {
  const intro = read('features/ci-planning/components/CILandingIntro.tsx');
  assert.doesNotMatch(intro, /ChevronLeft|ChevronRight|setInterval|setTimeout|requestAnimationFrame|setStoryIndex|onPointerDown|onWheel|next\/image/);
  const { document } = await renderedTool('ci');
  const group = document.querySelector('[data-ui="ci-trust-scenarios"]');
  assert.equal(group.getAttribute('aria-label'), CI_COPY_DEFAULTS['ci.story.ariaLabel']);
  const panels = [...group.querySelectorAll('article')];
  assert.equal(panels.length, 3);
  for (const [index, panel] of panels.entries()) {
    const suffix = index === 0 ? '' : String(index + 1);
    assert.equal(panel.querySelector('h3').textContent, CI_COPY_DEFAULTS[`ci.story.title${suffix}`]);
    assert.equal(panel.querySelector('p').textContent, CI_COPY_DEFAULTS[`ci.story.description${suffix}`]);
    assert.equal(panel.querySelector('[aria-hidden="true"]').textContent, String(index + 1).padStart(2, '0'));
  }
  assert.equal(group.querySelectorAll('img, button, [role="button"]').length, 0);
  const changed = await renderedTool('ci', { 'ci.story.title': 'UAT CMS SCENARIO' });
  assert.equal(changed.document.querySelector('[data-ui="ci-trust-scenarios"] h3').textContent, 'UAT CMS SCENARIO');
  assert.doesNotMatch(intro, /ciStoryAutoToggle|เล่นอัตโนมัติ|หยุดเลื่อนอัตโนมัติ/);
  assert.doesNotMatch(website43Css, /ciStoryAutoToggle/);
  assert.doesNotMatch(intro, /ปัดซ้าย–ขวาได้/);
  assert.doesNotMatch(website43Css, /ciStoryCarouselControls|ciStoryGrid|ciStoryViewport/);
  assert.match(website43Css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(intro, /!getConsentData\(\)\?\.analytics/);
  assert.match(intro, /addEventListener\('ccpun:consent', queueLanding\)/);
  assert.match(intro, /removeEventListener\('ccpun:consent', queueLanding\)/);
  assert.match(intro, /NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED[\s\S]*document\.getElementById\('gtm-script'\)/);
});
