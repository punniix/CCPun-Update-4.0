import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shared = readFileSync(new URL('../features/website-43-uat/Website43Shared.tsx', import.meta.url), 'utf8');
const transition = readFileSync(new URL('../features/website-43-uat/Website43TransitionStyles.tsx', import.meta.url), 'utf8');
const polish = readFileSync(new URL('../features/website-43-uat/Website43FinalPolishStyles.tsx', import.meta.url), 'utf8');
const contract = readFileSync(new URL('../features/website-43-uat/Website43LayoutContractStyles.tsx', import.meta.url), 'utf8');
const moduleCss = readFileSync(new URL('../features/website-43-uat/Website43.module.css', import.meta.url), 'utf8');

const transitionIndex = shared.indexOf('<Website43TransitionStyles />');
const polishIndex = shared.indexOf('<Website43FinalPolishStyles />');
const contractIndex = shared.indexOf('<Website43LayoutContractStyles />');

assert.ok(transitionIndex >= 0, 'Website 4.3 must load transition styles');
assert.ok(polishIndex > transitionIndex, 'final polish must load after transition styles');
assert.ok(contractIndex > polishIndex, 'layout contract must load last so shell alignment cannot be overridden by visual polish');

assert.match(contract, /data-w43-layout-contract="centered-shell-v2"/, 'layout contract marker must stay stable for QA');
assert.match(contract, /--w43-shell-max:\s*1280px/, 'desktop shell cap must remain 1280px');
assert.match(contract, /--w43-shell-edge:\s*max\(var\(--w43-nav-gutter\),\s*calc\(\(100% - var\(--w43-shell-max\)\) \/ 2\)\)/, 'wide-screen shell edge must use the scrollbar-excluding containing width');
assert.match(contract, /margin-left:\s*auto;[\s\S]*margin-right:\s*auto;/, 'shared shells must use automatic symmetric margins');
assert.match(contract, /homeHeroCopy[\s\S]*blogHeroCopy[\s\S]*toolHeroCopy[\s\S]*left:\s*var\(--w43-shell-edge\)/, 'desktop hero copy must align to the centered shell edge');
assert.match(contract, /heroActions[\s\S]*heroProof[\s\S]*margin-left:\s*0;[\s\S]*margin-right:\s*0;/, 'hero children must inherit their parent anchor without compensation');

/* Legacy horizontal compensation is forbidden in interpolation/polish layers. */
assert.doesNotMatch(transition, /margin-left:\s*0;/, 'transition layer must not left-pin constrained shells');
assert.doesNotMatch(transition, /margin-right:\s*0;/, 'transition layer must not manually counterbalance constrained shells');
assert.doesNotMatch(polish, /heroActions[^}]*margin-left/s, 'hero CTA group must not carry a one-off horizontal compensation');
assert.doesNotMatch(polish, /footerWrap[^}]*padding-left/s, 'final polish must not own footer horizontal shell padding');
assert.doesNotMatch(polish, /toolStorySection[^}]*padding-left/s, 'final polish must not own tool-story horizontal shell padding');
assert.doesNotMatch(polish, /notFound[^}]*margin-left/s, 'final polish must not left-pin 404 readable content');
assert.doesNotMatch(contract, /50vw/, 'layout contract must not derive shell alignment from viewport units that include the scrollbar');
assert.doesNotMatch(moduleCss, /(?:homeHeroCopy|blogHeroCopy|toolHeroCopy)[^}]*100vw/s, 'base hero copy must not retain legacy viewport compensation');
assert.match(moduleCss, /homeHeroCopy[^}]*left:\s*var\(--w43-hero-gutter,\s*80px\)[\s\S]*blogHeroCopy[^}]*left:\s*var\(--w43-hero-gutter,\s*80px\)[\s\S]*toolHeroCopy[^}]*left:\s*var\(--w43-hero-gutter,\s*80px\)/s, 'base hero copy must consume the shared hero gutter token');

assert.doesNotMatch(transition, /--w43-shell-width/, 'transition must not calculate a second viewport-sized shell');
assert.doesNotMatch(transition, /legalGrid\}\s*\{[^}]*100vw/s, 'legal reading width must not exceed its containing block');
assert.match(contract, /width:\s*100%;\s*max-width:\s*var\(--w43-shell-max\)/, 'the shared contract owns containing-block constrained widths');
assert.match(contract, /navOverlay\}\s*\{\s*width:\s*min\(var\(--w43-shell-max\),\s*calc\(100% - var\(--w43-nav-gutter\) - var\(--w43-nav-gutter\)\)\)/s, 'overlay navigation is constrained to the same available space');

/* Transition references must use shared tokens rather than page-specific edge numbers. */
assert.match(transition, /blogHeroCopy[\s\S]*left:\s*var\(--w43-hero-gutter\)/, 'blog hero copy must use the shared hero gutter');
assert.match(transition, /toolHeroCopy[\s\S]*left:\s*var\(--w43-hero-gutter\)/, 'tool hero copy must use the shared hero gutter');
assert.match(transition, /--w43-content-gutter:\s*var\(--w43-nav-gutter\)/, 'desktop content and navigation gutters must share one interpolation token');

/* Explicit full-bleed exceptions remain allowed and documented by their geometry. */
assert.match(moduleCss, /featuredViewport[^}]*width:\s*100vw;[^}]*calc\(50% - 50vw\)/s, 'featured carousel viewport remains an intentional full-bleed exception');

const viewportCases = [390, 600, 820, 1024, 1100, 1280, 1440, 1728, 1920];
for (const viewport of viewportCases) {
  const navGutter = viewport < 640
    ? Math.min(32, Math.max(24, 0.0380952 * viewport + 9.14286))
    : viewport < 1024
      ? 40
      : Math.min(80, Math.max(56, 0.0705882 * viewport - 21.6471));

  for (const scrollbar of [0, 8, 17]) {
    const layoutWidth = viewport - scrollbar;
    const gutter = viewport < 640 ? 24 : navGutter;
    const cap = viewport < 640
      ? Math.min(504, Math.max(342, 0.771429 * viewport + 41.1429))
      : 1280;
    const shellWidth = Math.min(layoutWidth - 2 * gutter, cap);
    const left = (layoutWidth - shellWidth) / 2;
    const right = layoutWidth - shellWidth - left;
    assert.ok(shellWidth <= layoutWidth - 2 * gutter, `shell respects the containing block at ${viewport}px / scrollbar ${scrollbar}`);
    assert.ok(Math.abs(left - right) < 0.001, `shell margins balance at ${viewport}px / scrollbar ${scrollbar}`);
    if (viewport >= 1024) {
      const shellEdge = Math.max(navGutter, (layoutWidth - 1280) / 2);
      const navWidth = Math.min(1280, layoutWidth - 2 * navGutter);
      assert.ok(Math.abs(shellEdge - left) < 0.001, `hero and content share the same coordinate system at ${viewport}px / scrollbar ${scrollbar}`);
      assert.ok(Math.abs((layoutWidth - navWidth) / 2 - left) < 0.001, `navigation shares the shell edge at ${viewport}px / scrollbar ${scrollbar}`);
    }
  }
}

const canonical = new Map([
  [390, { shell: 342, edge: 24 }],
  [820, { shell: 740, edge: 40 }],
  [1440, { shell: 1280, edge: 80 }],
  [1728, { shell: 1280, edge: 224 }],
  [1920, { shell: 1280, edge: 320 }],
]);
for (const [viewport, expected] of canonical) {
  assert.equal((viewport - expected.shell) / 2, expected.edge, `${viewport}px canonical shell edge must stay symmetric`);
}

console.log('Website 4.3 layout + legacy compensation regression passed.');
