import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Blog, { type Website43BlogClientClassNames } from '../features/blog/website-43/Website43BlogInteractive';
import { BLOG_PAGE_SIZE, blogPage, blogPageHref, safeBlogReturn } from '../features/blog/website-43/BlogNavigation';

test('public navigation, footer and Money Story expose 44px targets without changing links', () => {
  const read = (file: string) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const navCss = read('components/layout/website-43/Website43Navbar.module.css');
  const sharedCss = read('components/layout/website-43/Website43.module.css');
  function rule(source: string, selector: string) {
    const start = source.indexOf(selector + ' {');
    assert.ok(start >= 0, selector);
    return source.slice(start, source.indexOf('}', start));
  }
  for (const [source, selector] of [[navCss, '.brandLink'], [navCss, '.mobileSubmenu a'], [sharedCss, '.mobileSubmenu a'],
    [sharedCss, '.footerColumn a'], [sharedCss, '.root .footerColumn .footerCookieButton'], [sharedCss, '.footerCompact nav a'], [sharedCss, '.gameEntry a']]) {
    const minimumHeight = Number(rule(source, selector).match(/min-height: (\d+)px/)?.[1]);
    assert.ok(minimumHeight >= 44, selector + ': touch target must be at least 44px');
  }
  assert.match(rule(sharedCss, '.footerCompact nav a'), /min-width: 44px/);
  assert.match(rule(navCss, '.brandLink:focus-visible'), /outline: 2px solid/);
  assert.match(sharedCss, /\.root :is\(a, button, input, select, textarea, summary\):focus-visible \{ outline: 2px solid/);
  assert.match(read('components/layout/website-43/Website43Navbar.tsx'), /href=\{HOME\} className=\{styles\.brandLink\}/);
});

test('Desktop, tablet and mobile tools expose the same ordered links and readable glass surface', () => {
  const require = createRequire(import.meta.url);
  const { transpileModule, ModuleKind } = require('typescript') as typeof import('typescript');
  const { JSDOM } = require('jsdom');
  const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const source = read('components/layout/website-43/Website43Navbar.tsx');
  const css = read('components/layout/website-43/Website43Navbar.module.css');
  const loaded = { exports: {} as { Website43Navbar: (props: Record<string, never>) => React.ReactNode } };
  runInNewContext(transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, jsx: 4 } }).outputText, {
    module: loaded, exports: loaded.exports, require: (name: string) => {
      if (name === 'react/jsx-runtime') return require(name);
      if (name === 'react') return { useState: () => [true, () => {}], useEffect: () => {}, useRef: () => ({ current: null }) };
      if (name === 'next/link') return { default: 'a' };
      if (name === 'next/navigation') return { usePathname: () => '/play/money-story/' };
      if (name === './constants') return { WEBSITE43_BASE: '', WEBSITE43_HOME: '/' };
      assert.equal(name, './Website43Navbar.module.css');
      return { default: new Proxy({}, { get: (_target, key) => String(key) }) };
    },
  });
  const dom = new JSDOM(renderToStaticMarkup(loaded.exports.Website43Navbar({})));
  const expected = [
    ['/play/money-story', 'Money Story (Beta)'],
    ['/tools/financial-health-check', 'ตรวจสุขภาพการเงิน (Beta)'],
    ['/ci-planning', 'วางแผนเงินก้อนโรคร้ายแรง'],
  ];
  for (const selector of ['.navDropdown', '.mobileSubmenu']) {
    const links = [...dom.window.document.querySelectorAll(selector + ' a')] as HTMLAnchorElement[];
    assert.deepEqual(links.map(link => [link.getAttribute('href'), link.textContent]), expected);
    assert.equal(links.filter(link => link.getAttribute('aria-current') === 'page').length, 1);
    assert.ok(links.every(link => link.querySelector('span[aria-hidden="true"]')), 'matching visual marker on both menus');
  }
  assert.match(css, /\.navDropdown, \.mobileMenu \{[^}]*background-color: rgba\(37,24,24,\.9\);[^}]*backdrop-filter: blur\(20px\);/);
  assert.match(css, /\.navDropdown a, \.mobileSubmenu a \{[^}]*min-height: 48px;[^}]*color: var\(--w43-ink\);/);
  assert.match(css, /\.mobileMenu \{[^}]*max-height: calc\(100dvh - 112px\);[^}]*overflow-y: auto;/);
  assert.match(css, /\.navDropdown a:focus-visible, \.mobileSubmenu a:focus-visible \{[^}]*outline: 2px solid var\(--w43-gold-bright\);/);
  dom.window.close();
});

test('Home hero uses one sizing rule for both CTA destinations at every breakpoint', () => {
  const source = readFileSync(new URL('../components/layout/website-43/Website43.module.css', import.meta.url), 'utf8');
  const rules = [...source.matchAll(/([^{}]+)\{([^{}]+)\}/g)];
  const actionRules = rules.filter(([, selector]) => selector.includes('.heroActions .'));
  assert.ok(actionRules.length >= 3);
  for (const [, selector, declarations] of actionRules) {
    assert.ok(selector.includes('.primaryButton') && selector.includes('.outlineButton'), 'no breakpoint may size only one Hero CTA');
    assert.match(declarations, /min-height: 52px/);
  }
  assert.match(source, /\.heroActions \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});

test('Legal body and native Cookie tables stay readable and allow long identifiers to fit at portrait and landscape widths', () => {
  const source = readFileSync(new URL('../components/layout/website-43/Website43Legal.module.css', import.meta.url), 'utf8');
  const { parse } = createRequire(import.meta.url)('postcss') as typeof import('postcss');
  const sheet = parse(source);
  function declarations(selector: string, width: number) {
    const values: Record<string, string> = {};
    sheet.walkRules((rule) => {
      if (!rule.selectors.includes(selector)) return;
      if (rule.parent?.type === 'atrule') {
        const media = rule.parent as import('postcss').AtRule;
        if (media.name !== 'media') return;
        const max = Number(media.params.match(/max-width:\s*(\d+)px/)?.[1] ?? Infinity);
        if (width > max || /prefers-/.test(media.params)) return;
      }
      rule.walkDecls((declaration) => { values[declaration.prop] = declaration.value; });
    });
    return values;
  }
  for (const width of [320, 390, 667, 844, 932, 1024, 1440]) {
    for (const selector of ['.content p', '.content li', '.content address', '.content td', '.content th']) {
      assert.equal(declarations(selector, width)['font-size'], '16px');
      assert.equal(declarations(selector, width)['line-height'], '1.7');
    }
    const table = declarations('.content table', width);
    assert.equal(table.width, '100%');
    assert.equal(table['table-layout'], 'fixed');
    assert.notEqual(table.display, 'block');
    assert.equal(declarations('.content td', width)['overflow-wrap'], 'anywhere');
    assert.equal(declarations('.content td:first-child', width).width, '40%');
    assert.equal(declarations('.content a', width)['overflow-wrap'], 'anywhere');
  }
});

test('native cookie controls retain consent choices and the 28px visual track inside a 44px hit area', () => {
  const { transpileModule, ModuleKind } = createRequire(import.meta.url)('typescript') as typeof import('typescript');
  const source = readFileSync(new URL('../features/analytics/components/CookieConsentPreferences.tsx', import.meta.url), 'utf8');
  const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, jsx: 4 } }).outputText;
  type Element = { type: unknown; props: { children?: unknown; className?: string; style?: Record<string, unknown>; type?: string; role?: string; 'aria-checked'?: boolean; 'aria-expanded'?: boolean; 'aria-controls'?: string; onClick?: () => void; id?: string } };
  const states: unknown[] = []; let index = 0;
  const loaded = { exports: {} as { CategoryRow: (props: unknown) => unknown } };
  runInNewContext(compiled, { module: loaded, exports: loaded.exports, require: (name: string) => {
    if (name === 'react/jsx-runtime') {
      const jsx = (type: unknown, props: unknown) => typeof type === 'function' ? type(props) : { type, props };
      return { jsx, jsxs: jsx };
    }
    assert.equal(name, 'react');
    return { useState: (value: unknown) => { const slot = index++; if (!(slot in states)) states[slot] = value;
      return [states[slot], (next: unknown) => { states[slot] = typeof next === 'function' ? next(states[slot]) : next; }]; } };
  } });
  const elements = (node: unknown): Element[] => {
    if (Array.isArray(node)) return node.flatMap(elements);
    if (!node || typeof node !== 'object' || !('props' in node)) return [];
    const element = node as Element;
    return [element, ...elements(element.props.children)];
  };
  const changed: boolean[] = [];
  const render = (checked: boolean, alwaysActive = false) => { index = 0; return elements(loaded.exports.CategoryRow({ label: 'Synthetic category', description: 'Synthetic detail', checked,
    onChange: (value: boolean) => changed.push(value), alwaysActive, toggleId: 'synthetic-choice' })); };
  let tree = render(false);
  for (const button of tree.filter(element => element.type === 'button')) {
    assert.equal(button.props.type, 'button', 'native Enter/Space activation must remain available');
    assert.equal(button.props.style?.minWidth, '44px');
    assert.equal(button.props.style?.minHeight, '44px');
    assert.match(button.props.className!, /focus-visible:outline-2/);
  }
  const toggle = tree.find(element => element.props.role === 'switch')!;
  assert.equal(toggle.props['aria-checked'], false);
  const track = elements(toggle).find(element => element.type === 'span' && element.props.style?.height === '1.75rem');
  assert.ok(track, 'visual track stays 28px at the default font size');
  toggle.props.onClick!();
  assert.deepEqual(changed, [true]);
  tree = render(true);
  tree.find(element => element.props.role === 'switch')!.props.onClick!();
  assert.deepEqual(changed, [true, false]);
  const expand = tree.find(element => element.props['aria-expanded'] === false)!;
  assert.equal(expand.props['aria-controls'], 'desc-synthetic-choice');
  expand.props.onClick!();
  tree = render(false);
  assert.ok(tree.some(element => element.props.id === 'desc-synthetic-choice'));
  assert.equal(tree.find(element => element.type === 'button' && element.props['aria-expanded'] === true)?.props['aria-controls'], 'desc-synthetic-choice');
  assert.equal(render(true, true).some(element => element.props.role === 'switch'), false, 'always-active category must not become optional');
});
test('six cards per page without hiding remainder, fixtures 0/6/7/12/13', () => {
  for (const total of [0, 6, 7, 12, 13]) {
    const items = Array.from({ length: total }, (_, i) => i);
    const { pages } = blogPage('1', total);
    const rendered = Array.from({ length: pages }, (_, i) => items.slice(i * BLOG_PAGE_SIZE, (i + 1) * BLOG_PAGE_SIZE));
    assert.deepEqual(rendered.flat(), items);
    assert.ok(rendered.every(page => page.length <= 6));
    assert.equal(pages, Math.max(1, Math.ceil(total / 6)));
  }
});
test('invalid pages cannot produce an unreachable empty page', () => {
  for (const value of [null, '', '-1', '0', '1.5', 'x', 'Infinity', '9007199254740993']) assert.equal(blogPage(value, 13).page, 1);
  assert.equal(blogPage('99', 13).page, 3);
  assert.equal(blogPage('2', 13).page, 2);
  assert.equal(blogPage('3', 0).page, 1);
});
test('paging preserves query/category/tags and page one removes page', () => {
  const href = blogPageHref('/blog/life-insurance/?q=ภาษี&tag=เงิน&page=2', 3);
  const url = new URL(href, 'https://ccpun.com');
  assert.equal(url.pathname, '/blog/life-insurance/');
  assert.equal(url.searchParams.get('q'), 'ภาษี');
  assert.equal(url.searchParams.get('tag'), 'เงิน');
  assert.equal(url.searchParams.get('page'), '3');
  assert.equal(new URL(blogPageHref(href, 1), url.origin).searchParams.has('page'), false);
});
test('contextual return permits only same-site listing URLs', () => {
  assert.equal(safeBlogReturn('/blog/?q=x&page=2'), '/blog/?q=x&page=2');
  assert.equal(safeBlogReturn('/blog/life-insurance/?page=2'), '/blog/life-insurance/?page=2');
  for (const value of ['https://evil.test/blog/', '//evil.test/blog/', 'javascript:alert(1)', '/blog/life-insurance/article/', '/api/admin/', null]) assert.equal(safeBlogReturn(value), null);
});

test('actual Blog rendering paginates all cards and search uses the same six-card boundary', () => {
  const classNames = Object.fromEntries(['articleCard','articleImage','articleCardBody','articleCategory','articleTitle','articleExcerpt','articleMeta','blogContent','inner','eyebrow','featuredViewport','featuredScroller','featuredRail','featuredCard','carouselControls','carouselDotButton','carouselDotButtonActive','searchFilters','searchField','categoryMenu','categoryMenuButton','categoryMenuChevron','categoryMenuChevronOpen','categoryMenuPanel','categoryMenuOption','categoryMenuOptionActive','categoryMenuIndicator','articleListHeading','h2','articleGrid','emptyState','pagination','resultCount'].map(name => [name, name])) as Website43BlogClientClassNames;
  for (const total of [0, 6, 7, 12, 13]) {
    const articles = Array.from({ length: total }, (_, i) => ({ slug: String(i), category: 'หมวด', title: 'ตรงคำค้น ' + i, excerpt: '', meta: '', publishedAt: '', image: '/assets/pun.jpg', imageWidth: 400, imageHeight: 400, href: '/blog/fixture/' + i + '/', tags: [] }));
    for (let page = 1; page <= Math.max(1, Math.ceil(total / 6)); page++) {
      const html = renderToStaticMarkup(React.createElement(Blog, { articles, featuredArticles: [], initialQuery: 'ตรงคำค้น', initialPage: String(page), categories: [{ slug: null, title: 'ทั้งหมด' }], classNames }));
      assert.equal((html.match(/class="articleCard"/g) ?? []).length, Math.min(6, Math.max(0, total - (page - 1) * 6)));
      assert.equal(html.includes('aria-label="หน้าบทความ"'), total > 6);
      if (total > 6) assert.ok(html.includes('aria-current="page"'));
    }
  }
});
