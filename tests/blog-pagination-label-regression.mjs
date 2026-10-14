import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const component = readFileSync('features/blog/website-43/Website43BlogInteractive.tsx', 'utf8');
test('Blog pagination omits the redundant page / total text while preserving controls and state', () => {
  const pagination = component.match(/\{pages > 1 && <nav[\s\S]*?<\/nav>\}/)?.[0];
  assert.ok(pagination, 'pagination should remain mounted only when pages > 1');
  assert.doesNotMatch(pagination, /<span>หน้า\s*\{page\}\s*\/\s*\{pages\}<\/span>/);
  assert.match(pagination, /onClick=\{\(\) => selectPage\(page - 1\)\}>ก่อนหน้า<\/button>/);
  assert.match(pagination, /onClick=\{\(\) => selectPage\(page \+ 1\)\}>ถัดไป<\/button>/);
  assert.match(pagination, /blogPageHref\(/, 'numbered pages must preserve real hrefs');
  assert.match(pagination, /aria-current=\{n === page \? 'page' : undefined\}/, 'current page remains accessible');
  assert.match(pagination, /selectPage\(n\)/);
  assert.match(pagination, /aria-label="หน้าบทความ"/);
});

test('Blog article-count summary is removed from archive and category layouts, without changing pagination', () => {
  const shell = readFileSync('features/blog/website-43/Website43Blog.tsx', 'utf8');
  const css = readFileSync('components/layout/website-43/Website43.module.css', 'utf8');
  assert.doesNotMatch(component, /resultCount|แสดง \$\{\(page - 1\)/);
  assert.doesNotMatch(shell, /resultCount/);
  assert.doesNotMatch(css, /\.resultCount/);
  assert.match(component, /\{filteredArticles\.length \? \(/, 'article results still render');
  assert.match(component, /\{pages > 1 && <nav/, 'pagination still renders for multiple pages');
});
