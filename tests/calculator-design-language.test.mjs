import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

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
  assert.doesNotMatch(ciShell, /Recovery Reserve/);
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

test('the legacy ToolHero entrypoint is only a compatibility alias to the Production Website 4.3 hero', () => {
  assert.equal(existsSync('components/layout/ToolHero.tsx'), true);
  const compatibilityHero = read('components/layout/ToolHero.tsx');
  assert.match(compatibilityHero, /Website43ToolHero/);
  assert.doesNotMatch(compatibilityHero, /radial-gradient|bg-primary|rounded-full|backdrop/);
});
