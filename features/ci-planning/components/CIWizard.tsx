'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
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

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 160 : -160, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -160 : 160, opacity: 0 }),
};

const subtleSlideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 12 : -12, opacity: 0.85 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -12 : 12, opacity: 0.85 }),
};

export default function CIWizard({ subtleMotion = false }: { subtleMotion?: boolean } = {}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<CIFormData>(INITIAL_CI_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<CIResult | null>(null);
  const [direction, setDirection] = useState(0);
  const hasStartedRef = useRef(false);
  const hasCompletedRef = useRef(false);
  const trackedStepsRef = useRef(new Set<number>());
  const startedAtRef = useRef<number | null>(null);
  const stepRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

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
    setDirection(1);
    setErrors({});
    setCurrentStep(nextStep);
    trackStepView(nextStep + 1);
  };

  const handlePrev = () => {
    if (currentStep === 0) return;
    setDirection(-1);
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
    <div>
      <div className="mb-8">
        <CIProgress currentStep={currentStep} />
        {currentStep === 0 && (
          <p className="mt-2 text-center text-sm text-muted-foreground">
            2 ขั้นตอน ใช้ข้อมูลเท่าที่คุณทราบ
          </p>
        )}
      </div>

      <div className="flex min-h-[320px] flex-col">
        <div className="relative flex-1 overflow-hidden">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              ref={stepRef}
              key={currentStep}
              custom={direction}
              variants={subtleMotion ? subtleSlideVariants : slideVariants}
              data-w43-motion-step={subtleMotion ? currentStep + 1 : undefined}
              initial={reduceMotion ? false : 'enter'}
              animate="center"
              exit={reduceMotion ? undefined : 'exit'}
              transition={{ duration: reduceMotion ? 0 : subtleMotion ? 0.12 : 0.28, ease: 'easeInOut' }}
            >
              {currentStep === 0
                ? <StepExpenses {...stepProps} />
                : <StepExistingCI {...stepProps} />}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className={`mt-8 flex items-center border-t border-border/30 pt-6 ${currentStep === 0 ? 'justify-center' : 'justify-between'}`}>
          {currentStep > 0 && (
            <button
              type="button"
              onClick={handlePrev}
              aria-label="ย้อนกลับ"
              className="glass-button flex items-center gap-2 text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>ย้อนกลับ</span>
            </button>
          )}

          {currentStep > 0 && (
            <span className="text-sm text-muted-foreground">{currentStep + 1} / {TOTAL_STEPS}</span>
          )}

          <button type="button" onClick={handleNext} className="gold-button flex items-center gap-2">
            <span>{currentStep === TOTAL_STEPS - 1 ? 'ดูผลคำนวณ' : 'ถัดไป'}</span>
            {currentStep === TOTAL_STEPS - 1
              ? <BarChart3 className="h-4 w-4" />
              : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
