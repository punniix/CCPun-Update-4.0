import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { loadFixtureModule } from '../qa/phase1-fixture-loader.mjs';
import { productionCmsOwners, assertProductionCmsOwner, productionCmsDisplaySource, cmsSha } from '../qa/production-cms-source-proof.mjs';
const read=file=>readFileSync(file,'utf8');

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
