import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const candidateFile = 'features/ci-planning/components/CIWizard.tsx';
const predecessorHash = '381a97ab68a8d7bfbe82d55e6457b0f123b7c0a6de5f3e6ca3a5b3804a9cea26';
const digest = source => createHash('sha256').update(source).digest('hex');
const replacements = Object.freeze([
  ["import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';", "import { useCallback, useEffect, useRef, useState } from 'react';"],
  ["// Result-only UI stays out of the initial wizard bundle; begin fetching once a\n// visitor actually interacts with the form, before they complete both steps.\nconst loadCIResultView = () => import('./result/CIResult');\nconst CIResultView = lazy(loadCIResultView);\n\n", ""],
  ["    hasStartedRef.current = true;\n    void loadCIResultView();\n    hasCompletedRef.current = false;", "    hasStartedRef.current = true;\n    hasCompletedRef.current = false;"],
  ["  if (result) return <Suspense fallback={null}><CIResultView result={result} onEditData={handleEditData} onReset={handleReset} /></Suspense>;", "  if (result) return <CIResultView result={result} onEditData={handleEditData} onReset={handleReset} />;"],
]);

export function ciResultLazyPredecessor(file, source) {
  assert.equal(file, candidateFile, 'only the live CI wizard is authorized');
  assert.equal(source.includes("import CIResultView from './result/CIResult';"), false, 'old eager result import must be absent');
  for (const [newText, oldText] of replacements) {
    assert.equal(source.split(newText).length, 2, 'exact approved transformation must occur once');
    source = source.replace(newText, oldText);
  }
  source = source.replace("import StepExistingCI from './steps/StepExistingCI';", "import CIResultView from './result/CIResult';\nimport StepExistingCI from './steps/StepExistingCI';");
  assert.equal(digest(source), predecessorHash, 'all former calculator, event, UX and validation bytes remain unchanged');
  return source;
}
