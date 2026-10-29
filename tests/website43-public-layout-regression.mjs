import { productionCmsDisplaySource } from '../qa/production-cms-source-proof.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const read = (path) => productionCmsDisplaySource(path, readFileSync(path, 'utf8'));

const responsive = read('components/layout/website-43/Website43ResponsiveStyles.tsx');
const navbar = read('components/layout/website-43/Website43Navbar.module.css');
const css = read('components/layout/website-43/Website43.module.css');
const article = read('features/blog/website-43/Website43Article.tsx');
const articleToc = read('features/blog/website-43/Website43ArticleToc.tsx');
const layout = read('apps/web/app/layout.tsx');
const home = read('features/home/website-43/Website43Home.tsx');
const blog = read('features/blog/website-43/Website43Blog.tsx');

test('wide desktop Website 4.3 shells stay centered instead of pinning to the left', () => {
  assert.match(responsive, /--w43-shell-left: max\(var\(--w43-nav-gutter\), calc\(\(100vw - 1280px\) \/ 2\)\)/);
  assert.match(responsive, /margin-left: auto;\s*margin-right: auto;/);
  assert.match(responsive, /\.\$\{styles\.homeHeroCopy\} \{\s*left: var\(--w43-shell-left\)/);
  assert.match(responsive, /\.\$\{styles\.blogHeroCopy\} \{[\s\S]*?left: var\(--w43-shell-left\)/);
  assert.match(responsive, /\.\$\{styles\.toolHeroCopy\} \{\s*left: var\(--w43-shell-left\);\s*top: 128px;/);
  assert.match(navbar, /width: min\(1280px, calc\(100% - var\(--w43-nav-gutter, 80px\) - var\(--w43-nav-gutter, 80px\)\)\)/);
});

test('article uses one editorial spread: TOC sidebar + 720px main column + aligned support sections', () => {
  assert.match(article, /className=\{styles\.articleMainColumn\}/);
  assert.match(article, /className=\{styles\.articleInlineFigure\}[\s\S]*?className=\{styles\.articleFeature\}/);
  assert.match(article, /sizes="\(max-width: 767px\) calc\(100vw - 48px\), 720px"/);
  assert.match(css, /\.articleReadingGrid \{[\s\S]*?grid-template-columns: 260px 720px;[\s\S]*?gap: 48px;[\s\S]*?width: min\(1028px,100%\); margin: 0 auto;/);
  assert.match(css, /\.articleFeature \{ display: block; width: 100%;[\s\S]*?border-radius: 14px;/);
  assert.match(css, /\.articleSupportInner \{ width: min\(1028px,100%\); margin-inline: auto; \}/);
  assert.match(responsive, /\.\$\{styles\.section\} > \.\$\{styles\.articleSupportInner\},\s*\.\$\{styles\.sectionDeep\} > \.\$\{styles\.articleSupportInner\} \{[\s\S]*?width: min\(1028px, 100%\);/);
  assert.doesNotMatch(article, /data-uat-section="article-sources"|>แหล่งอ้างอิง</);
});

test('article TOC keeps H2, H3 and H4 links visible inside the native outer disclosures', () => {
  assert.match(article, /Website43ArticleToc groups=\{tocGroups\}/);
  assert.match(articleToc, /href=\{`#\$\{group\.primary\.id\}`\}/);
  assert.match(articleToc, /href=\{`#\$\{heading\.id\}`\}/);
  assert.match(articleToc, /data-level=\{group\.primary\.level\}/);
  assert.match(articleToc, /data-level=\{heading\.level\}/);
  assert.match(articleToc, /heading\.level === 4 \? styles\.tocTertiary : styles\.tocSecondary/);
  assert.doesNotMatch(articleToc, /aria-expanded|aria-controls|\shidden=|<button/);
  assert.match(article, /<details className=\{styles\.tocDisclosure\} open>/);
  assert.match(article, /<details className=\{styles\.tocMobile\}>/);
  assert.match(css, /\.tocDisclosure\[open\] > summary > svg, \.tocMobile\[open\] > summary > svg \{ transform: rotate\(180deg\); \}/);
});

test('native mobile TOC keeps separators on its 56px summary when closed or open', () => {
  const require = createRequire(import.meta.url);
  const { parse } = require('postcss');
  const { JSDOM } = require('jsdom');
  const rules = [];
  const summaryDeclarations = {};
  parse(css).walkRules((rule) => {
    if (rule.selectors.some((selector) => ['.tocMobile', '.tocMobile > summary', '.tocMobileList'].includes(selector))) {
      rules.push(rule.toString());
      if (rule.selectors.includes('.tocMobile > summary')) rule.walkDecls(declaration => { summaryDeclarations[declaration.prop] = declaration.value; });
    }
  });
  const borderColour = css.match(/--w43-border:\s*([^;]+);/)[1];
  // jsdom does not resolve custom properties in border shorthands.
  const mobileCss = rules.join('\n').replaceAll('var(--w43-border)', borderColour);
  const dom = new JSDOM(`<style>${mobileCss}</style><details class="tocMobile"><summary>หัวข้อเนื้อหา<svg aria-hidden="true" width="14" height="14"></svg></summary><div class="tocMobileList">หัวข้อบทความ</div></details>`);
  const details = dom.window.document.querySelector('details');
  for (const open of [false, true]) {
    details.open = open;
    const frame = dom.window.getComputedStyle(details);
    assert.equal(frame.borderTopWidth, '0px');
    assert.equal(frame.borderBottomWidth, '0px');
    assert.equal(frame.marginBottom, '26px');
    assert.equal(dom.window.getComputedStyle(details.querySelector('summary')).minHeight, '56px');
  }
  assert.equal(summaryDeclarations['border-block'], '1px solid var(--w43-border)', 'separators belong to the summary in both disclosure states');
  assert.match(article, /<details className=\{styles\.tocMobile\}>\s*<summary>หัวข้อเนื้อหา<svg aria-hidden="true" width="14" height="14"/);
  dom.window.close();
});

test('Home and Article vertical rhythm use the reviewed public spacing', () => {
  assert.match(css, /section\[data-uat-section="home-learning"\] \{ padding-bottom: 40px; \}/);
  assert.match(css, /section\[data-uat-section="home-faq"\] \{ padding-top: 40px; \}/);
  assert.match(css, /\.articleHeader \{ padding: 56px 80px 34px;/);
  assert.match(css, /\.articleReadingWrap \{ padding: 38px 80px 72px;/);
  assert.match(css, /\.articleMetaRow \{[\s\S]*?border-top: 1px solid/);
});

test('Thai reading headings, explicit dividers and content links retain a clear reading rhythm', () => {
  const require = createRequire(import.meta.url);
  const { parse } = require('postcss');
  const legalCss = read('components/layout/v5/V5Tool.module.css');
  const sheet = parse(css + '\n' + legalCss);
  const values = (selector) => {
    const result = {};
    sheet.walkRules((rule) => {
      if (!rule.selectors.includes(selector)) return;
      rule.walkDecls((declaration) => { result[declaration.prop] = declaration.value; });
    });
    return result;
  };
  for (const selector of ['.h2', '.prose h2']) {
    sheet.walkRules((rule) => {
      if (!rule.selectors.includes(selector)) return;
      rule.walkDecls('line-height', (declaration) => assert.equal(declaration.value, '1.4'));
    });
    assert.equal(values(selector)['line-height'], '1.4');
    assert.equal(values(selector).height, undefined, 'multiline headings grow with their content');
  }
  const dividerHeading = values('.prose > .articleDivider + h2');
  assert.equal(dividerHeading['border-top'], '0', 'an explicit CMS divider supplies the only separator');
  assert.equal(dividerHeading['padding-top'], '0');
  assert.equal(dividerHeading['margin-top'], '24px');
  assert.match(article, /<article className=\{styles\.prose\}>\{renderWebsite43ArticleBody/);
  for (const [selector, offset] of [['.prose :is(p, li, h2, h3, h4, blockquote) a', '4px'], ['.legalBody a', '3px']]) {
    assert.equal(values(selector)['text-decoration'], 'underline', 'content links do not rely only on colour');
    assert.equal(values(selector)['text-underline-offset'], offset);
  }
  assert.equal(values('.root a')['text-decoration'], 'none', 'navigation and button styling stays scoped');
});

test('article metadata uses verified optimization date, consistent type and readable TOC separation', () => {
  assert.match(article, /article\.optimizedAt && Number\.isFinite\(Date\.parse\(article\.optimizedAt\)\)/);
  assert.doesNotMatch(article, /article\.updatedAt|showUpdatedDate/);
  assert.match(article, />อัปเดตข้อมูลล่าสุด<\/span> <time dateTime=\{article\.optimizedAt\}/);
  assert.match(css, /\.articleHeaderMeta \{[^}]*font-size: 14px;[^}]*font-weight: 400;[^}]*line-height: 22px;/);
  assert.match(css, /\.articleDateLabel \{ font-size: inherit; font-weight: 400; \}/);
  assert.match(css, /\.articleHeaderMeta time \{ color: var\(--w43-ink\); font-weight: 500; \}/);
  assert.doesNotMatch(article, /styles\.articleReadingTime\b/, 'retired unused reading-time class has no actual article owner');
  assert.match(css, /\.tocList \{ padding-block: 24px 8px; \}/);
  assert.match(css, /\.tocDisclosure > summary, \.tocMobile > summary \{[^}]*justify-content: center;/);
  assert.match(css, /\.articleFeature \{[^}]*height: auto;/);
  assert.doesNotMatch(css, /\.articleFeature \{[^}]*aspect-ratio:/);
});

test('Kanit starts early without putting the whole font family on the critical path', () => {
  assert.match(layout, /const kanit = Kanit\(\{[\s\S]*?subsets: \["thai", "latin"\][\s\S]*?weight: \["300", "400", "500", "600", "700"\][\s\S]*?display: "swap"[\s\S]*?preload: false/);
  assert.match(layout, /const kanitCritical = Kanit\(\{[\s\S]*?subsets: \["thai"\][\s\S]*?weight: \["400", "500", "600", "700"\][\s\S]*?display: "swap"[\s\S]*?preload: true/);
  assert.match(layout, /className=\{`\$\{kanit\.variable\} \$\{kanitCritical\.variable\}`\}/);
  assert.doesNotMatch(layout, /const kanitCritical = Kanit\(\{[\s\S]*?weight: \[[^\]]*"300"/);
});

test('the Home LCP image is preloaded alongside the bounded critical font budget', () => {
  assert.match(home, /home-hero-desktop\.png[\s\S]*?fill preload loading="eager" fetchPriority="high" sizes="100vw"/);
});

test('existing Home and Blog ownership remains while current tool pages use shared v5 composition', () => {
  assert.match(home, /Website43/);
  assert.match(blog, /Website43/);
  for (const file of ['features/ci-planning/v5/V5CiPlanning.tsx','features/financial-health-check/v5/V5Fhc.tsx']) {
    const source = read(file);
    assert.match(source, /<V5Page\b[\s\S]*?current=/);
    assert.match(source, /<V5ToolHero/);
    assert.match(source, /functionalMotion\.scope/);
    assert.doesNotMatch(source, /Website43ToolHero|components\/layout\/ToolHero/);
  }
  assert.match(read('features/ci-planning/v5/V5CiPlanning.tsx'), /Recovery Reserve/);
});

test('current text tool heroes keep title, full lead and calculator CTA in natural responsive flow', () => {
  const hero = read('components/layout/v5/V5ToolParts.tsx');
  const toolCss = read('components/layout/v5/V5Tool.module.css');
  assert.match(hero, /<h1 id=\{id\}/);
  assert.match(hero, /<a className=\{shell.button\} href=\{cta.href\}>\{cta.label\}<\/a>/);
  assert.doesNotMatch(hero, /next\/image|<Image|position:\s*absolute/);
  assert.match(toolCss, /\.heroTitle \{ font-size: clamp\(30px, 6vw, 48px\)/);
  assert.match(toolCss, /\.heroLead \{ font-size: 18px; line-height: 2; \}/);
  assert.match(toolCss, /@media \(min-width: 1024px\) \{[\s\S]*?\.heroGrid \{ display: grid;/);
  for (const selector of ['hero','heroGrid','heroTitle','heroLead','heroAside']) {
    for (const rule of toolCss.matchAll(new RegExp('\\.' + selector + '(?:\\.[\\w-]+)?\\s*\\{([^}]+)\\}', 'g'))) assert.doesNotMatch(rule[1], /position:\s*absolute|(?:^|;)\s*height:\s*\d+px|overflow:\s*hidden/);
  }
});

test('current CI keeps TorYod secondary proof after its FAQ with the exact external target', () => {
  const ci = read('features/ci-planning/v5/V5CiPlanning.tsx');
  const toolCss = read('components/layout/v5/V5Tool.module.css');
  const target = 'https://www.toryod.co/projects/35d2877e-e97a-45ee-a6df-aefa5e09e2b3-ccpun-s-ci-planning';
  assert.equal(ci.split(target).length - 1, 1);
  assert.doesNotMatch(ci.split('<section id="ci-calculator"')[0], /toryod\.co/i);
  assert.ok(ci.indexOf('<V5Faq items={faqs}') < ci.indexOf(target));
  assert.match(ci, /target="_blank"[\s\S]*?rel="noopener"/);
  assert.match(ci, /width="240"[\s\S]*?height="54"[\s\S]*?loading="lazy"/);
  assert.match(toolCss, /\.badgeRow \{ display: flex; flex-wrap: wrap;/);
  assert.match(toolCss, /\.badgeRow img \{ display: block; height: auto; max-width: 240px;/);
});

test('Footer controls and warnings stay inside the visible Website 4.3 footer card at every breakpoint', () => {
  const css = read('components/layout/website-43/Website43.module.css');
  assert.match(css, /\.footerColumn \.footerCookieButton \{[^}]*min-height: 44px;[^}]*font-size: 13px;/, 'one responsive Cookie Settings control retains its touch target and secondary text size');
  assert.doesNotMatch(css, /\.footerCompact|\.footerFull \{[^}]*display: none/, 'the grouped footer remains visible at every width');
  assert.match(css, /\.footerTop \{[^}]*minmax\(0,1\.5fr\) repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /\.footerTop \{[^}]*repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /\.footerTop \{[^}]*repeat\(2,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(css, /\.notFoundFooterWrap \{[^}]*height: \d+px/, '404 footer grows with the same legal and navigation content');

  for (const path of ['components/layout/website-43/Website43Shared.tsx', 'features/home/website-43/Website43HomeStatic.tsx']) {
    const footer = read(path);
    const desktop = footer.split('className={styles.footerFull}>')[1];
    const infoColumn = desktop?.match(/<strong>ข้อมูล<\/strong>([\s\S]*?)<\/div>/)?.[1];
    assert.match(infoColumn, /<CookieSettingsButton className=\{styles\.footerCookieButton\} \/>/, `${path}: desktop button belongs in the info column`);
    assert.equal(desktop.match(/<CookieSettingsButton\b/g)?.length, 1, `${path}: exactly one desktop button`);
    assert.match(desktop, /footerDisclaimer[\s\S]*?footerWarnings[\s\S]*?footerCopyright/, `${path}: warnings belong in the lower desktop card`);
    assert.doesNotMatch(footer, /styles\.footerCompact/, `${path}: duplicate compact content is removed`);
    assert.doesNotMatch(footer, /<div className=\{styles\.inner\}>\s*\{warnings \? \(/, `${path}: warnings must not sit above the footer card`);
  }
});


test('Article header keeps only date metadata and the author identity stays in the lower author card', () => {
  assert.doesNotMatch(article, /className=\{styles\.articleByline\}/);
  assert.match(article, /className=\{styles\.articleHeaderMeta\}/);
  assert.match(article, /className=\{styles\.authorCard\}[\s\S]*?className=\{styles\.authorName\}/);
  assert.match(css, /\.articleMetaRow \{[\s\S]*?justify-content: space-between;/);
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
  assert.match(css, /\.faqAnswer \{ margin: 0; padding: 16px 20px 22px; border-top: 1px solid rgba\(224,201,133,.10\);/);
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

test('current Privacy and Cookie Policy use the v5 shell while preserving legal and SEO contracts', () => {
  const privacy = read('apps/web/app/privacy/page.tsx') + '\n' + read('features/legal/v5/V5Privacy.tsx');
  const cookiePolicy = read('apps/web/app/cookie-policy/page.tsx') + '\n' + read('features/legal/v5/V5CookiePolicy.tsx');
  const legalCss = read('components/layout/v5/V5Tool.module.css');

  for (const source of [privacy, cookiePolicy]) {
    assert.match(source, /<V5Page\b/);
    assert.match(source, /styles\.legalBody/);
    assert.match(source, /V5ToolHero/);
    assert.doesNotMatch(source, /components\/layout\/Navbar/);
    assert.doesNotMatch(source, /components\/layout\/Footer/);
  }

  assert.match(privacy, /canonical: "https:\/\/ccpun\.com\/privacy\/"/);
  assert.match(cookiePolicy, /canonical: "https:\/\/ccpun\.com\/cookie-policy\/"/);
  assert.match(privacy, /ภายใต้พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ\.ศ\. 2562 \(PDPA\) คุณมีสิทธิ์/);
  assert.match(privacy, /ผู้ควบคุมข้อมูลส่วนบุคคลของเว็บไซต์นี้คือ/);
  assert.match(cookiePolicy, /Google Analytics 4 \(GA4\) และ Google Tag Manager \(GTM\)/);
  assert.match(cookiePolicy, /Meta Pixel เพื่อการวัดผลและการตลาด/);
  assert.match(cookiePolicy, /คุณควบคุมการใช้คุกกี้ได้ 3 วิธี/);

  assert.match(legalCss, /\.legalBody \{ min-width: 0; color: var\(--v5-muted\); font-size: 16px;/);
  assert.match(legalCss, /\.legalBody section \{[^}]*border-top: 1px solid var\(--v5-border-soft\)/);
  assert.match(legalCss, /\.legalBody a \{[^}]*color: var\(--v5-gold-text\);[^}]*overflow-wrap: anywhere/);
  assert.match(legalCss, /@media \(max-width: 1023px\)/);
  assert.match(legalCss, /\.legalBody table \{ width: 100%;/);
  assert.match(legalCss, /\.tableScroll \{ overflow-x: auto;/);
});
