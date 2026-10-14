import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';

const read = (path) => readFileSync(path, 'utf8');

test('Article keeps the breadcrumb but never mounts the old return-to-search link', () => {
  const article = read('features/blog/website-43/Website43Article.tsx');
  assert.match(article, /aria-label="Breadcrumb"/);
  assert.match(article, /className=\{styles\.articleHeadline\}/);
  assert.doesNotMatch(article, /BlogReturnLink|กลับไปผลการค้นหา/);
  assert.match(article, /<Website43Footer \/>/, 'Article footer uses its original layout');
});

test('Home and inner-page Footer retain brand, navigation and cookie control but remove the two-line tagline', () => {
  for (const file of ['components/layout/website-43/Website43Shared.tsx', 'features/home/website-43/Website43HomeStatic.tsx']) {
    const source = read(file);
    assert.doesNotMatch(source, /วางแผนการเงินจากชีวิตจริง|เพื่อให้คุณตัดสินใจได้อย่างมั่นใจ|footerBrandText/, file);
    assert.match(source, /<CookieSettingsButton/, file);
    assert.match(source, /(?:HomeBrand|Website43Brand)/, file);
    assert.match(source, /เกี่ยวกับ Pun|Privacy/, file);
  }
});

test('Only Blog archive and category routes opt into zero bottom gap; CSS overrules all breakpoints', () => {
  const blog = read('features/blog/website-43/Website43Blog.tsx');
  const shared = read('components/layout/website-43/Website43Shared.tsx');
  const css = read('components/layout/website-43/Website43.module.css');
  assert.match(blog, /<Website43Footer flushBottom \/>/);
  assert.match(shared, /flushBottom \? styles\.footerFlushBottom/);
  const rules = [];
  postcss.parse(css).walkRules((rule) => {
    if (rule.selector === '.footerWrap.footerFlushBottom') {
      rules.push({ selector: rule.selector, pad: rule.nodes.find((x) => x.prop === 'padding-bottom')?.value });
    }
  });
  assert.deepEqual(rules, [{ selector: '.footerWrap.footerFlushBottom', pad: '0' }]);
  assert.doesNotMatch(read('features/blog/website-43/Website43Article.tsx'), /Website43Footer flushBottom/);
});
