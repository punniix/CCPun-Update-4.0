import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const ts = require('typescript');
import { assertPhase2FoundationSource, phase2FoundationPath } from '../qa/phase2-css-source-contract.mjs';
import { reachable, runtimeFiles, sourceByFile, trackedFiles } from '../scripts/lib/public-reachability.mjs';

const read = file => readFileSync(file, 'utf8');
const sha = source => createHash('sha256').update(source).digest('hex');
const proof = JSON.parse(read('qa/phase2-css-delivery-parity.json'));
const file = 'components/styles/global-foundation.css';
const source = read(file);
const baselineCss = gunzipSync(Buffer.from(proof.compiledCssGzip, 'base64')).toString();
// Captured from this own Admin candidate before stylesheet edits, using lockfile Tailwind 4.2.1.
assert.equal(sha(proof.foundationSource), '16be3e70110eb57339671d20a877cb7a1f8026675ce0eecca47794d6efeafece');
assert.equal(sha(baselineCss), '0c0f9b9b980810e3d9b9ade1b99b8a9ad5c4eb4d6e7d7cff8d847c6636f119b0');

test('Tailwind inputs cover every current app dependency and exclude historical fixtures', () => {
  assert.equal(assertPhase2FoundationSource(phase2FoundationPath, proof.foundationSha256), true);
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

function runtimeCandidates(sources) {
  const literals = new Set(), prefixes = new Set();
  for (const [path, source] of sources) {
    const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    const visit = node => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
        || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
        for (const token of node.text.split(/\s+/)) {
          literals.add(token);
          if (/^[\w!:./-]+-$/.test(token)) prefixes.add(token);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  return { literals, prefixes };
}
function assertNoRuntimeConsumer(utility, candidates) {
  assert(!candidates.literals.has(utility), 'Removed utility has an actual runtime literal: ' + utility);
  assert(![...candidates.prefixes].some(prefix => utility.startsWith(prefix)), 'Removed utility has a possible dynamic class prefix: ' + utility);
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
  const candidates = runtimeCandidates(runtimeFiles.map(path => [path, sourceByFile.get(path)]));
  for (const rule of removed) {
    assert(/^\.[\w\\/-]+$/.test(rule.selector) || ['.md\\:px-8', '.md\\:py-4'].includes(rule.selector), 'Review any non-utility removal separately');
    const utility = rule.selector.slice(1).replace(/\\(.)/g, '$1');
    assertNoRuntimeConsumer(utility, candidates);
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

test('escaped responsive utility allowance still rejects actual literal and dynamic-prefix consumers', () => {
  for (const utility of ['md:px-8', 'md:py-4']) {
    assert.doesNotThrow(() => assertNoRuntimeConsumer(utility, runtimeCandidates(new Map([['fixture.tsx', 'const label = "synthetic-only";']]))));
    assert.throws(() => assertNoRuntimeConsumer(utility, runtimeCandidates(new Map([['fixture.tsx', 'const className = "' + utility + '";']]))));
    assert.throws(() => assertNoRuntimeConsumer(utility, runtimeCandidates(new Map([['fixture.tsx', 'const className = "' + utility.slice(0, -1) + '" + size;']]))));
  }
});


test('foundation admission rejects declaration/import/registry drift, wrong baseline and unlisted paths', () => {
  const expected = proof.foundationSha256;
  assert.throws(() => assertPhase2FoundationSource('unknown.css', expected));
  assert.throws(() => assertPhase2FoundationSource(file, '0'.repeat(64)));
  const wrong = structuredClone(proof); wrong.baseline = 'a'.repeat(40);
  assert.throws(() => assertPhase2FoundationSource(file, expected, { proof: wrong }));
  for (const candidate of [source + '\nbody { color: red; }\n', source.replace('@source "../../apps";\n', ''), source.replace('@import "./public-compat.css";', '@import "./public-motion.css";')]) {
    assert.notEqual(candidate, source);
    assert.throws(() => assertPhase2FoundationSource(file, expected, { read: path => path === file ? candidate : read(path) }));
  }
});
