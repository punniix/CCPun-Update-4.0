import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ciResultLazyPredecessor } from '../qa/ci-result-splitting-proof.mjs';

const path = 'features/ci-planning/components/CIWizard.tsx';
const source = readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('CI result is split only after first form interaction, retaining the original calculator', () => {
  const prior = ciResultLazyPredecessor(path, source);
  assert.match(prior, /import CIResultView from '.\/result\/CIResult';/);
  assert.doesNotMatch(source, /import CIResultView from '.\/result\/CIResult';/);
  assert.match(source, /const CIResultView = lazy\(loadCIResultView\);/);
  assert.match(source, /hasStartedRef\.current = true;\s*void loadCIResultView\(\);/);
  assert.match(source, /if \(result\) return <Suspense fallback=\{null\}>/);
});

test('strict predecessor admission rejects unrelated edits, removed result UI and changed tracking', () => {
  for (const altered of [
    source.replace("import('./result/CIResult')", "import('./steps/StepExpenses')"),
    source.replace('void loadCIResultView();', ''),
    source.replace('setResult(calculateCI(formData));', 'setResult(null);'),
    source.replace("trackEvent('ci_calculator_complete'", "trackEvent('ci_complete_unapproved'"),
    source + '\n// unreviewed change\n',
  ]) {
    assert.notEqual(source, altered);
    assert.throws(() => ciResultLazyPredecessor(path, altered));
  }
  assert.throws(() => ciResultLazyPredecessor('features/financial-health-check/components/LifeCoverageWizard.tsx', source));
});
