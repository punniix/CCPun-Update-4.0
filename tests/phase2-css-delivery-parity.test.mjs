import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import ts from 'typescript';
import { assertPhase2MoneyComposition } from '../qa/phase2-source-proof.mjs';
import { runtimeFiles, sourceByFile, trackedFiles } from '../scripts/lib/public-reachability.mjs';

const read = file => readFileSync(file, 'utf8');
const sha = source => createHash('sha256').update(source).digest('hex');
const proof = JSON.parse(read('qa/phase2-css-delivery-parity.json'));
const file = 'components/styles/global-foundation.css';
const source = read(file);
const baselineCss = gunzipSync(Buffer.from(proof.compiledCssGzip, 'base64')).toString();
// Current authorized UAT motion/focus revision uses the locked Tailwind compiler.
// Original foundation source, controller semantics and unaffected protected owners remain frozen.
assert.equal(sha(proof.foundationSource), '16be3e70110eb57339671d20a877cb7a1f8026675ce0eecca47794d6efeafece');
assert.equal(sha(baselineCss), '36f095016bb22a67c80a4402cffd4c90b650b3ad0ef530173c2f9b5dcec8c2f8');
assert.equal(sha(JSON.stringify(proof.protected)), '2f9ccec2a360e6df8db3a8d3c140a9ea1a616b476549a553df98461aa977b083');
const reviewedUiOwners = [
  "components/layout/website-43/Website43.module.css",
  "components/layout/website-43/Website43Navbar.module.css",
  "components/layout/website-43/Website43Shared.tsx",
  "apps/web/app/layout.tsx"
];

test('Tailwind preserves automatic native app discovery and excludes only historical fixtures', () => {
  assert.match(source, /^@import "tailwindcss";/);
  const owners = [...source.matchAll(/@source "([^"\n]+)";/g)].map(([, owner]) => resolve('components/styles', owner));
  assert.deepEqual(owners, [resolve('components'), resolve('features')]);
  for (const directory of ['qa', 'tests', 'docs', 'scripts']) assert(source.includes(`@source not "../../${directory}";`));
  for (const historical of ['qa', 'tests', 'scripts', 'docs']) {
    assert(!owners.some(owner => resolve(historical) === owner || resolve(historical).startsWith(owner + '/')), historical);
  }
  // Only scanner ownership changes; stylesheet imports and every declared style stay exact.
  const fromPublicImports = value => value.slice(value.indexOf('@import "./public-compat.css";'));
  assert.equal(fromPublicImports(source), fromPublicImports(proof.foundationSource));
});

// Same strict reviewed-owner admission contract as the Production phase2 proof.
function assertReviewedUxOwners(proof, allowed, readCurrent = read) {
  assert.deepEqual(Object.keys(proof.reviewedUxOwners).sort(), [...allowed].sort());
  for (const path of allowed) {
    const admission = proof.reviewedUxOwners[path];
    assert.deepEqual(Object.keys(admission).sort(), ['baselineSha256', 'candidateSha256']);
    assert.equal(admission.baselineSha256, proof.protected[path], path + ': original protected digest retained');
    assert.match(admission.candidateSha256, /^[0-9a-f]{64}$/);
    assert.equal(sha(readCurrent(path)), admission.candidateSha256, path + ': exact reviewed current source');
  }
}

// Preserve the original protected hash; admit only the deployed portrait position.
function originalStylesExceptApprovedPortrait(source) {
  const ast = postcss.parse(source);
  const portraits = [];
  ast.walkRules('.authorAvatar', rule => { if (rule.parent.type === 'root') portraits.push(rule); });
  assert.equal(portraits.length, 1, 'One canonical author portrait rule');
  const positions = portraits[0].nodes.filter(node => node.type === 'decl' && node.prop === 'object-position');
  assert.equal(positions.length, 1, 'Only one approved author portrait position');
  assert.equal(positions[0].value, 'center top');
  assert.equal(Boolean(positions[0].important), false);
  positions[0].remove();
  return ast.toString();
}

// Historical0d projection: 674ffa21f62dbfbce3a76fdc947a1047a525640df3a8082e1dd50ba163c1ef01; original protected manifest remains unchanged.
test('original protected goldens remain frozen while four exact reviewed owners are admitted', () => {
  assertReviewedUxOwners(proof, reviewedUiOwners);
  // 0d already includes accepted Share/footer/padding changes after the older
  // protected CSS golden. Only the subsequent portrait position is projected.
  assert.equal(sha(originalStylesExceptApprovedPortrait(read('components/layout/website-43/Website43.module.css'))),
    '370a115c3ec303648cb02528f338e83b967ccc0abcea1cc777bfdb3dc57948cc', 'Exact approved Article/H4 CSS before the portrait projection');
  for (const [path, expected] of Object.entries(proof.protected)) {
    if (!Object.hasOwn(proof.reviewedUxOwners, path)) assert.equal(sha(read(path)), expected, path);
  }
});

test('reviewed owner admission rejects unknown paths, original baseline changes and current source drift', () => {
  const extra = structuredClone(proof);
  extra.reviewedUxOwners['unknown.tsx'] = { baselineSha256: '0'.repeat(64), candidateSha256: '0'.repeat(64) };
  assert.throws(() => assertReviewedUxOwners(extra, reviewedUiOwners));
  const baselineDrift = structuredClone(proof);
  baselineDrift.reviewedUxOwners[reviewedUiOwners[0]].baselineSha256 = '0'.repeat(64);
  assert.throws(() => assertReviewedUxOwners(baselineDrift, reviewedUiOwners));
  assert.throws(() => assertReviewedUxOwners(proof, reviewedUiOwners, path => read(path) + '\n/* unreviewed mutation */'));
});

test('raw CSS portrait admission rejects altered position, duplicates and unrelated declarations', () => {
  const path = 'components/layout/website-43/Website43.module.css';
  const css = read(path), portrait = css.match(/\.authorAvatar\s*\{[^}]+\}/)?.[0];
  assert.ok(portrait);
  assert.throws(() => originalStylesExceptApprovedPortrait(css.replace(portrait, portrait.replace('center top', 'center bottom'))));
  assert.throws(() => originalStylesExceptApprovedPortrait(css.replace(portrait, portrait.replace('object-position: center top;', 'object-position: center top; object-position: center top;'))));
  const unrelated = css.replace(portrait, portrait.replace('width: 96px;', 'width: 97px;'));
  assert.notEqual(unrelated, css);
  assert.notEqual(sha(originalStylesExceptApprovedPortrait(unrelated)), '370a115c3ec303648cb02528f338e83b967ccc0abcea1cc777bfdb3dc57948cc');
});

function declarations(node) {
  return (node.nodes ?? []).filter(child => child.type === 'decl').map(child => [child.prop, child.value, Boolean(child.important)]);
}
function ancestry(node) {
  const result = [];
  for (let parent = node.parent; parent.type !== 'root'; parent = parent.parent) result.unshift([parent.type, parent.type === 'rule' ? parent.selector : parent.name, parent.type === 'atrule' ? parent.params : null]);
  return result;
}
function rules(css) {
  const result = [];
  postcss.parse(css).walkRules(rule => result.push({ selector: rule.selector, ancestry: ancestry(rule), declarations: declarations(rule) }));
  return result;
}
function subsequence(actual, expected, label) {
  let offset = 0;
  for (const item of actual) {
    const key = JSON.stringify(item);
    while (offset < expected.length && JSON.stringify(expected[offset]) !== key) offset++;
    assert(offset++ < expected.length, label + ': ' + key);
  }
}

function admitOutlineRegistrationOrder(actual, expected) {
  const property = node => node.name === 'property' && node.ancestry.length === 0;
  const before = expected.filter(property), after = actual.filter(property);
  assert.equal(before.length, 68);
  assert.equal(after.length, 68);
  assert.equal(new Set(before.map(node => node.params)).size, 68);
  assert.equal(new Set(after.map(node => node.params)).size, 68);
  const indices = values => values.flatMap((node, index) => property(node) ? [index] : []);
  for (const values of [actual, expected]) {
    const positions = indices(values);
    assert(positions.every((position, index) => position === positions[0] + index), 'Registrations stay in one contiguous tail block');
    assert.equal(positions.at(-1), values.length - 4, 'Only existing pulse/layer/support headers follow the 68 registrations');
    assert.deepEqual(values.slice(positions.at(-1) + 1).map(node => [node.name, node.params, node.ancestry]), [
      ['keyframes', 'pulse', []], ['layer', 'properties', []],
      ['supports', '((-webkit-hyphens: none) and (not (margin-trim: inline))) or ((-moz-orient: inline) and (not (color:rgb(from red r g b))))', [['atrule', 'layer', 'properties']]],
    ]);
  }
  const outline = node => node.params === '--tw-outline-style';
  assert.equal(before.findIndex(outline), 43);
  const outlinePosition = after.findIndex(outline);
  assert([43, 67].includes(outlinePosition), 'Only identity or the previously reviewed outline relocation is admitted');
  assert.deepEqual(after.find(outline), {
    name: 'property', params: '--tw-outline-style', ancestry: [],
    declarations: [['syntax', '"*"', false], ['inherits', 'false', false], ['initial-value', 'solid', false]],
  });
  assert.deepEqual(after.find(outline), before.find(outline));
  assert.deepEqual(after.filter(node => !outline(node)), before.filter(node => !outline(node)), 'Other 67 registrations keep full values AND sequence');
  if (outlinePosition === 43) return actual;
  const normalized = [...actual];
  const position = actual.findIndex(node => property(node) && outline(node));
  const [record] = normalized.splice(position, 1);
  normalized.splice(indices(actual)[0] + 43, 0, record);
  return normalized;
}

test('the actual Tailwind compiler preserves runtime declarations and cascade order', async () => {
  const compiled = await postcss([tailwind({ optimize: false })]).process(source, { from: resolve(file) });
  const before = rules(baselineCss);
  const after = rules(compiled.css);
  // Theme variables can be removed only when excluded fixtures were their sole consumer.
  // Every remaining value and every normal/keyframe/media/support rule preserves order.
  const theme = rule => rule.selector === ':root, :host';
  const generatedDefaults = rule => rule.selector === '*, ::before, ::after, ::backdrop'
    && JSON.stringify(rule.ancestry) === JSON.stringify([
      ['atrule', 'layer', 'properties'],
      ['atrule', 'supports', '((-webkit-hyphens: none) and (not (margin-trim: inline))) or ((-moz-orient: inline) and (not (color:rgb(from red r g b))))'],
    ]);
  const oldDefaults = before.filter(generatedDefaults), newDefaults = after.filter(generatedDefaults);
  assert.equal(oldDefaults.length, 1);
  assert.equal(newDefaults.length, 1);
  const defaults = rule => {
    assert.equal(rule.declarations.length, 68);
    assert.equal(new Set(rule.declarations.map(([property]) => property)).size, 68);
    for (const [property, value, important] of rule.declarations) {
      assert.match(property, /^--tw-/);
      assert(!value.includes('var('), 'Generated defaults must remain independent');
      assert.equal(important, false);
    }
    return [...rule.declarations].sort(([a], [b]) => a.localeCompare(b));
  };
  assert.deepEqual(defaults(newDefaults[0]), defaults(oldDefaults[0]), 'All 68 independent initialization values stay exact');
  // Normalize only this single generated declaration registry, in its existing
  // sequence position. Every authored/normal rule and context retains strict order.
  const registryOrder = rule => generatedDefaults(rule) ? { ...rule, declarations: defaults(rule) } : rule;

  subsequence(after.filter(rule => !theme(rule)).map(registryOrder), before.filter(rule => !theme(rule)).map(registryOrder), 'compiled CSS rule order');
  const oldTheme = before.find(theme);
  const newTheme = after.find(theme);
  subsequence(newTheme.declarations, oldTheme.declarations, 'compiled theme value order');
  const atRules = css => {
    const records = [];
    postcss.parse(css).walkAtRules(node => records.push({
      name: node.name, params: node.params, ancestry: ancestry(node), declarations: declarations(node),
    }));
    return records;
  };
  const oldAtRules = atRules(baselineCss), currentAtRules = atRules(compiled.css);
  const omittedContainerMedia = node => node.name === 'media'
    && ['(width >= 40rem)', '(width >= 48rem)', '(width >= 64rem)', '(width >= 80rem)', '(width >= 96rem)'].includes(node.params)
    && JSON.stringify(node.ancestry) === JSON.stringify([['atrule', 'layer', 'utilities'], ['rule', '.container', null]])
    && JSON.stringify(node.declarations) === JSON.stringify([['max-width', node.params.slice('(width >= '.length, -1), false]]);
  assert.equal(oldAtRules.filter(omittedContainerMedia).length, 5);
  const currentContainerMedia = currentAtRules.filter(omittedContainerMedia);
  assert([0, 5].includes(currentContainerMedia.length));
  assert.deepEqual(admitOutlineRegistrationOrder(currentAtRules, oldAtRules), currentContainerMedia.length ? oldAtRules : oldAtRules.filter(node => !omittedContainerMedia(node)),
    'Every retained layer/media/support/keyframe/property record and sequence stays exact');
  const mutated = mutate => { const copy = structuredClone(currentAtRules); mutate(copy); return copy; };
  const outlineIndex = currentAtRules.findIndex(node => node.name === 'property' && node.params === '--tw-outline-style');
  assert.throws(() => admitOutlineRegistrationOrder(mutated(nodes => nodes.splice(0, 0, ...nodes.splice(outlineIndex, 1))), oldAtRules));
  assert.throws(() => admitOutlineRegistrationOrder(mutated(nodes => { nodes[outlineIndex].declarations[2][1] = 'dashed'; }), oldAtRules));
  assert.throws(() => admitOutlineRegistrationOrder(mutated(nodes => nodes.splice(outlineIndex, 0, structuredClone(nodes[outlineIndex]))), oldAtRules));
  const propertyStart = currentAtRules.findIndex(node => node.name === 'property');
  assert.throws(() => admitOutlineRegistrationOrder(mutated(nodes => { [nodes[propertyStart], nodes[propertyStart + 1]] = [nodes[propertyStart + 1], nodes[propertyStart]]; }), oldAtRules));

  assert.equal(JSON.stringify(newTheme.ancestry), JSON.stringify(oldTheme.ancestry));
  const currentKeys = new Set(after.map(rule => JSON.stringify(registryOrder(rule))));
  const removed = before.filter(rule => !theme(rule) && !currentKeys.has(JSON.stringify(registryOrder(rule))));
  const runtimeLiteralTokens = new Set();
  for (const path of runtimeFiles) {
    const tree = ts.createSourceFile(path, sourceByFile.get(path), ts.ScriptTarget.Latest, true);
    const visit = node => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
        || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
        for (const token of node.text.split(/\s+/)) runtimeLiteralTokens.add(token);
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  for (const rule of removed) {
    assert.match(rule.selector, /^\.[\w\\/-]+$/, 'Review any non-utility removal separately');
    const utility = rule.selector.slice(1).replace(/\\(.)/g, '$1');
    assert(!runtimeLiteralTokens.has(utility), 'Removed utility has an actual runtime literal: ' + utility);
  }
  const keptVariables = new Set(newTheme.declarations.map(([property]) => property));
  const removedVariables = oldTheme.declarations.filter(([property]) => !keptVariables.has(property));
  const currentStyles = trackedFiles.filter(path => path.endsWith('.css')).map(read).join('\n');
  const currentRuntime = [...sourceByFile.values()].join('\n');
  for (const [property] of removedVariables) {
    assert(!(compiled.css + currentStyles + currentRuntime).includes('var(' + property), property + ': current CSS variable consumer');
  }

  assert(Buffer.byteLength(compiled.css) <= proof.compiledBytes, 'ownership must not increase compiled CSS');
  for (const message of compiled.messages.filter(message => message.type === 'dir-dependency')) {
    assert(!['qa', 'tests', 'docs', 'scripts'].some(directory => message.dir === resolve(directory) || message.dir.startsWith(resolve(directory) + '/')), message.dir);
  }
});


test('Money composition admission rejects changed logic, unreachable owners, mutated views and output fixtures', () => {
  const composition = proof.moneyComposition;
  const baseline = composition.baselineSha256;
  assert.equal(baseline, '0c2c0ad70f9481a09354d3eab7cce346f9dae82ed843ecac4d9d98ff78e8276a');
  const current = read(composition.controller), owner = read(composition.owner);
  assert.equal(assertPhase2MoneyComposition(composition.controller, baseline), true);
  assert.throws(() => assertPhase2MoneyComposition('unknown.tsx', baseline));
  assert.throws(() => assertPhase2MoneyComposition(composition.controller, '0'.repeat(64)));
  const tamper = (file, replacement, reseal = false) => {
    const metadata = structuredClone(proof);
    if (reseal) {
      if (file === composition.controller) metadata.moneyComposition.controllerSha256 = sha(replacement);
      else if (file === composition.owner) metadata.moneyComposition.ownerSha256 = sha(replacement);
      else metadata.moneyComposition.outputTestSha256 = sha(replacement);
    }
    return path => path === 'qa/phase2-css-delivery-parity.json' ? JSON.stringify(metadata) : path === file ? replacement : read(path);
  };
  for (const [file, source] of [
    [composition.controller, current.replace('game.currentMonth === 12', 'game.currentMonth === 11')],
    [composition.controller, current.replace('  coverShortfallWithExpenseCut,', '  coverShortfallWithExtraIncome as coverShortfallWithExpenseCut,')],
    [composition.controller, current.replace('  coverShortfallWithExpenseCut,', '  type coverShortfallWithExpenseCut,')],
    [composition.controller, current.replace('  PROTECTION_CATALOG,\n', '')],
    [composition.controller, current.replace('<MoneyStoryStatusSidebar game={game} bars={bars} />', '<div />')],
    [composition.owner, owner.replace('  return (\n        <aside', '  game.cash = 0;\n  return (\n        <aside')],
    [composition.owner, owner + '\nglobalThis.phase2Mutation = true;\n'],
    [composition.owner, owner.replace('{ game, bars }: MoneyStoryStatusSidebarProps', '{ game: other, bars }: MoneyStoryStatusSidebarProps')],
    [composition.owner, owner.replace('Math.max(0, game.cash)', 'Math.max(1, game.cash)')],
  ]) {
    assert.notEqual(source, file === composition.controller ? current : owner);
    assert.throws(() => assertPhase2MoneyComposition(composition.controller, baseline, tamper(file, source)), file);
    // Hash refresh alone cannot admit semantic drift in the current implementation.
    assert.throws(() => assertPhase2MoneyComposition(composition.controller, baseline, tamper(file, source, true)), file);
  }
  assert.throws(() => assertPhase2MoneyComposition(composition.controller, baseline,
    tamper(composition.test, read(composition.test).replace('assert.deepEqual', 'console.log'))));
});


test('actual Next Web compiler context preserves the approved UAT CSS output and payload budget', async () => {
  assert.equal(proof.nativeWeb.context, 'apps/web');
  assert.equal(proof.nativeWeb.foundationSha256, sha(proof.foundationSource));
  const original = gunzipSync(Buffer.from(proof.nativeWeb.compiledCssGzip, 'base64')).toString();
  assert.equal(sha(original), '5d3644d435f89cebd06953aa611dc271ffbc616078d7b2b7aa15c7a11a31409c');
  const candidate = await postcss([tailwind({ base: resolve('apps/web'), optimize: false })]).process(source, { from: resolve(file) });
  // This matches the app build driver's cwd. Root standalone sizes cannot certify it.
  assert.equal(candidate.css, original, 'All rules, selectors, at-rules, declarations and order stay exact in the native app context');
  assert.equal(Buffer.byteLength(candidate.css), proof.nativeWeb.compiledBytes);
});
