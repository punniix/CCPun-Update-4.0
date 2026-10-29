import { productionCmsDisplaySource } from '../qa/production-cms-source-proof.mjs';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(resolve('package.json'));
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { JSDOM } = require('jsdom');
const read = file => productionCmsDisplaySource(file, readFileSync(file, 'utf8'));
const ciSource = read('features/ci-planning/v5/V5CiPlanning.tsx');
const fhcSource = read('features/financial-health-check/v5/V5Fhc.tsx');
const toolCss = readFileSync('components/layout/v5/V5Tool.module.css', 'utf8');
const shellCss = readFileSync('components/layout/v5/V5.module.css', 'utf8');
const toolParts = readFileSync('components/layout/v5/V5ToolParts.tsx', 'utf8');
const card = read('components/ui/HumanCalculatorCard.tsx');
const fhcWizard = read('features/financial-health-check/components/LifeCoverageWizard.tsx');
const ciResult = read('features/ci-planning/components/result/CIResult.tsx');
const ciImageActions = read('features/ci-planning/components/ResultImageDownloadButton.tsx');
const css = { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };

// Actual current page/hero/FAQ/info-card renderers execute. Only the service,
// shared chrome and separately tested interactive calculator boundaries are injected.
async function renderTool(scope, copy) {
  const mocks = new Map([
    ['@/lib/content/public-copy', { getPublicCopy: async () => ({}) }],
    ['@/components/layout/v5/shell-data', { getPublishedArticles: async () => [] }],
    ['@/components/layout/v5/V5Page', { __esModule: true, default: ({ children }) => React.createElement('main', { 'data-shared-v5-shell': true }, children) }],
    ['@/features/ci-planning/components/CIWizard', { __esModule: true, default: () => React.createElement('div', { 'data-active-calculator': 'ci' }) }],
    ['@/features/financial-health-check/components/LifeCoverageWizard', { __esModule: true, default: () => React.createElement('div', { 'data-active-calculator': 'fhc' }) }],
    ['./CiLandingViewTracker', { __esModule: true, default: () => null }],
  ]);
  for (const file of ['features/ci-planning/v5/V5CiPlanning.tsx', 'features/financial-health-check/v5/V5Fhc.tsx', 'components/layout/v5/V5Primitives.tsx', 'components/layout/v5/V5ToolParts.tsx', 'components/layout/v5/V5ViewTransition.tsx']) {
    for (const [, id] of readFileSync(file, 'utf8').matchAll(/from ["']([^"']+\.css)["']/g)) mocks.set(id, css);
  }
  const file = scope === 'ci' ? 'features/ci-planning/v5/V5CiPlanning.tsx' : 'features/financial-health-check/v5/V5Fhc.tsx';
  const page = loadFixtureModule(file, { mocks });
  return new JSDOM(renderToStaticMarkup(await page.default({ copy }))).window.document;
}
const ci = await renderTool('ci');
const fhc = await renderTool('fhc');

test('current CI and FHC use the shared v5 shell and one real calculator anchor', () => {
  for (const [scope, source, doc, href] of [['ci', ciSource, ci, '/ci-planning/'], ['fhc', fhcSource, fhc, '/tools/financial-health-check/']]) {
    assert.match(source, /<V5Page current=/);
    assert.doesNotMatch(source, /Website43ToolHero|components\/layout\/ToolHero/);
    assert.equal(doc.querySelectorAll('h1').length, 1);
    assert.equal(doc.querySelectorAll(`[data-active-calculator="${scope}"]`).length, 1);
    assert.equal(doc.querySelectorAll(`a[href="#${scope}-calculator"]`).length, 1);
    assert.ok(doc.querySelector(`#${scope}-calculator`));
    const schemas = [...doc.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent));
    assert.equal(schemas.find(s => s['@type'] === 'WebApplication').url, `https://ccpun.com${href}`);
    assert.equal(schemas.find(s => s['@type'] === 'BreadcrumbList').itemListElement.at(-1).item, `https://ccpun.com${href}`);
  }
});

test('current rendered planning copy preserves recovery, method separation and three FHC principles', () => {
  for (const phrase of ['รายได้ที่หายไป', 'ค่าบ้าน รถ และภาระค่าใช้จ่ายอื่นๆ', 'ทุนประกันโรคร้ายแรงที่มีอยู่ และสินทรัพย์', 'Recovery Reserve', 'ระบบแสดงแยกกันและไม่นำมาบวกกัน']) assert.ok(ci.body.textContent.includes(phrase), phrase);
  assert.ok(fhc.body.textContent.includes('3 เรื่องที่ควรทบทวนให้เชื่อมกัน'));
  assert.doesNotMatch(fhc.body.textContent, /7 เรื่องใน 3 กลุ่ม/);
  assert.match(read('features/ci-planning/components/steps/RecoveryReserveSection.tsx'), /ที่มา|RecoverySourceLink/);
});

test('active calculator cards remain flat and current v5 styling scopes readable controls', () => {
  assert.match(card, /var\(--w43-surface\)/);
  assert.match(card, /var\(--w43-border\)/);
  assert.doesNotMatch(card, /backdrop-blur|shadow-\[0_22px_70px/);
  assert.match(toolCss, /\.calcScope :global\(\.gold-button\).*border-radius: var\(--v5-radius-button\)/);
  assert.match(toolCss, /\.calcScope :global\(\.glass-button\).*background: transparent/);
  assert.match(toolCss, /:focus-visible \{ outline: 3px solid var\(--v5-focus\)/);
});

test('current tool layout uses the shared container and responsive calculator grid', () => {
  assert.match(shellCss, /\.inner \{ width: 100%; max-width: calc\(var\(--v5-max\) \+ var\(--v5-gutter\) \* 2\)/);
  assert.match(toolCss, /\.calcGrid \{ display: grid; gap: 20px; align-items: start; \}/);
  assert.match(toolCss, /@media \(min-width: 1024px\) \{ \.calcGrid \{ grid-template-columns: minmax\(0, 7fr\) minmax\(0, 5fr\)/);
  assert.match(toolCss, /\.calcScope.*max-width: 100%/);
});

test('unchanged CI and FHC result components retain their lead, method and action markers', () => {
  for (const source of [fhcWizard, ciResult]) {
    assert.match(source, /ccpun-calculator-result/);
    assert.match(source, /ccpun-calculator-result-lead/);
    assert.match(source, /ccpun-calculator-result-cta/);
    assert.doesNotMatch(source, /border-primary\/25 bg-primary\/\[0\.06\]|border-white\/10 bg-white\/\[0\.035\]/);
  }
  assert.match(ciResult, /ccpun-calculator-result-method/);
  assert.match(toolCss, /\.calcScope :global\(\.ccpun-calculator-result-lead\)/);
});

test('current text heroes keep the H1, complete lead and one CTA in native document flow', async () => {
  assert.doesNotMatch(toolParts, /next\/image|<Image|backgroundImage|position:\s*absolute/);
  assert.match(toolParts, /<h1 id=\{id\}/);
  assert.match(toolCss, /\.heroTitle \{ font-size: clamp\(30px, 6vw, 48px\)/);
  assert.match(toolCss, /\.heroLead \{ font-size: 18px; line-height: 2; \}/);
  const custom = await renderTool('ci', { 'ci.landing.line1Text': 'หัวข้อที่แก้ใน UAT', 'ci.landing.description2': 'คำอธิบายเต็มจากผู้แก้ไข', 'ci.landing.ctaLabel': 'เริ่มจากข้อมูลของฉัน' });
  assert.ok(custom.querySelector('h1').textContent.includes('หัวข้อที่แก้ใน UAT'));
  assert.equal(custom.querySelector('.heroLead').textContent, 'คำอธิบายเต็มจากผู้แก้ไข');
  assert.equal(custom.querySelector('a[href="#ci-calculator"]').textContent, 'เริ่มจากข้อมูลของฉัน');
});

test('the current FHC calculator precedes deeper context without hiding planning content', () => {
  const all = [...fhc.querySelectorAll('section')];
  assert.ok(all.indexOf(fhc.querySelector('#fhc-calculator')) < all.indexOf(fhc.querySelector('[aria-labelledby="fhc-intro-title"]')));
  assert.ok(all.indexOf(fhc.querySelector('#fhc-calculator')) < all.indexOf(fhc.querySelector('[aria-labelledby="fhc-context-title"]')));
  assert.equal(fhc.querySelectorAll('[aria-labelledby="fhc-context-title"] article').length, 3);
  assert.match(fhcSource, /functionalMotion\.scope/);
  assert.ok(fhc.querySelector('a[href="/blog/personal-finance/financial-pyramid/"]'));
});

test('actual native FAQ details preserve every answer and exactly match FAQPage schema', () => {
  for (const doc of [ci, fhc]) {
    const details = [...doc.querySelectorAll('.faq details')];
    assert.equal(details.length, 3);
    assert.equal(details.filter(d => d.open).length, 1);
    const visible = details.map(d => ({ '@type': 'Question', name: d.querySelector('summary').textContent, acceptedAnswer: { '@type': 'Answer', text: d.querySelector('p').textContent } }));
    const schema = [...doc.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent)).find(s => s['@type'] === 'FAQPage');
    assert.deepEqual(schema.mainEntity, visible);
  }
  assert.match(toolCss, /\.faq summary .*min-height: 56px; padding: 16px 20px/);
  assert.match(toolCss, /\.faq details p \{ padding: 0 20px 20px/);
});

test('CI gap breakdowns remain in one card with Recovery Reserve in a later separate section', () => {
  const start = ciResult.indexOf('<section className="ccpun-calculator-result-panel">');
  const end = ciResult.indexOf('</section>', start);
  assert.ok(start >= 0 && end > start);
  const resultCard = ciResult.slice(start, end);
  assert.match(resultCard, /differenceLabel[\s\S]*baht\(difference\)[\s\S]*availableResources[\s\S]*<details className="ccpun-calculator-result-details">/);
  assert.match(resultCard, /activeMethod === 'expense'[\s\S]*incomeBaseNeed/);
  assert.equal((resultCard.match(/<dl className="ccpun-calculator-result-rows ccpun-calculator-result-breakdown">/g) ?? []).length, 2);
  assert.doesNotMatch(resultCard, /lg:grid-cols-4|sm:grid-cols-2|sm:flex-row/);
  assert.ok(ciResult.indexOf('aria-labelledby="ci-recovery-result-title"') > end);
  assert.match(toolCss, /ccpun-calculator-result-details\) \{ margin-top: 20px; padding-top: 16px; border-top:/);
  assert.match(toolCss, /ccpun-calculator-result-breakdown \.ccpun-calculator-result-row\) \{ display: grid; grid-template-columns: minmax\(0,1fr\) auto/);
});

test('active result actions keep selected method, share capability, privacy and scoped spacing', () => {
  assert.match(ciResult, /ccpun-calculator-result-cta ccpun-ci-result-cta/);
  assert.match(ciResult, /<h3>อยากทบทวนตัวเลขต่อ\?<\/h3>[\s\S]*ccpun-ci-result-cta-copy[\s\S]*<ResultImageDownloadButton[\s\S]*ccpun-ci-result-cta-line/);
  assert.match(ciResult, /selectedMethod=\{activeMethod\}/);
  assert.match(ciImageActions, /canShareFile \? 'grid gap-3 sm:grid-cols-2' : 'grid gap-3'/);
  assert.match(ciImageActions, /empty:sr-only/);
  assert.match(ciImageActions, /ci-result-image-privacy/);
  assert.doesNotMatch(ciImageActions, /min-h-5/);
  assert.match(toolCss, /\.calcScope :global\(\.ccpun-ci-result-cta-inner\) \{ width: min\(560px,100%\); margin-inline: auto; \}/);
  assert.match(fhcWizard, /className="ccpun-calculator-result-cta"/);
});

test('current CI story presents three complete text cards without the retired image carousel', () => {
  const story = ci.querySelector('[aria-labelledby="ci-problem-title"]');
  const cards = [...story.querySelectorAll('article')];
  assert.equal(cards.length, 3);
  assert.deepEqual(cards.map(c => c.querySelector('h3').textContent), ['รายได้ที่หายไป', 'ค่าบ้าน รถ และภาระค่าใช้จ่ายอื่นๆ', 'ทุนประกันโรคร้ายแรงที่มีอยู่ และสินทรัพย์']);
  assert.ok(cards.every(c => c.querySelector('p').textContent.length > 20));
  assert.equal(story.querySelectorAll('img,button,[hidden]').length, 0);
  assert.doesNotMatch(ciSource + toolParts, /setInterval|ciStoryCarousel|ci-story-(?:income|debt|coverage)-v6/);
  assert.match(toolCss, /\.infoGrid .*grid-template-columns: minmax\(0, 1fr\)/);
});
