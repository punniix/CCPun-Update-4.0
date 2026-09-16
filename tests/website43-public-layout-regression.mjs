import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');

const transition = read('components/layout/website-43/Website43TransitionStyles.tsx');
const navbar = read('components/layout/website-43/Website43Navbar.module.css');
const css = read('components/layout/website-43/Website43.module.css');
const article = read('features/blog/website-43/Website43Article.tsx');
const articleToc = read('features/blog/website-43/Website43ArticleToc.tsx');
const layout = read('app/layout.tsx');
const home = read('features/home/website-43/Website43Home.tsx');
const blog = read('features/blog/website-43/Website43Blog.tsx');

test('wide desktop Website 4.3 shells stay centered instead of pinning to the left', () => {
  assert.match(transition, /--w43-shell-left: max\(var\(--w43-nav-gutter\), calc\(\(100vw - 1280px\) \/ 2\)\)/);
  assert.match(transition, /margin-left: auto;\s*margin-right: auto;/);
  assert.match(transition, /\.\$\{styles\.homeHeroCopy\} \{\s*left: var\(--w43-shell-left\)/);
  assert.match(transition, /\.\$\{styles\.blogHeroCopy\} \{[\s\S]*?left: var\(--w43-shell-left\)/);
  assert.match(navbar, /width: min\(1280px, calc\(100% - var\(--w43-nav-gutter, 80px\) - var\(--w43-nav-gutter, 80px\)\)\)/);
});

test('article uses one editorial spread: TOC sidebar + 720px main column + aligned support sections', () => {
  assert.match(article, /className=\{styles\.articleMainColumn\}/);
  assert.match(article, /className=\{styles\.articleInlineFigure\}[\s\S]*?className=\{styles\.articleFeature\}/);
  assert.match(article, /sizes="\(max-width: 767px\) calc\(100vw - 48px\), 720px"/);
  assert.match(css, /\.articleReadingGrid \{[\s\S]*?grid-template-columns: 260px 720px;[\s\S]*?gap: 48px;[\s\S]*?width: min\(1028px,100%\); margin: 0 auto;/);
  assert.match(css, /\.articleFeature \{ display: block; width: 100%;[\s\S]*?border-radius: 8px;/);
  assert.match(css, /\.articleSupportInner \{ width: min\(1028px,100%\); margin-inline: auto; \}/);
  assert.match(transition, /\.\$\{styles\.section\} > \.\$\{styles\.articleSupportInner\},\s*\.\$\{styles\.sectionDeep\} > \.\$\{styles\.articleSupportInner\} \{[\s\S]*?width: min\(1028px, 100%\);/);
  assert.match(article, /article\.sources && article\.sources\.length > 0[\s\S]*?data-uat-section="article-sources"[\s\S]*?styles\.articleSupportInner[\s\S]*?>แหล่งอ้างอิง</);
});

test('article TOC keeps H2 links navigable and lets users collapse or expand nested H3 items', () => {
  assert.match(article, /Website43ArticleToc groups=\{tocGroups\}/);
  assert.match(articleToc, /aria-expanded=\{isExpanded\}/);
  assert.match(articleToc, /aria-controls=\{sublistId\}/);
  assert.match(articleToc, /hidden=\{!isExpanded\}/);
  assert.match(articleToc, /href=\{`#\$\{group\.primary\.id\}`\}/);
  assert.match(articleToc, /group\.children\.map/);
  assert.match(css, /\.tocToggle\[aria-expanded="true"\] \.tocChevron \{ transform: rotate\(180deg\); \}/);
});

test('Home and Article vertical rhythm use the reviewed public spacing', () => {
  assert.match(css, /section\[data-uat-section="home-learning"\] \{ padding-bottom: 40px; \}/);
  assert.match(css, /section\[data-uat-section="home-faq"\] \{ padding-top: 40px; \}/);
  assert.match(css, /\.articleHeader \{ padding: 56px 80px 34px;/);
  assert.match(css, /\.articleReadingWrap \{ padding: 38px 80px 72px;/);
  assert.match(css, /\.articleMetaRow \{[\s\S]*?border-top: 1px solid/);
});

test('article metadata hides redundant updated date when publish and update calendar dates match', () => {
  assert.match(article, /const publishedDateLabel = article\.publishedAt \? thaiDateFormatter\.format\(new Date\(article\.publishedAt\)\) : null;/);
  assert.match(article, /const updatedDateLabel = thaiDateFormatter\.format\(new Date\(article\.updatedAt\)\);/);
  assert.match(article, /const showUpdatedDate = !publishedDateLabel \|\| publishedDateLabel !== updatedDateLabel;/);
  assert.match(article, /\{publishedDateLabel \? `เผยแพร่เมื่อ \$\{publishedDateLabel\}` : null\}/);
  assert.match(article, /\{showUpdatedDate \? `\$\{publishedDateLabel \? ' · ' : ''\}อัปเดตล่าสุด \$\{updatedDateLabel\}` : null\}/);
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

test('Home and Blog stay on the Production Website 4.3 shell while FHC and CI use the new aligned tool shell', () => {
  const fhc = read('features/financial-health-check/components/ClientFHC.tsx');
  const ci = read('features/ci-planning/page.tsx');
  assert.match(home, /Website43/);
  assert.match(blog, /Website43/);
  for (const source of [fhc, ci]) {
    assert.match(source, /components\/layout\/website-43\/Website43ToolHero/);
    assert.match(source, /Website43Footer/);
    assert.doesNotMatch(source, /components\/layout\/ToolHero/);
    assert.doesNotMatch(source, /components\/layout\/Navbar/);
  }
});


test('Article header keeps only date metadata and the author identity stays in the lower author card', () => {
  assert.doesNotMatch(article, /className=\{styles\.articleByline\}/);
  assert.match(article, /className=\{styles\.articleHeaderMeta\}/);
  assert.match(article, /className=\{styles\.authorCard\}[\s\S]*?className=\{styles\.authorName\}/);
  assert.match(css, /\.articleMetaRow \{[\s\S]*?justify-content: flex-end;/);
});

test('Article CTA to related-content rhythm is compact and explicitly scoped', () => {
  assert.match(article, /className=\{`\$\{styles\.sectionDeep\} \$\{styles\.articlePlanCtaSection\}`\}[\s\S]*?>อยากจัดลำดับแผนให้เหมาะกับชีวิตคุณ\?</);
  assert.match(article, /className=\{`\$\{styles\.sectionDeep\} \$\{styles\.articleRelatedSection\}`\}[\s\S]*?>อ่านต่อ</);
  assert.match(css, /\.articlePlanCtaSection \{ padding-top: 40px; padding-bottom: 24px; \}/);
  assert.match(css, /\.articleRelatedSection \{ padding-top: 24px; padding-bottom: 48px; \}/);
});

test('Home learning cards share one visual composition including the READ card', () => {
  assert.match(home, /className=\{`\$\{styles\.toolCtaCard\} \$\{styles\.learnArticleCard\}`\}/);
  assert.match(home, /src="\/assets\/website-43\/blog-hero\.png"[\s\S]*?styles\.learnArticleImage/);
  assert.match(home, /styles\.toolCtaContent[\s\S]*?>READ<[\s\S]*?>บทความการเงิน<[\s\S]*?styles\.toolCtaAction/);
  assert.doesNotMatch(home, /<article className=\{styles\.learnCard\}[\s\S]*?>READ</);
  assert.match(css, /\.learnArticleImage \{ object-position: 68% center; \}/);
});


test('FAQ expanded answer has editorial breathing room below its divider', () => {
  assert.match(css, /\.faqAnswer \{ margin: 0; padding: 16px 20px 22px; border-top: 1px solid rgba\(224,201,133,\.10\);/);
});

test('Blog category filter is a compact publication-style dropdown with stable layering', () => {
  const blogInteractive = read('features/blog/website-43/Website43BlogInteractive.tsx');
  assert.doesNotMatch(blogInteractive, /categoryMenuRef\} onBlur=/);
  assert.match(blogInteractive, /hidden=\{!categoryMenuOpen\}/);
  assert.match(blogInteractive, /document\.addEventListener\('mousedown', onPointerDown\)/);
  assert.match(blogInteractive, /event\.key === 'Escape'/);
  assert.match(css, /\.categoryMenu \{ position: relative; z-index: 30; width: 220px; \}/);
  assert.match(css, /\.categoryMenuPanel \{[\s\S]*?width: 100%;[\s\S]*?max-height: min\(420px, calc\(100vh - 180px\)\);[\s\S]*?overflow-y: auto;/);
  assert.match(css, /\.searchFilters:has\(\.categoryMenuPanel\) \{ position: relative; z-index: 12; \}/);
  assert.match(css, /\.articleGrid \{ position: relative; z-index: 1; \}/);
  assert.match(css, /@media \(max-width: 639px\) \{[\s\S]*?\.categoryMenu \{ width: 100%; \}[\s\S]*?\.categoryMenuPanel \{ width: 100%; \}/);
});
