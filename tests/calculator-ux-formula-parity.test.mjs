import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

// Immutable Production baseline inspected before this UX-only work began.
const base = 'f9a233daa31e3b91b7a22e87c3dcbd58a4fff718';
const before = (path) => execFileSync('git', ['show', `${base}:${path}`], { encoding: 'utf8' });
const after = (path) => readFileSync(path, 'utf8');
const ciPath = 'features/ci-planning/calculator/calculator.ts';
const fhcPath = 'features/financial-health-check/components/LifeCoverageWizard.tsx';
function ci(source) {
  const exports = {};
  new Function('exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(exports);
  return exports.calculateCI;
}
function fhc(source) {
  // Execute the actual in-component memo callback, not a duplicate test formula.
  const ast = ts.createSourceFile('wizard.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'result'
      && node.initializer && ts.isCallExpression(node.initializer)
      && node.initializer.expression.getText(ast) === 'useMemo') callback = node.initializer.arguments[0];
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(callback, 'the live LifeCoverageWizard calculation must be located');
  return new Function('values', `return (${callback.getText(ast)})();`);
}
const fixtures = [
  { name: 'normal', income: 50000, household: 30000, years: 5, debt: 200000, education: 60000, coverage: 500000, liquid: 100000 },
  { name: 'low-resource', income: 9000, household: 8000, years: 1, debt: 0, education: 0, coverage: 0, liquid: 0 },
  { name: 'high-income', income: 1000000, household: 300000, years: 10, debt: 5000000, education: 600000, coverage: 10000000, liquid: 2000000 },
  { name: 'debt-heavy', income: 35000, household: 20000, years: 5, debt: 9000000, education: 100000, coverage: 100000, liquid: 0 },
  { name: 'edge-valid-surplus', income: 1, household: 1, years: 10, debt: 0, education: 0, coverage: 1000000000000, liquid: 0 },
];
const oldCI = ci(before(ciPath)), newCI = ci(after(ciPath));
const oldFHC = fhc(before(fhcPath)), newFHC = fhc(after(fhcPath));
for (const f of fixtures) {
  test(`same input → same complete output: ${f.name}`, () => {
    const ciInput = { expenses: { monthlyIncome: f.income, household: f.household, reserveYears: f.years,
      educationPlans: f.education ? [{ annualCost: f.education, yearsRemaining: 3 }] : [],
      mortgagePayment: f.debt ? 15000 : 0, mortgageInstallmentsRemaining: f.debt ? 600 : 0,
      carPayment: 0, carInstallmentsRemaining: 0, otherDebtBalance: f.debt },
    existingCI: { lumpSum: f.coverage, liquidAssets: f.liquid } };
    const lifeInput = { householdMonthly: f.household, supportYears: f.years === 10 ? 20 : f.years,
      debt: f.debt, education: f.education, existingLifeCoverage: f.coverage, liquidAssets: f.liquid };
    assert.deepEqual(newCI(structuredClone(ciInput)), oldCI(structuredClone(ciInput)));
    assert.deepEqual(newFHC(structuredClone(lifeInput)), oldFHC(structuredClone(lifeInput)));
  });
}
test('calculator domain files, assumptions, validation and legacy scoring remain byte-identical', () => {
  const files = execFileSync('git', ['ls-tree', '-r', '--name-only', base,
    'features/ci-planning/calculator', 'features/financial-health-check/calculator'], { encoding: 'utf8' }).trim().split('\n');
  for (const file of files) assert.equal(after(file), before(file), file);
});
