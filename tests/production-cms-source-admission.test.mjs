import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';
import { productionCmsOwners, assertProductionCmsOwner, ciPlanningConcurrentReadPredecessor, productionCmsDisplaySource, cmsSha, v5ProductionSourceSuccessors, v5ProductionSourcePredecessor } from '../qa/production-cms-source-proof.mjs';
const read=file=>readFileSync(file,'utf8');

test('reviewed CI route concurrency preserves frozen CMS/SEO identity and rejects unapproved alterations', () => {
  const file = 'apps/web/app/ci-planning/page.tsx';
  const source = read(file);
  assert.equal(cmsSha(source), 'b99435df268ddda1a88081454e33c50997241e2729f5e3bf3b88b6db181d78e6');
  const predecessor = ciPlanningConcurrentReadPredecessor(source);
  assert.equal(cmsSha(predecessor), '6bdc2925143bda8a2d2d687e69312faa737e2b25618bce6e67f7a4bd28a7462a');
  assertProductionCmsOwner(file, source);
  for (const [from, to] of [
    ['getPublicCopy("blog")', 'getPublicCopy("site")'],
    ['getPublishedArticles()', 'Promise.resolve([])'],
    ['getShellTopics()', 'Promise.resolve([])'],
    ['Promise.allSettled([', 'Promise.all(['],
    ['getPublicCopy("ci")', 'getPublicCopy("home")'],
    ['return <PublicCopyProvider values={copy}>', 'return <PublicCopyProvider values={{}}>'],
  ]) {
    const mutant = source.replace(from, to);
    assert.notEqual(mutant, source);
    assert.throws(() => assertProductionCmsOwner(file, mutant), 'unreviewed reader or SEO/UI alteration must fail');
  }
  assert.throws(() => assertProductionCmsOwner(file, predecessor), 'old route cannot silently replace approved successor');
});

test('CI route starts all independent CMS reads before CI copy resolves, with unchanged provider and SEO', async () => {
  let resolveCi;
  const waitForCi = new Promise(resolve => { resolveCi = resolve; });
  const calls = [];
  const ciValues = { 'ci.example': 'validated value' };
  const mocks = new Map([
    ['@/features/ci-planning/page', { __esModule: true, default: () => null, metadata: { title: 'Same CI title' } }],
    ['@/lib/seo/page-seo', { resolvePageSeoMetadata: () => ({ title: 'Same CI title' }) }],
    ['@/lib/content/public-copy', {
      getPublicCopy: scope => {
        calls.push('copy:' + scope);
        return scope === 'ci' ? waitForCi : Promise.resolve({});
      },
    }],
    ['@/components/layout/v5/shell-data', {
      getPublishedArticles: () => { calls.push('articles'); return Promise.resolve([]); },
      getShellTopics: () => { calls.push('topics'); return Promise.resolve([]); },
    }],
    ['@/components/ui/PublicCopyProvider', { PublicCopyProvider: ({ children }) => children }],
  ]);
  const { default: Page, generateMetadata } = loadFixtureModule('apps/web/app/ci-planning/page.tsx', { mocks });
  const rendering = Page();
  assert.deepEqual(calls, ['copy:ci', 'copy:blog', 'articles', 'topics'], 'parallel requests start without awaiting CI copy');
  resolveCi(ciValues);
  const result = await rendering;
  assert.deepEqual(result.props.values, ciValues, 'original validated CI provider values retained');
  assert.deepEqual(generateMetadata(undefined, null), { title: 'Same CI title' }, 'original SEO delegation retained');
});

test('same-word CMS admission rejects every unknown or modified source, including attempted pin reseal elsewhere',()=>{
  assert.equal(Object.keys(productionCmsOwners).length,74);
  for(const[file,pins]of Object.entries(productionCmsOwners)) {
    assert.match(pins.after,/^[a-f0-9]{64}$/);
    if(pins.before!==null) assert.match(pins.before,/^[a-f0-9]{64}$/);
    const source=read(file); assertProductionCmsOwner(file,source);
    assert.throws(()=>assertProductionCmsOwner(file,source+'\n// unreviewed source drift\n'));
  }
  assert.throws(()=>assertProductionCmsOwner('features/investment-allocation/page.tsx',''));
  for(const[file,before,after]of [
    ['features/ci-planning/calculator/schemas.ts','.min(0,','.min(-1,'],
    ['features/money-story/components/MoneyStoryGame.tsx','game.currentMonth === 12','game.currentMonth === 11'],
    ['features/money-story/components/MoneyStoryStatusSidebar.tsx','Math.abs(value * 100)','Math.abs(value * 99)'],
    ['features/analytics/components/CookieConsent.tsx','saveConsent(','void ('],
    ['features/blog/website-43/Website43Article.tsx',"article.status === 'published'","article.status !== 'published'"],
  ]) {const current=read(file),mutant=current.replace(before,after);assert.notEqual(mutant,current);assert.throws(()=>assertProductionCmsOwner(file,mutant));}
});

test('published-only reader hardening retains the frozen predecessor proof and denies draft restoration or unrelated drift',()=>{
  const file='lib/content/public-copy.ts',source=read(file);
  assert.equal(productionCmsOwners[file].after,'fe2f34b82b8e02b87b6d71502d089951d14e8bd1789a458a4d4c0bbfa3b77d9c');
  assert.ok(!source.includes('draftMode'));assert.ok(!source.includes('IS_DRAFT_PREVIEW_ALLOWED'));
  assertProductionCmsOwner(file,source);
  let predecessor=source;
  // The newly approved scope gate is independently exact; preserve every older reader inverse below.
  for (const [current, old] of [
    ['import { resolveContentEnvironment } from "./sanity-lane";\n', ''],
    ['PUBLIC_COPY_SCOPES, isPublicCopyScopeAvailable, parsePublicCopy', 'PUBLIC_COPY_SCOPES, parsePublicCopy'],
    ['  // New page-copy scopes are reviewed in UAT only. Never request them from Production.\n  const environment = resolveContentEnvironment();\n  const dataset = ["development", "web-uat", "local-uat", "admin-uat"].includes(environment) ? "uat" : "production";\n  if (!isPublicCopyScopeAvailable(scope, dataset)) return {};\n', ''],
  ]) { assert.equal(predecessor.split(current).length, 2); predecessor = predecessor.replace(current, old); }
  for(const[current,old]of [
    // Sized copy (size fields and value encoding) is the newest reviewed reader step.
    [
      "entries[]{_key, key, text, size, sizeMobile, sizeDesktop}}'",
      "entries[]{_key, key, text}}'"
    ],
    [
      "    const values = parsePublicCopy(scope, data) as Record<string, string>;\n    // Defaults already ship with each renderer; send only validated CMS edits\n    // (changed wording or a chosen size) to clients.\n    const defaults = PUBLIC_COPY_SCOPES[scope].defaults as Record<string, string>;\n    return data ? Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== defaults[key])) as PublicCopyValues : {};",
      "    parsePublicCopy(scope, data);\n    // Defaults already ship with each renderer; send only validated CMS edits to clients.\n    return data ? Object.fromEntries(data.entries.filter(({ key, text }: { key: string; text: string }) => text !== (PUBLIC_COPY_SCOPES[scope].defaults as Record<string, string>)[key]).map(({ key, text }: { key: string; text: string }) => [key, text])) as PublicCopyValues : {};"
    ],
    [
      'import { PUBLIC_COPY_SCOPES, parsePublicCopy, publicCopyDocumentId, type PublicCopyScope, type PublicCopyValues } from "./public-copy-registry";',
      'import { parsePublicCopy, publicCopyDocumentId, type PublicCopyScope, type PublicCopyValues } from "./public-copy-registry";'
    ],
    [
      '.filter(({ key, text }: { key: string; text: string }) => text !== (PUBLIC_COPY_SCOPES[scope].defaults as Record<string, string>)[key])',
      ''
    ],
    [
        "import { sanityFetch } from \"./sanity-fetch\";",
        "import { draftMode } from \"next/headers\";\nimport { sanityFetch } from \"./sanity-fetch\";\nimport { IS_DRAFT_PREVIEW_ALLOWED } from \"../deployment-environment\";"
    ],
    [
        "export const getPublicCopy = cache(async (scope: PublicCopyScope) => {\n  try {",
        "export const getPublicCopy = cache(async (scope: PublicCopyScope) => {\n  const preview = IS_DRAFT_PREVIEW_ALLOWED && (await draftMode()).isEnabled;\n  try {"
    ],
    [
        "perspective: \"published\",",
        "perspective: preview ? \"drafts\" : \"published\","
    ]
]) {
    assert.equal(predecessor.split(current).length,2);predecessor=predecessor.replace(current,old);
  }
  assert.equal(cmsSha(predecessor),productionCmsOwners[file].after,'original reviewed full reader identity remains frozen');
  assert.throws(()=>assertProductionCmsOwner(file,predecessor),'the original cookie-dependent draft reader is no longer eligible');
  for(const mutant of [
    source.replace('perspective: "published",','perspective: "drafts",'),
    source.replace('params: { id: publicCopyDocumentId(scope) }','params: { id: "private.document" }'),
    source.replace('return {};','return null;'),
    source+'\n// unrelated reader drift\n',
  ]) {assert.notEqual(mutant,source);assert.throws(()=>assertProductionCmsOwner(file,mutant));}
});

function schemaStructure(source) {
  const admitted = [
    ["const VALIDATION_COPY_KEYS = Object.fromEntries(\n  Object.entries(CI_COPY_DEFAULTS).filter(([key]) => key.startsWith('ci.validation.')).map(([key, message]) => [message, key]),\n) as Record<string, keyof typeof CI_COPY_DEFAULTS>;\n\n", ''],
    ["  data: Record<string, unknown>,\n  text?: (key: keyof typeof CI_COPY_DEFAULTS) => string,", '  data: Record<string, unknown>'],
    ["      const copyKey = VALIDATION_COPY_KEYS[issue.message];\n      errors[path] = copyKey && text ? text(copyKey) : issue.message;", '      errors[path] = issue.message;'],
  ];
  for(const[current,original]of admitted) {assert.equal(source.split(current).length,2,'only exact reviewed validation-message adapter');source=source.replace(current,original);}
  const tree=ts.createSourceFile('schemas.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  const defaults=loadFixtureModule('lib/content/tool-copy-defaults.ts').CI_COPY_DEFAULTS;
  function walk(node) {
    if(ts.isImportDeclaration(node)&&node.moduleSpecifier.text==='@/lib/content/tool-copy-defaults') {
      assert.equal(node.getText(tree),"import { CI_COPY_DEFAULTS } from '@/lib/content/tool-copy-defaults';"); return null;
    }
    if(ts.isElementAccessExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='CI_COPY_DEFAULTS') {
      assert.ok(ts.isStringLiteral(node.argumentExpression)); const key=node.argumentExpression.text;
      assert.ok(key.startsWith('ci.validation.')&&Object.hasOwn(defaults,key));
      return [ts.SyntaxKind.StringLiteral,defaults[key],[]];
    }
    const children=[];ts.forEachChild(node,child=>{const value=walk(child);if(value!==null)children.push(value)});
    return [node.kind,!ts.isSourceFile(node)&&typeof node.text==='string'?node.text:null,children];
  }
  return cmsSha(JSON.stringify(walk(tree)));
}
test('CI schema and validation flow retain original full AST after exact message mapper admission',()=>{
  const source=read('features/ci-planning/calculator/schemas.ts');
  const before='c167dacc60c853e8d02e3af3e61a1d110d44c78eb6a6947085884f26dd83bc82';
  assert.equal(schemaStructure(source),before);
  assert.notEqual(schemaStructure(source.replace('.min(0,','.min(-1,')),before);
  assert.notEqual(schemaStructure(source.replace('ci.validation.nonNegativeAmount.finite','ci.validation.nonNegativeAmount.min')),before);
});

test('literal-source projection follows only known plain defaults while retaining attributes, expression and ordering',()=>{
  const path='features/ci-planning/components/steps/StepExpenses.tsx';
  const projected=productionCmsDisplaySource(path);
  assert.match(projected,/ทุนตามรายได้ก่อน Recovery<\/dt><dd[^>]*>\{planPreview\.incomeBaseNeed > 0 \? baht\(planPreview\.incomeBaseNeed\)/);
  assert.throws(()=>productionCmsDisplaySource(path,read(path).replace('planPreview.incomeBaseNeed > 0','planPreview.incomeBaseNeed > 1')));
});

test('validation text callback preserves original messages, first issue, unknown-step and unknown-message fallback',()=>{
  const {validateCIStep}=loadFixtureModule('features/ci-planning/calculator/schemas.ts');
  const initial=loadFixtureModule('features/ci-planning/calculator/constants.ts').INITIAL_CI_FORM_DATA;
  const invalid={...initial.expenses,monthlyIncome:-1};
  assert.equal(validateCIStep(0,invalid).monthlyIncome,'จำนวนเงินต้องไม่ติดลบ');
  const changed=validateCIStep(0,invalid,key=>'owner:'+key);
  assert.equal(changed.monthlyIncome,'owner:ci.validation.nonNegativeAmount.min');
  assert.deepEqual(validateCIStep(99,{},()=>assert.fail('unknown step has no message lookup')),{});
  const issues=[{path:['monthlyIncome'],message:'จำนวนเงินต้องไม่ติดลบ'},{path:['monthlyIncome'],message:'unknown secondary issue'},{path:['nested','field'],message:'unknown system message'}];
  const z=new Proxy(function(){},{get:(_target,key)=>key==='safeParse'?()=>({success:false,error:{issues}}):z,apply:()=>z});
  const fixture=loadFixtureModule('features/ci-planning/calculator/schemas.ts',{mocks:new Map([['zod',{z}]])}).validateCIStep;
  const seen=[];
  assert.deepEqual(fixture(0,{},key=>{seen.push(key);return 'owner message'}),{monthlyIncome:'owner message','nested.field':'unknown system message'});
  assert.deepEqual(seen,['ci.validation.nonNegativeAmount.min']);
  assert.deepEqual(fixture(0,{}),{monthlyIncome:'จำนวนเงินต้องไม่ติดลบ','nested.field':'unknown system message'});
  // Duplicate original error messages share one reverse-map alias; they are not independently editable.
  const defaults=loadFixtureModule('lib/content/tool-copy-defaults.ts').CI_COPY_DEFAULTS;
  assert.equal(defaults['ci.validation.educationPlanSchema.int'],'จำนวนปีต้องเป็นจำนวนเต็ม');
});

test('v5 exact successors reconstruct every complete prior owner and reject partial, extra or misowned bytes',()=>{
  assert.equal(Object.keys(v5ProductionSourceSuccessors).length,33);
  for(const [file,entry] of Object.entries(v5ProductionSourceSuccessors)){
    const current=read(file);
    assert.equal(cmsSha(v5ProductionSourcePredecessor(file,current)),entry.before);
    assertProductionCmsOwner(file,current);
    for(const mutant of [current.slice(0,-1),current+'\n// unreviewed'])assert.throws(()=>v5ProductionSourcePredecessor(file,mutant));
    assert.equal(v5ProductionSourcePredecessor('unknown-owner.ts',current),current);
    assert.throws(()=>assertProductionCmsOwner('unknown-owner.ts',current));
  }
});
