import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');

const transition = read('components/layout/website-43/Website43TransitionStyles.tsx');
const navbar = read('components/layout/website-43/Website43Navbar.module.css');
const css = read('components/layout/website-43/Website43.module.css');
const article = read('features/blog/website-43/Website43Article.tsx');
const layout = read('app/layout.tsx');
const home = read('features/home/website-43/Website43Home.tsx');

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
  assert.match(transition, /\.\$\{styles\.section\} > \.\$\{styles\.articleSupportInner\},\s*\.\$\{styles\.sectionDeep\} > \.\$\{styles\.articleSupportInner\}/);
  assert.ok((article.match(/articleSupportInner/g) || []).length >= 6, 'article support sections should follow the same reading shell');
});

test('major vertical transitions use balanced rhythm instead of UAT-only compressed gaps', () => {
  assert.match(css, /section\[data-uat-section="home-learning"\] \{ padding-bottom: 40px; \}/);
  assert.match(css, /section\[data-uat-section="home-faq"\] \{ padding-top: 40px; \}/);
  assert.match(css, /\.articleHeader \{ padding: 56px 80px 32px;/);
  assert.match(css, /\.articleReadingWrap \{ padding: 48px 80px 72px;/);
  assert.match(css, /@media \(min-width: 1200px\)[\s\S]*?\.calculatorSection[\s\S]*?padding-bottom: 48px;/);
});


test('article sources stay on the same support/read axis as the rest of the article', () => {
  assert.match(article, /article\.sources && article\.sources\.length > 0[\s\S]*?data-uat-section="article-sources"[\s\S]*?styles\.articleSupportInner[\s\S]*?>แหล่งอ้างอิง</);
});

test('Kanit starts early without putting the whole font family on the critical path', () => {
  assert.match(layout, /const kanit = Kanit\(\{[\s\S]*?subsets: \["thai", "latin"\][\s\S]*?weight: \["300", "400", "600", "700"\][\s\S]*?display: "optional"[\s\S]*?preload: false/);
  assert.match(layout, /const kanitCritical = Kanit\(\{[\s\S]*?subsets: \["thai"\][\s\S]*?weight: \["400", "600", "700"\][\s\S]*?display: "optional"[\s\S]*?preload: true/);
  assert.match(layout, /className=\{`\$\{kanit\.variable\} \$\{kanitCritical\.variable\}`\}/);
  assert.doesNotMatch(layout, /const kanitCritical = Kanit\(\{[\s\S]*?weight: \[[^\]]*"300"/);
});

test('the Home LCP image is preloaded alongside the bounded critical font budget', () => {
  assert.match(home, /home-hero-desktop\.png[\s\S]*?fill preload loading="eager" fetchPriority="high" sizes="100vw"/);
});
