import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const ts = require('typescript');
import { assertPhase2FoundationSource, phase2FoundationPath, phase2RuntimeCssSources, phase2ExcludedCssSources } from '../qa/phase2-css-source-contract.mjs';
import { runtimeFiles, sourceByFile, trackedFiles } from '../scripts/lib/public-reachability.mjs';

const read = file => readFileSync(file, 'utf8');
const sha = source => createHash('sha256').update(source).digest('hex');
const proof = JSON.parse(read('qa/phase2-css-delivery-parity.json'));
const file = 'components/styles/global-foundation.css';
const source = read(file);
const baselineCss = gunzipSync(Buffer.from(proof.compiledCssGzip, 'base64')).toString();
// Captured from this own Admin candidate before stylesheet edits, using lockfile Tailwind 4.2.1.
assert.equal(sha(proof.foundationSource), '16be3e70110eb57339671d20a877cb7a1f8026675ce0eecca47794d6efeafece');
assert.equal(sha(baselineCss), 'da206b6086ac07799bcb3da29241743c115da43f31cf5f62342b0a3339cc8916');

test('Tailwind preserves native automatic scanning and shared roots, excluding historical fixtures', () => {
  assert.equal(assertPhase2FoundationSource(phase2FoundationPath, proof.foundationSha256), true);
  assert.match(source, /^@import "tailwindcss";/);
  const owners = [...source.matchAll(/@source "([^"\n]+)";/g)].map(([, owner]) => owner);
  assert.deepEqual(owners, phase2RuntimeCssSources);
  const excluded = [...source.matchAll(/@source not "([^"\n]+)";/g)].map(([, owner]) => owner);
  assert.deepEqual(excluded, phase2ExcludedCssSources);
  assert.deepEqual(Object.keys(proof.nativeContexts), ['apps/admin', 'apps/web']);
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
  for (const candidate of [source + '\nbody { color: red; }\n', source.replace('@source not "../../qa";\n', ''), source.replace('@import "./public-compat.css";', '@import "./public-motion.css";')]) {
    assert.notEqual(candidate, source);
    assert.throws(() => assertPhase2FoundationSource(file, expected, { read: path => path === file ? candidate : read(path) }));
  }
});

// Native Next invokes PostCSS from each app cwd. Fresh processes prevent scanner
// context caches from making cross-app input expansion appear equivalent.
const nativeCssAnchors = {
  "apps/admin": {
    "unminified": "11a4e79a810424439d562d4a3aa5278b28161f41a471efaefa2df6b910f22e62",
    "minified": "6dee118f827d2a56c58adadc377356cc5fc84b02f1d18a7698641118f7307a72"
  },
  "apps/web": {
    "unminified": "1d5148b98e3907895ebde725867007a583ff369a9ed72f3e4113301c39acd9bb",
    "minified": "eb539bd13e98d9c73a513dfbe84f53713d35d20f870145e0a15d3fb7386f6b5e"
  }
};
const nativeCompiler = "const fs=require('node:fs');const input=JSON.parse(fs.readFileSync(0,'utf8'));const p=require(input.postcss),tw=require(input.tailwind);(async()=>{const out=await p([tw({optimize:input.minify?{minify:true}:false})]).process(input.source,{from:input.from});process.stdout.write(out.css);})().catch(e=>{process.stderr.write(e.message);process.exitCode=1});";
function compileNative(sourceText, context, minify) {
  const result = spawnSync(process.execPath, ['-e', nativeCompiler], {
    cwd: resolve(context), encoding: 'utf8', maxBuffer: 2 * 1024 * 1024,
    input: JSON.stringify({ source: sourceText, from: resolve(file), minify,
      postcss: require.resolve('postcss'), tailwind: require.resolve('@tailwindcss/postcss') }),
  });
  assert.equal(result.status, 0, result.stderr || 'native CSS subprocess failed');
  return result.stdout;
}
test('fresh app-context CSS is exactly original in unminified and minified native pipelines', () => {
  for (const [context, modes] of Object.entries(proof.nativeContexts)) {
    const frozen = gunzipSync(Buffer.from(modes.unminified.cssGzip, 'base64')).toString();
    assert.equal(sha(frozen), nativeCssAnchors[context].unminified);
    for (const minify of [false, true]) {
      const mode = minify ? 'minified' : 'unminified';
      assert.equal(modes[mode].sha256, nativeCssAnchors[context][mode]);
      const original = compileNative(proof.foundationSource, context, minify);
      assert.equal(sha(original), modes[mode].sha256, context + ': own original baseline');
      assert.equal(Buffer.byteLength(original), modes[mode].bytes);
      const current = compileNative(source, context, minify);
      assert.equal(current, original, context + ': exact native CSS including rule/atRule order');
    }
  }
});
