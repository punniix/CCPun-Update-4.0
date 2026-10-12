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
import { reachable, runtimeFiles, sourceByFile, trackedFiles } from '../scripts/lib/public-reachability.mjs';

const read = file => readFileSync(file, 'utf8');
const sha = source => createHash('sha256').update(source).digest('hex');
const proof = JSON.parse(read('qa/phase2-css-delivery-parity.json'));
const file = 'components/styles/global-foundation.css';
const source = read(file);
const baselineCss = gunzipSync(Buffer.from(proof.compiledCssGzip, 'base64')).toString();
// Captured from actual f703 using the lockfile's Tailwind 4.2.1 compiler before edits.
assert.equal(sha(proof.foundationSource), '16be3e70110eb57339671d20a877cb7a1f8026675ce0eecca47794d6efeafece');
assert.equal(sha(baselineCss), 'a40fdcb573796224ace6b570721e44f5e38508f7b793ca192f307e8fd155a1bd');

test('Tailwind inputs cover every current app dependency and exclude historical fixtures', () => {
  assert.match(source, /^@import "tailwindcss" source\(none\);/);
  const owners = [...source.matchAll(/@source "([^"\n]+)";/g)].map(([, owner]) => resolve('components/styles', owner));
  for (const entry of reachable) assert(owners.some(owner => resolve(entry) === owner || resolve(entry).startsWith(owner + '/')), entry);
  for (const historical of ['qa', 'tests', 'scripts', 'docs']) {
    assert(!owners.some(owner => resolve(historical) === owner || resolve(historical).startsWith(owner + '/')), historical);
  }
  // Only scanner ownership changes; stylesheet imports and every declared style stay exact.
  const fromPublicImports = value => value.slice(value.indexOf('@import "./public-compat.css";'));
  assert.equal(fromPublicImports(source), fromPublicImports(proof.foundationSource));
});

test('all Website43, responsive, footer, first-paint and feature CSS remain byte-identical', () => {
  for (const [path, expected] of Object.entries(proof.protected)) assert.equal(sha(read(path)), expected, path);
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

test('the actual Tailwind compiler preserves runtime declarations and cascade order', async () => {
  const compiled = await postcss([tailwind({ optimize: false })]).process(source, { from: resolve(file) });
  const before = rules(baselineCss);
  const after = rules(compiled.css);
  // Theme variables can be removed only when excluded fixtures were their sole consumer.
  // Every remaining value and every normal/keyframe/media/support rule preserves order.
  const theme = rule => rule.selector === ':root, :host';
  subsequence(after.filter(rule => !theme(rule)), before.filter(rule => !theme(rule)), 'compiled CSS rule order');
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
  subsequence(atRules(compiled.css), atRules(baselineCss), 'compiled layer/media/support/keyframe/property order');

  assert.equal(JSON.stringify(newTheme.ancestry), JSON.stringify(oldTheme.ancestry));
  const currentKeys = new Set(after.map(rule => JSON.stringify(rule)));
  const removed = before.filter(rule => !theme(rule) && !currentKeys.has(JSON.stringify(rule)));
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
    assert(!/\/(?:qa|tests|docs|scripts)(?:\/|$)/.test(message.dir), message.dir);
  }
});


test('Money composition admission rejects changed logic, unreachable owners, mutated views and output fixtures', () => {
  const composition = proof.moneyComposition;
  const baseline = composition.baselineSha256;
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
    [composition.owner, owner.replace('Math.abs(value * 100)', 'Math.abs(value * 99)')],
  ]) {
    assert.notEqual(source, file === composition.controller ? current : owner);
    assert.throws(() => assertPhase2MoneyComposition(composition.controller, baseline, tamper(file, source)), file);
    // Hash refresh alone cannot admit semantic drift in the current implementation.
    assert.throws(() => assertPhase2MoneyComposition(composition.controller, baseline, tamper(file, source, true)), file);
  }
  assert.throws(() => assertPhase2MoneyComposition(composition.controller, baseline,
    tamper(composition.test, read(composition.test).replace('assert.deepEqual', 'console.log'))));
});
