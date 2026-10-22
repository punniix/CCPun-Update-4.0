import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import test from 'node:test';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import ts from 'typescript';
import { assertPhase2MoneyComposition, assertReviewedUxOwners } from '../qa/phase2-source-proof.mjs';
import { publicReachableSources, runtimeFiles, sourceByFile } from '../scripts/lib/public-reachability.mjs';

const read = file => readFileSync(file, 'utf8');
const sha = source => createHash('sha256').update(source).digest('hex');
const proof = JSON.parse(read('qa/phase2-css-delivery-parity.json'));
const file = 'components/styles/global-foundation.css';
const source = read(file);
const baselineCss = gunzipSync(Buffer.from(proof.compiledCssGzip, 'base64')).toString();
// Captured from actual f703 using the lockfile's Tailwind 4.2.1 compiler before edits.
assert.equal(sha(proof.foundationSource), '16be3e70110eb57339671d20a877cb7a1f8026675ce0eecca47794d6efeafece');
assert.equal(sha(baselineCss), 'a40fdcb573796224ace6b570721e44f5e38508f7b793ca192f307e8fd155a1bd');
assert.equal(sha(JSON.stringify(proof.protected)), '8fef8bb0a931e2c28fe4b85d5514c91379de35fd98fad340e443f2dab35f3de1');
const reviewedUiOwners = [
  "components/layout/website-43/Website43.module.css",
  "components/layout/website-43/Website43ResponsiveStyles.tsx",
  "components/layout/website-43/Website43Navbar.module.css",
  "components/layout/website-43/Website43Navbar.tsx",
  "components/layout/website-43/Website43Shared.tsx",
  "features/money-story/MoneyStory.module.css",
  "apps/web/app/layout.tsx"
];
const addedSelectors = {
  "root": [
    ".top-24",
    ".z-10",
    ".basis-40",
    ".text-\\[\\#ffb4b4\\]",
    ".lg\\:col-span-2"
  ],
  "web": [
    ".top-24",
    ".z-10",
    ".basis-40",
    ".text-\\[\\#ffb4b4\\]",
    ".lg\\:col-span-2"
  ]
};
const removedSelectors = {
  "root": [
    ".collapse",
    ".invisible",
    ".h-25",
    ".h-30",
    ".h-35",
    ".h-50",
    ".h-82",
    ".h-85",
    ".min-w-10",
    ".shrink",
    ".resize",
    ".lowercase",
    ".shadow\\/backdrop",
    ".duration-\\[240ms\\]",
    ".ease-\\[cubic-bezier\\(\\.2\\,0\\,0\\,1\\)\\]"
  ],
  "web": [
    ".min-w-10",
    ".outline",
    ".duration-\\[240ms\\]",
    ".ease-\\[cubic-bezier\\(\\.2\\,0\\,0\\,1\\)\\]"
  ]
};

// The reviewed UAT article renderer now contains the native <details> comment
// "collapse", a local `contents` variable, and static scenario copy. Tailwind's
// text scanner treats those non-class tokens as utilities. Admit only these exact
// compiler blocks: stripping them must reproduce the OLD reviewed bytes exactly.
// This neither changes the frozen captures nor admits any authored CSS change.
const uatScannerBlocks = {
  root: ['  .collapse {\n    visibility: collapse;\n  }\n'],
  web: [
    '  .collapse {\n    visibility: collapse;\n  }\n',
    '  .static {\n    position: static;\n  }\n',
    '  .contents {\n    display: contents;\n  }\n',
  ],
};
function assertUatScannerDelta(context, actual, captured) {
  let retained = actual;
  for (const block of uatScannerBlocks[context]) {
    assert.equal(retained.split(block).length - 1, 1, 'Exact reviewed scanner block occurs once');
    retained = retained.replace(block, '');
  }
  assert.equal(retained, captured, 'Every other compiled byte remains the frozen reviewed output');
  // Also pin the AST position/order, so moving an admitted block is rejected.
  const original = rules(captured);
  const added = uatScannerBlocks[context].map(block => rules(`@layer utilities {\n${block}}`)[0]);
  const expected = original.slice();
  for (const rule of added) {
    const next = { '.collapse': '.visible', '.static': '.sticky', '.contents': '.flex' }[rule.selector];
    const index = expected.findIndex(candidate => candidate.selector === next);
    assert(index >= 0);
    expected.splice(index, 0, rule);
  }
  assert.deepEqual(rules(actual), expected, 'Only exact scanner rules at their compiler positions are admitted');
  return retained;
}

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

test('original CSS owner manifest stays protected while exact reviewed UI owners are admitted', () => {
  assertReviewedUxOwners(proof, reviewedUiOwners);
  for (const [path, expected] of Object.entries(proof.protected)) {
    if (!Object.hasOwn(proof.reviewedUxOwners,path)) assert.equal(sha(read(path)),expected,path);
  }
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

function atRules(css) {
  const result=[];postcss.parse(css).walkAtRules(node=>result.push({name:node.name,params:node.params,ancestry:ancestry(node),declarations:declarations(node)}));return result;
}
const defaults = rule => rule.selector==='*, ::before, ::after, ::backdrop' && JSON.stringify(rule.ancestry)===JSON.stringify([['atrule','layer','properties'],['atrule','supports','((-webkit-hyphens: none) and (not (margin-trim: inline))) or ((-moz-orient: inline) and (not (color:rgb(from red r g b))))']]);
function retainedRecords(context, before, after, admission) {
  assert.deepEqual(admission.addedRules.map(rule=>rule.selector), addedSelectors[context], 'Exact added utility allowlist');
  assert.deepEqual(admission.removedRules.map(rule=>rule.selector), removedSelectors[context], 'Exact removed utility allowlist');
  const added = new Map(admission.addedRules.map(rule=>[rule.selector,rule]));
  const removed = new Map(admission.removedRules.map(rule=>[rule.selector,rule]));
  for(const [selector,rule]of added)assert.deepEqual(after.find(x=>x.selector===selector),rule,'Reviewed added rule unchanged');
  for(const [selector,rule]of removed)assert.deepEqual(before.find(x=>x.selector===selector),rule,'Original removed rule unchanged');
  let old=before.filter(rule=>!removed.has(rule.selector));
  let current=after.filter(rule=>!added.has(rule.selector));
  if(context==='web') {
    const original=old.filter(defaults),candidate=current.filter(defaults);assert.equal(original.length,1);assert.equal(candidate.length,1);
    assert.equal(original[0].declarations.length,68);assert.equal(candidate[0].declarations.length,67);
    const outline=entry=>entry[0]==='--tw-outline-style';
    const ease=entry=>entry[0]==='--tw-ease';
    assert.equal(original[0].declarations.filter(ease).length,1);assert.equal(candidate[0].declarations.filter(ease).length,0);
    assert.deepEqual(candidate[0].declarations.find(outline),original[0].declarations.find(outline));
    assert.equal(candidate[0].declarations.findIndex(outline),66);
    assert.deepEqual(candidate[0].declarations.filter(x=>!outline(x)),original[0].declarations.filter(x=>!outline(x)&&!ease(x)),'Remaining66 defaults retain values AND order');
    old=old.filter(rule=>!defaults(rule));current=current.filter(rule=>!defaults(rule));
  } else {
    assert.equal(before.filter(defaults)[0].declarations.length,68);
    assert.deepEqual(after.filter(defaults),before.filter(defaults),'Root68 initialization registry stays byte-ordered exact');
  }
  assert.deepEqual(current,old,'Every retained authored/runtime rule, ancestry and declaration order remains original');
}
function retainedAtRules(context, before, after) {
  const addedMedia={name:'media',params:'(width >= 64rem)',ancestry:[['atrule','layer','utilities'],['rule','.lg\\:col-span-2',null]],declarations:[['grid-column','span 2 / span 2',false]]};
  assert.equal(after.filter(node=>JSON.stringify(node)===JSON.stringify(addedMedia)).length,1);
  let current=after.filter(node=>JSON.stringify(node)!==JSON.stringify(addedMedia));let old=before;
  const property=node=>node.name==='property'&&node.ancestry.length===0;
  const originalRegistry=old.filter(property),registry=current.filter(property);
  assert.equal(originalRegistry.length,68);assert.equal(registry.length,context==='root'?68:67);
  assert.equal(new Set(registry.map(node=>node.params)).size,registry.length);
  if(context==='web') {
    const ease=node=>property(node)&&node.params==='--tw-ease';const outline=node=>property(node)&&node.params==='--tw-outline-style';
    assert.equal(originalRegistry.filter(ease).length,1);assert.equal(registry.filter(ease).length,0);
    assert.equal(registry.findIndex(outline),66);
    assert.deepEqual(registry.find(outline),originalRegistry.find(outline));
    assert.deepEqual(registry.filter(node=>!outline(node)),originalRegistry.filter(node=>!outline(node)&&!ease(node)),'Other66 nativeWeb registrations retain fullvalues/order');
    const positions=current.flatMap((node,index)=>property(node)?[index]:[]);
    assert(positions.every((value,index)=>value===positions[0]+index),'Property registrations retain contiguous tail');
    const outlined=current.find(outline);current=current.filter(node=>!outline(node));old=old.filter(node=>!outline(node)&&!ease(node));
    assert(outlined);
  } else assert.deepEqual(registry,originalRegistry,'All68 originalRoot registrations retain values/order');
  assert.deepEqual(current,old,'Retained at-rule declarations/ancestry/order stay original');
}
test('actual Root and Web compilers preserve original authored rules with exact reviewed utilities only',async()=>{
  const runtimeLiteralTokens=new Set();for(const path of runtimeFiles){const tree=ts.createSourceFile(path,sourceByFile.get(path),ts.ScriptTarget.Latest,true);const visit=node=>{if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)||ts.isTemplateHead(node)||ts.isTemplateMiddle(node)||ts.isTemplateTail(node))for(const token of node.text.split(/\s+/))runtimeLiteralTokens.add(token);ts.forEachChild(node,visit);};visit(tree);}
  for(const [context,options,original]of [['root',{optimize:false},baselineCss],['web',{base:resolve('apps/web'),optimize:false},gunzipSync(Buffer.from(proof.nativeWeb.compiledCssGzip,'base64')).toString()]]) {
    const admission=proof.reviewedCurrentCompiler[context];const captured=gunzipSync(Buffer.from(admission.compiledCssGzip,'base64')).toString();
    const expected= context==='root' ? '67638ca5fa86d3698aca48ee320f7e9eb3652b307d2b7bfc6febf82e4f5e3cb4' : '251ccb344a8056f190916ad06eb9a806b72affa352a3398cd72247842e6a23db';assert.equal(sha(captured),expected);assert.equal(admission.compiledSha256,expected);
    const compiled=await postcss([tailwind(options)]).process(source,{from:resolve(file)});
    const retained=assertUatScannerDelta(context,compiled.css,captured);
    assert.equal(Buffer.byteLength(retained),admission.compiledBytes);assert.equal(gzipSync(retained).length,admission.compiledGzipBytes);assert(Buffer.byteLength(compiled.css)<=(context==='root'?proof.compiledBytes:proof.nativeWeb.compiledBytes),'Reviewed UX stays within original CSS payload budget');
    retainedRecords(context,rules(original),rules(retained),admission);retainedAtRules(context,atRules(original),atRules(retained));
    for(const rule of admission.removedRules){assert.match(rule.selector,/^\.(?:[\w/-]|\\.)+$/);const utility=rule.selector.slice(1).replace(/\\(.)/g,'$1');assert(!runtimeLiteralTokens.has(utility),'Removed utility has actual runtime consumer: '+utility);}
    for(const message of compiled.messages.filter(message=>message.type==='dir-dependency'))assert(!['qa','tests','docs','scripts'].some(directory=>message.dir===resolve(directory)||message.dir.startsWith(resolve(directory)+'/')));
    const unknown=structuredClone(admission);unknown.addedRules.push({selector:'.unknown',ancestry:[],declarations:[]});assert.throws(()=>retainedRecords(context,rules(original),rules(retained),unknown));
    const changed=rules(retained);const target=changed.find(rule=>!addedSelectors[context].includes(rule.selector)&&!defaults(rule)&&rule.declarations.length);target.declarations[0][1]+=' mutation';assert.throws(()=>retainedRecords(context,rules(original),changed,admission));
    const mutated=atRules(retained);const index=mutated.findIndex(node=>node.name==='property');mutated[index].declarations[2][1]='unreviewed';assert.throws(()=>retainedAtRules(context,atRules(original),mutated));
    const reordered=atRules(retained);const positions=reordered.flatMap((node,index)=>node.name==='property'?[index]:[]);[reordered[positions[0]],reordered[positions[1]]]=[reordered[positions[1]],reordered[positions[0]]];assert.throws(()=>retainedAtRules(context,atRules(original),reordered));
    assert.throws(()=>assertUatScannerDelta(context,compiled.css.replace('visibility: collapse;', 'visibility: hidden;'),captured));
    assert.throws(()=>assertUatScannerDelta(context,compiled.css+uatScannerBlocks[context][0],captured));
    assert.throws(()=>assertUatScannerDelta(context,compiled.css+'\n.unreviewed { color: red; }',captured));
    assert.throws(()=>assertUatScannerDelta(context,compiled.css.replace(uatScannerBlocks[context][0],'')+uatScannerBlocks[context][0],captured));
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
    [composition.controller, current.replace('game.currentMonth > 1', 'game.currentMonth > 2')],
    [composition.controller, current.replace('text("moneyStory.returnToCharacterSelectionText")', 'text("moneyStory.gameplayHeading")')],
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


test('native Web compiler freezes reviewed current output while preserving original gzip and budget history', async () => {
  assert.equal(proof.nativeWeb.context, 'apps/web');
  assert.equal(proof.nativeWeb.foundationSha256, sha(proof.foundationSource));
  const original = gunzipSync(Buffer.from(proof.nativeWeb.compiledCssGzip, 'base64')).toString();
  assert.equal(sha(original), '8ef2b65a4b29c8b1e562fdcf16434a4104de01c537fdc5ddd5996506eaf5a22d');
  const candidate = await postcss([tailwind({ base: resolve('apps/web'), optimize: false })]).process(source, { from: resolve(file) });
  // This matches the app build driver's cwd. Root standalone sizes cannot certify it.
  const reviewed = gunzipSync(Buffer.from(proof.reviewedCurrentCompiler.web.compiledCssGzip, 'base64')).toString();
  const retained=assertUatScannerDelta('web',candidate.css,reviewed);
  assert.equal(Buffer.byteLength(retained), proof.reviewedCurrentCompiler.web.compiledBytes);
  assert(Buffer.byteLength(candidate.css)<=proof.nativeWeb.compiledBytes, 'Actual Web output remains within the original payload budget');
  assert.equal(sha(original), '8ef2b65a4b29c8b1e562fdcf16434a4104de01c537fdc5ddd5996506eaf5a22d');
});

// Tailwind caches scanner candidates by source identity in-process. Each variant
// must compile in a separate process or removed Admin candidates can appear to
// remain present, making a size/coverage comparison misleading.
function compileNativeWebInIsolation(input) {
  const program = `import {readFileSync} from 'node:fs';
    import {resolve} from 'node:path'; import postcss from 'postcss';
    import tailwind from '@tailwindcss/postcss';
    const result=await postcss([tailwind({base:resolve('apps/web'),optimize:false})])
      .process(readFileSync(0,'utf8'),{from:resolve('apps/web/app/globals.css')});
    process.stdout.write(result.css);`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', program], {
    input, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test('native Web excludes only unreachable Admin utility candidates while keeping public CSS and Admin ownership intact', () => {
  const path = 'apps/web/app/globals.css';
  const webSource = read(path);
  const exclusion = '@source not "../../../features/admin";';
  assert.equal(webSource.split(exclusion).length - 1, 1);
  assert.equal(resolve('apps/web/app', '../../../features/admin'), resolve('features/admin'));
  assert.deepEqual([...webSource.matchAll(/@(?:import|source)\s[^;]+;/g)].map(([directive]) => directive), [
    '@import "../../../components/styles/global-foundation.css";', exclusion,
  ], 'Only the Web wrapper owns this exact exclusion');
  assert.equal(read('apps/admin/app/globals.css'), '@import "../../../app/globals.css";\n');
  assert.equal(read('app/globals.css'), '@import "../components/styles/global-foundation.css";\n');
  assert(!source.includes('features/admin'), 'Shared Root/Admin foundation must retain Admin scanning');
  assert.deepEqual(publicReachableSources.filter(([file]) => file.startsWith('features/admin/')), [], 'No public route may depend on excluded private UI');

  const original = compileNativeWebInIsolation(webSource.replace(exclusion, ''));
  const candidate = compileNativeWebInIsolation(webSource);
  const before = rules(original), after = rules(candidate);
  const identity = ({ selector, ancestry }) => JSON.stringify([selector, ancestry]);
  const generatedDefaults = rule => defaults(rule) || (rule.selector === ':root, :host' && JSON.stringify(rule.ancestry) === JSON.stringify([['atrule', 'layer', 'theme']]));
  const retained = new Set(after.filter(rule => !generatedDefaults(rule)).map(identity));
  assert.deepEqual(after.filter(rule => !generatedDefaults(rule)), before.filter(rule => !generatedDefaults(rule) && retained.has(identity(rule))), 'Every retained public rule keeps its declaration values, ancestry and order');
  const oldDefaults = before.filter(generatedDefaults), newDefaults = after.filter(generatedDefaults);
  assert.equal(oldDefaults.length, 2); assert.equal(newDefaults.length, 2);
  for (let index = 0; index < oldDefaults.length; index++) {
    assert.equal(identity(newDefaults[index]), identity(oldDefaults[index]));
    const properties = new Set(newDefaults[index].declarations.map(([property]) => property));
    assert.deepEqual(newDefaults[index].declarations, oldDefaults[index].declarations.filter(([property]) => properties.has(property)), 'Remaining generated theme/initialization properties keep values and relative order');
    for (const [property] of oldDefaults[index].declarations.filter(([property]) => !properties.has(property))) {
      assert(!candidate.includes(`var(${property})`) && !candidate.includes(`var(${property},`), 'Removed generated property remains referenced: ' + property);
    }
  }
  const atIdentity = ({ name, params, ancestry }) => JSON.stringify([name, params, ancestry]);
  const afterAt = atRules(candidate), retainedAt = new Set(afterAt.map(atIdentity));
  assert.deepEqual(afterAt, atRules(original).filter(node => retainedAt.has(atIdentity(node))), 'Retained layers, media queries, keyframes and property registrations stay exact');

  const publicTokens = new Set();
  for (const [file, source] of publicReachableSources) {
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const visit = node => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
        for (const token of node.text.split(/\s+/)) publicTokens.add(token);
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  const removed = before.filter(rule => !generatedDefaults(rule) && !retained.has(identity(rule)));
  assert(removed.length > 0, 'The exact private UI exclusion must remove actual utility output');
  for (const rule of removed) {
    if (!/^\.(?:[\w/-]|\\.)+$/.test(rule.selector)) continue;
    const utility = rule.selector.slice(1).replace(/\\(.)/g, '$1');
    assert(!publicTokens.has(utility), 'Removed utility has a public runtime consumer: ' + utility);
  }
  assert(Buffer.byteLength(candidate) < Buffer.byteLength(original));
  assert(gzipSync(candidate).length < gzipSync(original).length);
  // A newly authored public utility must remain discoverable through the actual
  // Web wrapper; the exclusion may not turn into a hard-coded class safelist.
  assert.match(compileNativeWebInIsolation(webSource + '\n@source inline("w-[137px]");\n'), /width: 137px/);
  assert.doesNotMatch(candidate, /width: 137px/);
});
