import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { Children, isValidElement, type ReactElement } from 'react';

const require = createRequire(import.meta.url);
const { transpileModule, ModuleKind } = require('typescript') as typeof import('typescript');
const classes = new Proxy({}, { get: (_target, name) => String(name) });
type Element = ReactElement<Record<string, unknown>>;
function load(file: string, dependencies: Record<string, unknown>) {
  const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const exports: Record<string, unknown> = {};
  runInNewContext(transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, jsx: 4 } }).outputText, {
    exports,
    require: (name: string) => {
      if (name in dependencies) return dependencies[name];
      if (name === 'react/jsx-runtime') return require(name);
      if (name.endsWith('.module.css')) return { default: classes };
      if (name === 'next/image') return { default: () => null };
      throw new Error('Unexpected dependency: ' + name);
    },
    ...dependencies,
  });
  return exports;
}
function elements(tree: unknown): Element[] {
  const result: Element[] = [];
  for (const child of Children.toArray(tree as never)) {
    if (isValidElement<Record<string, unknown>>(child)) {
      result.push(child);
      result.push(...elements(child.props.children));
    }
  }
  return result;
}

test('Article tables preserve one native table, all cells and scoped column headers', () => {
  const loaded = load('features/blog/website-43/Website43ArticleBody.tsx', { './ArticleDetailAccess': { ArticleTableAccess: 'table-access' } });
  const render = loaded.renderWebsite43ArticleBody as (items: unknown[], headings: Map<number, string>) => unknown;
  const headers = ['รายการ', 'วงเงินหลัก', 'เงื่อนไขสำคัญ'];
  const rows = Array.from({ length: 21 }, (_, i) => ['รายการทดสอบ ' + i, 'วงเงินจำลอง ' + i, 'เงื่อนไขทดสอบ ' + i]);
  const tree = elements(render([{ type: 'table', headers, rows }], new Map()));
  assert.equal(tree.filter((node) => node.type === 'table').length, 1);
  assert.equal(tree.find((node) => node.type === 'table-access')?.props.stickyFirstColumn, true);
  assert.deepEqual(tree.filter((node) => node.type === 'th').map((node) => [node.props.scope, node.props.children]), headers.map((header) => ['col', header]));
  assert.deepEqual(tree.filter((node) => node.type === 'td').map((node) => node.props.children), rows.flat());
  for (const [columnHeaders, tableRows, expectedSticky] of [
    [['ชื่อ', 'ค่า'], [['ตัวอย่าง', 'จำลอง']], false],
    [[], [['หนึ่ง', 'สอง', 'สาม']], true],
  ] as const) {
    const table = elements(render([{ type: 'table', headers: columnHeaders, rows: tableRows }], new Map()));
    assert.equal(table.find((node) => node.type === 'table-access')?.props.stickyFirstColumn, expectedSticky);
  }
});

test('Article table scroll access follows actual measured overflow and cleans up its observer', () => {
  let overflow = false;
  let measure: () => void = () => {};
  let cleanup: (() => void) | undefined;
  let effectRun = false;
  let disconnected = false;
  const node = { scrollWidth: 560, clientWidth: 342, firstElementChild: {} };
  const observed: unknown[] = [];
  class Observer {
    constructor(callback: () => void) { measure = callback; }
    observe(target: unknown) { observed.push(target); }
    disconnect() { disconnected = true; }
  }
  const loaded = load('features/blog/website-43/ArticleDetailAccess.tsx', {
    react: {
      useRef: () => ({ current: node }),
      useId: () => 'synthetic-table-hint',
      useState: () => [overflow, (next: boolean) => { overflow = next; }],
      useEffect: (effect: () => () => void) => { if (!effectRun) { effectRun = true; cleanup = effect(); } },
    },
    ResizeObserver: Observer,
  });
  const render = loaded.ArticleTableAccess as (props: { children: null; stickyFirstColumn: boolean }) => unknown;
  render({ children: null, stickyFirstColumn: true });
  let tree = elements(render({ children: null, stickyFirstColumn: true }));
  const wrapper = tree.find((element) => element.type === 'div')!;
  assert.equal(wrapper.props.tabIndex, 0);
  assert.equal(wrapper.props.role, 'region');
  assert.equal(wrapper.props['data-wide-table'], true);
  assert.equal(wrapper.props['aria-describedby'], tree.find((element) => element.type === 'p')?.props.id);
  assert.deepEqual(observed, [node, node.firstElementChild]);
  node.clientWidth = 800;
  measure();
  tree = elements(render({ children: null, stickyFirstColumn: false }));
  const fittedWrapper = tree.find((element) => element.type === 'div')!;
  assert.equal(fittedWrapper.props.tabIndex, undefined);
  assert.equal(fittedWrapper.props.role, undefined);
  assert.equal(fittedWrapper.props['aria-describedby'], undefined);
  assert.equal(fittedWrapper.props['data-wide-table'], undefined);
  assert.equal(tree.some((element) => element.type === 'p'), false);
  cleanup?.();
  assert.equal(disconnected, true);
});

test('Article table CSS keeps native horizontal scrolling and a readable opaque sticky column', () => {
  const styles = readFileSync(new URL('../components/layout/website-43/Website43.module.css', import.meta.url), 'utf8');
  assert.match(styles, /\.articleTableWrap \{[^}]*overflow-x: auto/);
  assert.match(styles, /\.articleTableWrap:focus-visible \{ outline: 2px solid/);
  assert.match(styles, /\.articleTable \{[^}]*border-collapse: separate; border-spacing: 0[^}]*font-size: 16px; line-height: 1\.65/);
  assert.match(styles, /data-wide-table='true'[^}]*:first-child \{ position: sticky; left: 0; width: 144px; z-index: 1; background: var\(--w43-bg\)/);
  assert.doesNotMatch(styles, /touch-action:\s*pan-x/);
});

test('Blog dot and TOC hit areas remain 44px while their visual indicators stay small', () => {
  const source = readFileSync(new URL('../components/layout/website-43/Website43.module.css', import.meta.url), 'utf8');
  const { parse } = require('postcss') as typeof import('postcss');
  const sheet = parse(source);
  function declarations(selector: string) {
    const values: Record<string, string> = {};
    sheet.walkRules((rule) => {
      if (rule.parent?.type === 'atrule' || !rule.selectors.includes(selector)) return;
      rule.walkDecls((declaration) => { values[declaration.prop] = declaration.value; });
    });
    return values;
  }
  for (const selector of ['.carouselDotButton', '.carouselDotButtonActive', '.tocToggle']) {
    assert.equal(declarations(selector).width, '44px');
  }
  assert.equal(declarations('.carouselDotButton').height, '44px');
  assert.equal(declarations('.tocToggle').height, '44px');
  for (const selector of ['.tocPrimary', '.tocSecondary']) assert.equal(declarations(selector)['min-height'], '44px');
  assert.equal(declarations('.carouselDotButton::after').width, '9px');
  assert.equal(declarations('.carouselDotButtonActive::after').width, '30px');
  assert.equal(declarations('.articleCard').display, 'flex');
  assert.equal(declarations('.articleCard')['flex-direction'], 'column');
  assert.equal(declarations('.articleCardBody').flex, '1');
  assert.equal(declarations('.articleMeta')['margin-top'], 'auto');
});
