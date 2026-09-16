import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

// Frozen Production baseline captured before the UX-only calculator work began.
// This fixture intentionally avoids `git show <historical-commit>` so the parity
// contract is reproducible in shallow/partial CI checkouts as well as full local clones.
const baseline = JSON.parse(readFileSync('tests/fixtures/calculator-production-baseline.json', 'utf8'));
const read = (path) => readFileSync(path, 'utf8');
const sha256 = (source) => createHash('sha256').update(source).digest('hex');
const ciPath = 'features/ci-planning/calculator/calculator.ts';
const fhcModelPath = 'features/financial-health-check/components/lifeCoverageModel.ts';
const fhcWizardPath = 'features/financial-health-check/components/LifeCoverageWizard.tsx';

function ci(source) {
  const exports = {};
  const localRequire = (id) => {
    if (id === '@/features/ci-planning/recovery-evidence') return {
      CI_RECOVERY_REFERENCE: {
        treatmentVisit: { total: 2578 }, caregiverHomePerDay: 141,
        rehabilitation: { perSession: 450, homeServiceAddOnPerSession: 200, benchmarkSessionLimit: 20 },
      },
    };
    throw new Error('Unexpected require: ' + id);
  };
  new Function(
    'exports', 'require',
    ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
  )(exports, localRequire);
  return exports.calculateCI;
}

function fhcModel(source) {
  const exports = {};
  new Function(
    'exports',
    ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
  )(exports);
  assert.equal(typeof exports.calculateLifeCoverage, 'function', 'the live FHC calculation owner must export calculateLifeCoverage');
  return exports.calculateLifeCoverage;
}

const fixtures = [
  { name: 'normal', income: 50000, household: 30000, years: 5, debt: 200000, education: 60000, coverage: 500000, liquid: 100000 },
  { name: 'minimal-valid', income: 1, household: 1, years: 1, debt: 0, education: 0, coverage: 0, liquid: 0 },
  { name: 'zero-resource', income: 50000, household: 30000, years: 5, debt: 0, education: 0, coverage: 0, liquid: 0 },
  { name: 'low-resource', income: 9000, household: 8000, years: 1, debt: 0, education: 0, coverage: 0, liquid: 0 },
  { name: 'high-income', income: 1000000, household: 300000, years: 10, debt: 5000000, education: 600000, coverage: 10000000, liquid: 2000000 },
  { name: 'debt-heavy', income: 35000, household: 20000, years: 5, debt: 9000000, education: 100000, coverage: 100000, liquid: 0 },
  { name: 'education-heavy', income: 80000, household: 45000, years: 8, debt: 500000, education: 4000000, coverage: 1000000, liquid: 250000 },
  { name: 'high-resource', income: 90000, household: 50000, years: 5, debt: 0, education: 0, coverage: 10000000, liquid: 5000000 },
  { name: 'edge-valid-surplus', income: 1, household: 1, years: 10, debt: 0, education: 0, coverage: 1000000000000, liquid: 0 },
  { name: 'boundary-period', income: 100000, household: 50000, years: 10, debt: 0, education: 0, coverage: 0, liquid: 0 },
];

const calculateCI = ci(read(ciPath));
const calculateLiveFHC = fhcModel(read(fhcModelPath));

for (const fixture of fixtures) {
  test(`matches frozen Production calculator output: ${fixture.name}`, () => {
    const ciInput = {
      expenses: {
        monthlyIncome: fixture.income,
        household: fixture.household,
        reserveYears: fixture.years,
        educationPlans: fixture.education ? [{ annualCost: fixture.education, yearsRemaining: 3 }] : [],
        mortgagePayment: fixture.debt ? 15000 : 0,
        mortgageInstallmentsRemaining: fixture.debt ? 600 : 0,
        carPayment: 0,
        carInstallmentsRemaining: 0,
        otherDebtBalance: fixture.debt,
      },
      existingCI: { lumpSum: fixture.coverage, liquidAssets: fixture.liquid },
    };
    const lifeInput = {
      householdMonthly: fixture.household,
      supportYears: fixture.years === 10 ? 20 : fixture.years,
      debt: fixture.debt,
      education: fixture.education,
      existingLifeCoverage: fixture.coverage,
      liquidAssets: fixture.liquid,
    };
    const expected = baseline.fixtures[fixture.name];
    assert.ok(expected, `missing frozen fixture ${fixture.name}`);
    const actualCI = calculateCI(structuredClone(ciInput));
    const legacyCI = Object.fromEntries(Object.keys(expected.ci).map((key) => [key, actualCI[key]]));
    assert.deepEqual(legacyCI, expected.ci);
    assert.equal(actualCI.recoveryReserveNeed, 0, 'Recovery Reserve must default to zero for frozen legacy inputs');
    assert.deepEqual(calculateLiveFHC(structuredClone(lifeInput)), expected.fhc);
  });
}

test('FHC domain files remain frozen while CI legacy outputs remain parity-covered above', () => {
  for (const [file, expectedHash] of Object.entries(baseline.files)) {
    if (file.startsWith('features/ci-planning/')) continue;
    assert.equal(sha256(read(file)), expectedHash, file);
  }
});

test('FHC live wizard delegates calculation to the pure model owner', () => {
  const wizard = read(fhcWizardPath);
  assert.match(wizard, /import \{ calculateLifeCoverage,[\s\S]*from '\.\/lifeCoverageModel'/);
  assert.match(wizard, /useMemo\(\(\) => calculateLifeCoverage\(values\), \[values\]\)/);
  assert.doesNotMatch(wizard, /const familySupport = values\.householdMonthly \* 12 \* values\.supportYears/);
});
