import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');

const fhcShell = read('features/financial-health-check/components/ClientFHC.tsx');
const fhcIntro = read('features/financial-health-check/components/FHCLandingIntro.tsx');
const ciShell = read('features/ci-planning/page.tsx');
const ciIntro = read('features/ci-planning/components/CILandingIntro.tsx');
const card = read('components/ui/HumanCalculatorCard.tsx');
const fhcWizard = read('features/financial-health-check/components/LifeCoverageWizard.tsx');
const ciResult = read('features/ci-planning/components/result/CIResult.tsx');
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
  assert.match(read('features/ci-planning/components/steps/StepExpenses.tsx'), /ที่มา|RecoverySourceLink/);
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


test('mobile CI story cards expose swipe, arrows and position cue without changing desktop grid', () => {
  const intro = read('features/ci-planning/components/CILandingIntro.tsx');
  assert.match(intro, /ChevronLeft/);
  assert.match(intro, /ChevronRight/);
  assert.match(intro, /storyIndex \+ 1/);
  assert.match(website43Css, /scroll-snap-type: x mandatory/);
  assert.match(website43Css, /ciStoryCarouselControls/);
});
