import { productionCmsDisplaySource } from '../qa/production-cms-source-proof.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';

const read = (path) => productionCmsDisplaySource(path, readFileSync(path, 'utf8'));

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
const nativeFhc = read('features/financial-health-check/v5/V5Fhc.tsx');
const nativeCi = read('features/ci-planning/v5/V5CiPlanning.tsx');
const nativeCss = read('components/layout/v5/V5Tool.module.css');
const nativeShellCss = read('components/layout/v5/V5.module.css');
const copyDefaults = read('lib/content/tool-copy-defaults.ts');

test('active FHC and CI use the native v5 shell and text-first tool hero', () => {
  for (const source of [nativeFhc, nativeCi]) {
    assert.match(source, /<V5Page current=/);
    assert.match(source, /<V5ToolHero/);
    assert.match(source, /styles\.calcScope/);
    assert.doesNotMatch(source, /Website43ToolHero|Website43Footer|components\/layout\/ToolHero|components\/layout\/Navbar|components\/layout\/Footer/);
    assert.doesNotMatch(source, /<Image/,'native tool H1 remains the LCP content');
  }
  assert.match(read('features/financial-health-check/page.tsx'), /return <V5Fhc copy=\{copyOverride/);
  assert.match(ciShell, /return <V5CiPlanning copy=\{copyOverride/);
});
test('latest calculator content is retained while confusing duplicate framing is removed', () => {
  assert.match(fhcIntro, /ประเมินความต้องการทุนประกันชีวิต/);
  assert.match(fhcIntro, /3 เรื่องที่ควรทบทวนให้เชื่อมกัน/);
  assert.doesNotMatch(fhcIntro, /7 เรื่องใน 3 กลุ่ม/);
  assert.match(fhcShell, /เรื่องที่ควรรู้ก่อนใช้ผลประเมิน/);

  assert.match(ciIntro, /รายได้ที่หายไป/);
  assert.match(ciIntro, /ทุนประกันโรคร้ายแรงที่มีอยู่ และสินทรัพย์/);
  assert.doesNotMatch(ciIntro, /border-l/);
  assert.match(copyDefaults, /ทุนสำรองช่วงพักฟื้น · ข้อพิจารณาเพิ่มเติม/);
  assert.match(nativeCi, /t\.node\('ci\.landing\.heading3'\)/);
  assert.match(copyDefaults, /"ci\.landing\.heading3": "[^"]*Recovery Reserve/);
  assert.match(ciRecoverySection, /ที่มา|RecoverySourceLink/);
  assert.match(copyDefaults, /ผลลัพธ์มี 2 มุม เลือกอ่านแยกกัน/);
  assert.match(nativeCi, /t\.node\('ci\.landing\.readingTitle\.heading'\)/);
  assert.match(copyDefaults, /ระบบแสดงแยกกันและไม่นำมาบวกกัน/);
  assert.match(nativeCi, /question: t\('ci\.landing\.question2'\), answer: t\('ci\.landing\.answer2'\)/);
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

test('native desktop calculators keep the 1280px shell and usable split without centered dead space', () => {
  for(const source of [nativeFhc,nativeCi])assert.match(source,/className=\{shell\.inner\}/);
  assert.match(nativeShellCss,/--v5-max: 1280px/);
  assert.match(nativeCss,/@media \(min-width: 1024px\) \{ \.calcGrid \{ grid-template-columns: minmax\(0, 7fr\) minmax\(0, 5fr\); gap: 32px/);
  assert.match(nativeCss,/\.calcScope \[data-ui="human-centered-calculator-card"\] \{ max-width: none/);
  assert.match(nativeCss,/\.faq details p \{ padding: 0 20px 20px/);
  assert.match(card,/max-w-\[48rem\]/,'shared standalone calculator bound remains intact');
});
test('1024–1280px FHC and CI readers never exceed their two-column tracks', () => {
  const stylesheet = postcss.parse(readFileSync('components/layout/v5/V5Tool.module.css', 'utf8'));
  const base = {};
  stylesheet.walkRules(rule => {
    if (rule.parent.type === 'root' && ['.heroTitle', '.calcAside', '.asideCard'].includes(rule.selector)) {
      base[rule.selector] = Object.fromEntries(rule.nodes.filter(node => node.type === 'decl').map(node => [node.prop, node.value]));
    }
  });
  assert.equal(base['.heroTitle']['min-width'], '0');
  assert.equal(base['.heroTitle']['overflow-wrap'], 'anywhere');
  assert.equal(base['.calcAside']['grid-template-columns'], 'minmax(0, 1fr)');
  assert.equal(base['.calcAside']['min-width'], '0');
  assert.equal(base['.asideCard']['min-width'], '0');
  assert.equal(base['.asideCard']['overflow-wrap'], 'anywhere');
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

test('native tool heroes share one current owner while the retained legacy ToolHero stays separate', () => {
  for(const source of [nativeFhc,nativeCi]){
    assert.match(source,/components\/layout\/v5\/V5ToolParts/);
    assert.doesNotMatch(source,/components\/layout\/ToolHero/);
  }
  const hero=read('components/layout/v5/V5ToolParts.tsx');
  assert.match(hero,/<h1 id=\{id\}/);
  assert.match(hero,/cta\.href/);
});
test('FHC reaches the calculator before the deeper planning context and keeps the mobile hero readable', () => {
  const introIndex = fhcShell.indexOf('<FHCLandingIntro />');
  const calculatorIndex = fhcShell.indexOf('id="fhc-calculator"');
  assert.match(fhcShell,/<FHCPlanningContext pyramidHref=\{pyramidHref\} \/>/);
  const contextIndex = fhcShell.indexOf('<FHCPlanningContext ');
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


test('native portrait calculators retain the full stage with 32px inner padding and intrinsic stacked states',()=>{
 const css=postcss.parse(readFileSync('components/layout/v5/V5Tool.module.css','utf8'));let tablet;
 css.walkAtRules('media',media=>{if(media.nodes.some(n=>n.type==='rule'&&n.selector===':global(:is(#ci-calculator, #fhc-calculator)) .calcScope'))tablet=media;});assert.ok(tablet);
 assert.equal(tablet.params,'(min-width: 768px) and (max-width: 1023px)');
 const props={};tablet.walkRules(rule=>{props[rule.selector]=Object.fromEntries(rule.nodes.filter(n=>n.type==='decl').map(d=>[d.prop,d.value]));});
 assert.equal(props['.calcGrid']['grid-template-columns'],'minmax(0, 1fr)');assert.equal(props['.calcGrid'].gap,'24px');
 assert.equal(props[':global(:is(#ci-calculator, #fhc-calculator)) .calcScope']['padding-right'],'0');
 const card=props[':global(:is(#ci-calculator, #fhc-calculator)) .calcScope [data-ui="human-centered-calculator-card"]'];assert.equal(card.padding,'32px');assert.equal(card['min-height'],'0');
 assert.equal(820-32*2-32*2,692,'native calculator content remains 692px wide');
});
