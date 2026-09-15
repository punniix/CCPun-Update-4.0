import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');

const transition = read('components/layout/website-43/Website43TransitionStyles.tsx');
const navbar = read('components/layout/website-43/Website43Navbar.module.css');
const css = read('components/layout/website-43/Website43.module.css');
const article = read('features/blog/website-43/Website43Article.tsx');

test('wide desktop Website 4.3 shells stay centered instead of pinning to the left', () => {
  assert.match(transition, /--w43-shell-left: max\(var\(--w43-nav-gutter\), calc\(\(100vw - 1280px\) \/ 2\)\)/);
  assert.match(transition, /margin-left: auto;\s*margin-right: auto;/);
  assert.match(transition, /\.\$\{styles\.homeHeroCopy\} \{\s*left: var\(--w43-shell-left\)/);
  assert.match(transition, /\.\$\{styles\.blogHeroCopy\} \{[\s\S]*?left: var\(--w43-shell-left\)/);
  assert.match(transition, /\.\$\{styles\.toolHeroCopy\} \{[\s\S]*?left: var\(--w43-shell-left\)/);
  assert.match(navbar, /width: min\(1280px, calc\(100% - var\(--w43-nav-gutter, 80px\) - var\(--w43-nav-gutter, 80px\)\)\)/);
});

test('article header, featured image and support sections share the reading-section width', () => {
  assert.match(css, /\.articleHeader \.articleInlineFigure \{ width: min\(1060px,100%\); margin: 40px auto 0; \}/);
  assert.match(css, /\.articleHeader \.articleFeature \{ display: block; width: 100%/);
  assert.match(css, /\.articleReadingGrid \{[\s\S]*?width: min\(1060px,100%\); margin: 0 auto;/);
  assert.match(css, /\.articleSupportInner \{ width: min\(1060px,100%\); margin-inline: auto; \}/);
  assert.ok((article.match(/articleSupportInner/g) || []).length >= 6, 'article support sections should follow the same reading shell');
});

test('major vertical transitions use balanced rhythm instead of UAT-only compressed gaps', () => {
  assert.match(css, /section\[data-uat-section="home-learning"\] \{ padding-bottom: 40px; \}/);
  assert.match(css, /section\[data-uat-section="home-faq"\] \{ padding-top: 40px; \}/);
  assert.match(css, /\.articleHeader \{ padding: 56px 80px 32px;/);
  assert.match(css, /\.articleReadingWrap \{ padding: 48px 80px 72px;/);
  assert.match(css, /@media \(min-width: 1200px\)[\s\S]*?\.calculatorSection[\s\S]*?padding-bottom: 48px;/);
});
