import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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

test('FHC and CI use the Production Website 4.3 shell and approved Figma tool hero language', () => {
  for (const source of [fhcShell, ciShell]) {
    assert.match(source, /Website43ToolHero/);
    assert.match(source, /Website43Footer/);
    assert.match(source, /className=\{styles\.root\}/);
    assert.doesNotMatch(source, /components\/layout\/ToolHero/);
    assert.doesNotMatch(source, /components\/layout\/Navbar/);
    assert.doesNotMatch(source, /components\/layout\/Footer/);
  }
  assert.match(fhcShell, /\/assets\/website-43\/fhc-hero\.png/);
  assert.match(ciShell, /\/assets\/website-43\/ci-hero\.png/);
});

test('latest calculator content is retained while confusing duplicate framing is removed', () => {
  assert.match(fhcIntro, /ประเมินความต้องการทุนประกันชีวิต/);
  assert.match(fhcIntro, /3 เรื่องที่ควรทบทวนให้เชื่อมกัน/);
  assert.doesNotMatch(fhcIntro, /7 เรื่องใน 3 กลุ่ม/);
  assert.match(fhcShell, /เรื่องที่ควรรู้ก่อนใช้ผลประเมิน/);

  assert.match(ciIntro, /รายได้ที่หายไป/);
  assert.match(ciIntro, /ทุนประกันโรคร้ายแรงที่มีอยู่ และสินทรัพย์/);
  assert.doesNotMatch(ciIntro, /border-l/);
  assert.match(ciShell, /ทุนสำรองช่วงพักฟื้น · ข้อพิจารณาเพิ่มเติม/);
  assert.match(ciShell, /Recovery Reserve/);
  assert.match(ciRecoverySection, /ที่มา|RecoverySourceLink/);
  assert.match(ciShell, /ผลลัพธ์มี 2 มุม เลือกอ่านแยกกัน/);
  assert.match(ciShell, /ระบบแสดงแยกกันและไม่นำมาบวกกัน/);
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

test('FHC reaches the calculator before the deeper planning context and keeps the mobile hero readable', () => {
  const introIndex = fhcShell.indexOf('<FHCLandingIntro />');
  const calculatorIndex = fhcShell.indexOf('id="fhc-calculator"');
  const contextIndex = fhcShell.indexOf('<FHCPlanningContext />');
  assert.ok(introIndex >= 0 && calculatorIndex > introIndex && contextIndex > calculatorIndex);
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
  assert.match(ciResult, /<h3>อยากทบทวนตัวเลขต่อ\?<\/h3>[\s\S]*ccpun-ci-result-cta-copy[\s\S]*<ResultImageDownloadButton[\s\S]*ccpun-ci-result-cta-line/);
  assert.match(ciImageActions, /canShareFile \? 'grid gap-3 sm:grid-cols-2' : 'grid gap-3'/);
  assert.match(ciImageActions, /empty:sr-only/);
  assert.doesNotMatch(ciImageActions, /min-h-5/);
  assert.match(website43Css, /\.calculatorStage :global\(\.ccpun-ci-result-cta-inner\) \{ width: min\(560px,100%\); margin-inline: auto; \}/);
  assert.match(website43Css, /\.toolStorySection\[aria-labelledby="ci-reading-title"\] \.faqDetails \{ margin-top: 24px; \}/);
  assert.match(website43Css, /\.toolStorySection\[aria-labelledby="ci-reading-title"\] \.faqDetails \{ margin-top: 20px; \}/);
  assert.match(fhcWizard, /className="ccpun-calculator-result-cta"/);
});

test('mobile CI story cards loop around a centered card with swipe, arrows and paused autoplay', () => {
  const intro = read('features/ci-planning/components/CILandingIntro.tsx');
  assert.match(intro, /ChevronLeft/);
  assert.match(intro, /ChevronRight/);
  assert.match(intro, /length: 9/);
  assert.match(intro, /nearest < 3 \? nearest \+ 3 : nearest - 3/);
  assert.match(intro, /centerStory\(node, next, 'smooth'\);\s+setStoryIndex\(next\);\s+\}, 4000\)/);
  assert.match(intro, /isHovered \|\| isFocused \|\| hasInteracted \|\| isPageHidden \|\| reducedMotion/);
  assert.match(intro, /setHasInteracted\(true\);\s+const next = Math\.max/);
  assert.match(intro, /onPointerDown=\{\(\) => setHasInteracted\(true\)\}/);
  assert.match(intro, /onWheel=\{\(event\) => \{ if \(Math\.abs\(event\.deltaX\) > Math\.abs\(event\.deltaY\)\) setHasInteracted\(true\); \}\}/);
  assert.doesNotMatch(intro, /ciStoryAutoToggle|เล่นอัตโนมัติ|หยุดเลื่อนอัตโนมัติ/);
  assert.doesNotMatch(website43Css, /ciStoryAutoToggle/);
  assert.doesNotMatch(intro, /ปัดซ้าย–ขวาได้/);
  assert.match(website43Css, /scroll-snap-type: x mandatory/);
  assert.match(website43Css, /scroll-snap-align: center/);
  assert.match(website43Css, /ciStoryCarouselControls button:first-child \{ left:/);
  assert.match(website43Css, /ciStoryGrid > :nth-child\(n\+4\) \{ display: none; \}/);
  assert.match(website43Css, /ciStoryCarouselControls/);
});
