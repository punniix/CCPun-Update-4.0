'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import { calculateCI } from '@/features/ci-planning/calculator/calculator';
import { CI_ASSESSMENT_VERSION, INITIAL_CI_FORM_DATA } from '@/features/ci-planning/calculator/constants';
import { validateCIStep } from '@/features/ci-planning/calculator/schemas';
import type { CIFormData, CIResult } from '@/features/ci-planning/calculator/types';
import CIProgress from './CIProgress';
import CIResultView from './result/CIResult';
import StepExistingCI from './steps/StepExistingCI';
import StepExpenses from './steps/StepExpenses';

const TOTAL_STEPS = 2;
const STEP_SECTION_KEYS: Array<'expenses' | 'existingCI'> = ['expenses', 'existingCI'];

export default function CIWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<CIFormData>(INITIAL_CI_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<CIResult | null>(null);
  const hasStartedRef = useRef(false);
  const hasCompletedRef = useRef(false);
  const trackedStepsRef = useRef(new Set<number>());
  const startedAtRef = useRef<number | null>(null);
  const stepRef = useRef<HTMLDivElement>(null);
  const previousViewRef = useRef('0:form');
  useEffect(() => {
    const view = `${currentStep}:${result ? 'result' : 'form'}`;
    if (previousViewRef.current === view) return;
    previousViewRef.current = view;
    if (result) return; // Result owns its own heading focus.
    const heading = stepRef.current?.querySelector<HTMLElement>('h2');
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [currentStep, result]);

  useEffect(() => {
    const startedAt = startedAtRef.current;
    if (!result || hasCompletedRef.current || !hasStartedRef.current || startedAt === null) return;

    const elapsedMilliseconds = Date.now() - startedAt;
    hasCompletedRef.current = true;
    trackEvent('ci_calculator_complete', {
      tool_name: 'ci_planning',
      step_number: TOTAL_STEPS,
      cta_location: 'ci_result',
      calculator_version: CI_ASSESSMENT_VERSION,
      ...(elapsedMilliseconds >= 0 && elapsedMilliseconds <= 1_800_000
        ? { duration_seconds: Math.floor(elapsedMilliseconds / 1_000) }
        : {}),
    });
  }, [result]);

  const trackStepView = useCallback((stepNumber: number) => {
    if (trackedStepsRef.current.has(stepNumber)) return;
    trackedStepsRef.current.add(stepNumber);
    trackEvent('ci_step_view', {
      tool_name: 'ci_planning',
      step_number: stepNumber,
      cta_location: 'ci_calculator',
      calculator_version: CI_ASSESSMENT_VERSION,
    });
  }, []);

  const trackStart = useCallback(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    hasCompletedRef.current = false;
    startedAtRef.current = Date.now();
    trackEvent('ci_calculator_start', {
      tool_name: 'ci_planning',
      cta_location: 'ci_calculator',
      calculator_version: CI_ASSESSMENT_VERSION,
    });
    trackStepView(1);
  }, [trackStepView]);

  const updateData = useCallback(
    (section: keyof CIFormData, value: CIFormData[keyof CIFormData]) => {
      trackStart();
      setFormData((previous) => ({ ...previous, [section]: value }));
      setErrors({});
    },
    [trackStart],
  );

  const handleNext = () => {
    const sectionKey = STEP_SECTION_KEYS[currentStep];
    const stepErrors = validateCIStep(
      currentStep,
      formData[sectionKey] as unknown as Record<string, unknown>,
    );

    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      window.requestAnimationFrame(() => {
        const alert = stepRef.current?.querySelector<HTMLElement>('[role="alert"]');
        alert?.scrollIntoView({ block: 'center', behavior: 'instant' });
        alert?.focus({ preventScroll: true });
      });
      return;
    }

    trackStart();

    if (currentStep === TOTAL_STEPS - 1) {
      setResult(calculateCI(formData));
      return;
    }

    const nextStep = currentStep + 1;
    setErrors({});
    setCurrentStep(nextStep);
    trackStepView(nextStep + 1);
  };

  const handlePrev = () => {
    if (currentStep === 0) return;
    setErrors({});
    setCurrentStep((step) => step - 1);
  };

  const handleEditData = () => {
    setResult(null);
    setCurrentStep(0);
    setErrors({});
  };

  const handleReset = () => {
    setResult(null);
    setCurrentStep(0);
    setFormData(INITIAL_CI_FORM_DATA);
    setErrors({});
    hasStartedRef.current = false;
    hasCompletedRef.current = false;
    trackedStepsRef.current.clear();
    startedAtRef.current = null;
  };

  if (result) {
    return <CIResultView result={result} onEditData={handleEditData} onReset={handleReset} />;
  }

  const stepProps = { data: formData, updateData, errors };

  return (
    <form noValidate onSubmit={(event) => { event.preventDefault(); handleNext(); }}>
      <div className="mb-8">
        <CIProgress currentStep={currentStep} />
        {currentStep === 0 && (
          <p className="mt-2 text-center text-sm text-muted-foreground">
            2 ขั้นตอน ใช้ข้อมูลเท่าที่คุณทราบ
          </p>
        )}
      </div>

      <div className="flex min-h-[320px] flex-col">
        <div ref={stepRef} className="min-w-0 flex-1">
          {currentStep === 0
            ? <StepExpenses {...stepProps} />
            : <StepExistingCI {...stepProps} />}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-end gap-3 border-t border-border/30 pt-6">
          {currentStep > 0 && (
            <button
              type="button"
              onClick={handlePrev}
              aria-label="ย้อนกลับ"
              className="glass-button mr-auto flex min-h-12 items-center gap-2 text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>ย้อนกลับ</span>
            </button>
          )}

          <button type="submit" className="gold-button flex min-h-12 items-center justify-center gap-2">
            <span>{currentStep === TOTAL_STEPS - 1 ? 'ดูผลคำนวณ' : 'ถัดไป'}</span>
            {currentStep === TOTAL_STEPS - 1
              ? <BarChart3 className="h-4 w-4" />
              : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </form>
  );
}
