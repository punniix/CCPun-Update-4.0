import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');
const css = read('app/globals.css') + read('app/components.css');
const critical = read('app/layout.tsx');
const website43 = read('components/layout/website-43/Website43.module.css');
const lab = read('app/preview/motion-lab/page.tsx');
const money = read('components/ui/MoneyComparison.tsx');

test('shared motion envelope and reduced-motion guard remain explicit', () => {
  for (const contract of ['120ms', '180ms', '320ms', '650ms', 'cubic-bezier(.2,.8,.2,1)', 'cubic-bezier(.16,1,.3,1)', 'prefers-reduced-motion: reduce']) {
    assert.ok(css.includes(contract), contract);
  }
  assert.ok(website43.includes('var(--motion-duration-micro)'));
  assert.match(css, /animation-delay: 0ms !important/);
  assert.match(css, /\.money-comparison__marker \{[\s\S]*opacity: 1 !important;[\s\S]*animation: none !important;/);
});

test('critical content is not hidden behind hero entrance motion', () => {
  assert.doesNotMatch(critical, /\.hero-heading\{animation:/);
  assert.doesNotMatch(critical, /\.hero-cta\{animation:/);
});

test('Motion Lab is Preview-only and excluded from search', () => {
  assert.match(lab, /VERCEL_ENV !== 'preview'/);
  assert.match(lab, /index: false, follow: false, nocache: true/);
});

test('money comparison keeps exact values and status in text', () => {
  assert.match(money, /ยังมีช่องว่างประมาณ/);
  assert.match(money, /เกินเป้าหมายประมาณ/);
  assert.match(money, /need > 0/);
  assert.match(css, /transform: scaleX\(0\)/);
});
