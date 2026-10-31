'use client';
import { usePublicCopy } from '@/components/ui/PublicCopyProvider';
import { CI_COPY_DEFAULTS } from '@/lib/content/tool-copy-defaults';


import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import HumanCalculatorCard from '@/components/ui/HumanCalculatorCard';
import { trackEvent } from '@/lib/analytics';
import { calculateCI } from '@/features/ci-planning/calculator/calculator';
import { CI_ASSESSMENT_VERSION, INITIAL_CI_FORM_DATA } from '@/features/ci-planning/calculator/constants';
import { validateCIStep } from '@/features/ci-planning/calculator/schemas';
import type { CIFormData, CIResult } from '@/features/ci-planning/calculator/types';
import StepExistingCI from './steps/StepExistingCI';
import StepExpenses from './steps/StepExpenses';

// Result-only UI stays out of the initial wizard bundle; begin fetching once a
// visitor actually interacts with the form, before they complete both steps.
const loadCIResultView = () => import('./result/CIResult');
const CIResultView = lazy(loadCIResultView);

const TOTAL_STEPS = 2;
const STEP_SECTION_KEYS: Array<'expenses' | 'existingCI'> = ['expenses', 'existingCI'];


export default function CIWizard() {
  const t = usePublicCopy(CI_COPY_DEFAULTS);

const CALCULATION_RANGE_ERROR = t("ci.wizard.validation.calculationRange");

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
    if (result) return;
    const heading = stepRef.current?.querySelector<HTMLElement>('h3');
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: 'center', behavior: 'instant' });
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
      ...(elapsedMilliseconds >= 0 && elapsedMilliseconds <= 1_800_000 ? { duration_seconds: Math.floor(elapsedMilliseconds / 1_000) } : {}),
    });
  }, [result]);

  const trackStepView = useCallback((stepNumber: number) => {
    if (trackedStepsRef.current.has(stepNumber)) return;
    trackedStepsRef.current.add(stepNumber);
    trackEvent('ci_step_view', { tool_name: 'ci_planning', step_number: stepNumber, cta_location: 'ci_calculator', calculator_version: CI_ASSESSMENT_VERSION });
  }, []);

  const trackStart = useCallback(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    void loadCIResultView();
    hasCompletedRef.current = false;
    startedAtRef.current = Date.now();
    trackEvent('ci_calculator_start', { tool_name: 'ci_planning', cta_location: 'ci_calculator', calculator_version: CI_ASSESSMENT_VERSION });
    trackStepView(1);
  }, [trackStepView]);

  const updateData = useCallback((section: keyof CIFormData, value: CIFormData[keyof CIFormData]) => {
    trackStart();
    setFormData((previous) => ({ ...previous, [section]: value }));
    setErrors({});
  }, [trackStart]);

  const focusFirstAlert = () => {
    window.requestAnimationFrame(() => {
      const alert = stepRef.current?.querySelector<HTMLElement>('[role="alert"]');
      alert?.scrollIntoView({ block: 'center', behavior: 'instant' });
      alert?.focus({ preventScroll: true });
    });
  };

  const runStepTransition = (commit: () => void) => commit();

  const handleNext = () => {
    const sectionKey = STEP_SECTION_KEYS[currentStep];
    const stepErrors = validateCIStep(currentStep, formData[sectionKey] as unknown as Record<string, unknown>, t);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      focusFirstAlert();
      return;
    }
    trackStart();
    if (currentStep === TOTAL_STEPS - 1) {
      try {
        setResult(calculateCI(formData));
      } catch (error) {
        if (!(error instanceof RangeError)) throw error;
        setErrors({ calculation: CALCULATION_RANGE_ERROR });
        focusFirstAlert();
      }
      return;
    }
    const nextStep = currentStep + 1;
    runStepTransition(() => {
      setErrors({});
      setCurrentStep(nextStep);
      trackStepView(nextStep + 1);
    });
  };

  const handlePrev = () => {
    if (currentStep === 0) return;
    runStepTransition(() => {
      setErrors({});
      setCurrentStep((step) => step - 1);
    });
  };
  const handleEditData = () => { setResult(null); setCurrentStep(0); setErrors({}); };
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

  if (result) return <Suspense fallback={null}><CIResultView result={result} onEditData={handleEditData} onReset={handleReset} /></Suspense>;

  const stepProps = { data: formData, updateData, errors };
  const footer = <div className="flex items-center gap-3">
    {currentStep > 0 ? <button type="button" onClick={handlePrev} aria-label={t("ci.wizard.ariaLabel")} className="glass-button ccpun-motion-tactile inline-flex min-h-11 items-center gap-2 px-4"><ChevronLeft className="h-4 w-4" /><span>{t.node("ci.wizard.ariaLabel")}</span></button> : <span className="flex-1" />}
    <button type="submit" className="gold-button ccpun-motion-tactile ml-auto inline-flex min-h-11 flex-1 items-center justify-center gap-2 px-5 sm:flex-none sm:min-w-44"><span>{currentStep === TOTAL_STEPS - 1 ? t("ci.wizard.footer") : t("ci.wizard.footer2")}</span>{currentStep === TOTAL_STEPS - 1 ? <BarChart3 className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>
  </div>;

  return <form noValidate onSubmit={(event) => { event.preventDefault(); handleNext(); }}>
    <div ref={stepRef} className="ccpun-motion-step-view">
      <HumanCalculatorCard
        step={currentStep + 1}
        total={TOTAL_STEPS}
        labelledBy={`ci-step-${currentStep + 1}-title`}
        title={currentStep === 0 ? t("ci.wizard.title") : t("ci.wizard.title2")}
        description={currentStep === 0 ? t("ci.wizard.description") : t("ci.wizard.description2")}
        footer={footer}
      >
        {errors.calculation ? <p id="ci-calculation-error" role="alert" tabIndex={-1} className="ccpun-motion-validation rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{errors.calculation}</p> : null}
        {currentStep === 0 ? <StepExpenses {...stepProps} /> : <StepExistingCI {...stepProps} />}
      </HumanCalculatorCard>
    </div>
  </form>;
}
