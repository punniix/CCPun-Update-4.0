'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import FHCProgress from './FHCProgress';
import StepPersonalInfo from './steps/StepPersonalInfo';
import StepPriorities from './steps/StepPriorities';
import StepIncomeExpenses from './steps/StepIncomeExpenses';
import StepDebts from './steps/StepDebts';
import StepDependentsEducation from './steps/StepDependentsEducation';
import StepExistingCoverage from './steps/StepExistingCoverage';
import FHCResultView from './result/FHCResult';
import { INITIAL_FORM_DATA, STEP_LABELS } from '@/features/financial-health-check/calculator/constants';
import { validateStep } from '@/features/financial-health-check/calculator/schemas';
import { calculateFHC } from '@/features/financial-health-check/calculator/calculator';
import type { FHCFormData, FHCResult } from '@/features/financial-health-check/calculator/types';

const TOTAL_STEPS = STEP_LABELS.length;

// Slide animation variants
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 200 : -200,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -200 : 200,
    opacity: 0,
  }),
};

/** Map step index → section key of FHCFormData for validation */
const STEP_SECTION_KEYS: (keyof FHCFormData)[] = [
  'personalInfo',
  'priorities',
  'incomeExpenses',
  'debts',
  'dependents',
  'existingCoverage',
];

export default function FHCWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FHCFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<FHCResult | null>(null);
  const [direction, setDirection] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const stepRef = useRef<HTMLDivElement>(null);
  const validationMessage = Object.values(errors)[0];

  // Focus heading of new step after animation completes
  useEffect(() => {
    const timer = setTimeout(() => {
      const heading = stepRef.current?.querySelector('h2');
      if (heading) {
        heading.setAttribute('tabIndex', '-1');
        heading.style.outline = 'none';
        heading.focus();
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [currentStep]);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TOTAL_STEPS - 1;

  const updateData = useCallback(
    (section: keyof FHCFormData, value: FHCFormData[keyof FHCFormData]) => {
      setFormData((prev) => ({ ...prev, [section]: value }));
      // Clear errors for this section when user types
      setErrors({});
    },
    []
  );

  const handleNext = () => {
    // Validate current step
    const sectionKey = STEP_SECTION_KEYS[currentStep];
    const sectionData = formData[sectionKey];
    const stepErrors = validateStep(currentStep, sectionData as unknown as Record<string, unknown>);

    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }

    if (isLastStep) {
      // Calculate result and show
      const calcResult = calculateFHC(formData);
      setResult(calcResult);
      setShowResult(true);
      trackEvent('tool_complete', {
        tool_name: 'fhc',
        step_number: TOTAL_STEPS,
      });
      return;
    }

    const nextStep = currentStep + 1;

    // Fire tool_start on first step transition (step 0 → step 1)
    if (!hasStarted) {
      setHasStarted(true);
      trackEvent('tool_start', { tool_name: 'fhc', step_number: 1 });
    }

    // Track step progress
    trackEvent('tool_step', { tool_name: 'fhc', step_number: nextStep + 1 });

    setDirection(1);
    setErrors({});
    setCurrentStep(nextStep);
  };

  const handlePrev = () => {
    if (isFirstStep) return;
    setDirection(-1);
    setErrors({});
    setCurrentStep((s) => s - 1);
  };

  const handleEditData = () => {
    setShowResult(false);
    setResult(null);
    setCurrentStep(0);
    setErrors({});
    // Keep existing formData so user can edit
  };

  const handleReset = () => {
    setShowResult(false);
    setResult(null);
    setCurrentStep(0);
    setFormData(INITIAL_FORM_DATA);
    setErrors({});
  };

  /** Render the active step component */
  const renderStep = () => {
    const stepProps = { data: formData, updateData, errors };

    switch (currentStep) {
      case 0:
        return <StepPersonalInfo {...stepProps} />;
      case 1:
        return <StepPriorities {...stepProps} />;
      case 2:
        return <StepIncomeExpenses {...stepProps} />;
      case 3:
        return <StepDebts {...stepProps} />;
      case 4:
        return <StepDependentsEducation {...stepProps} />;
      case 5:
        return <StepExistingCoverage {...stepProps} />;
      default:
        return null;
    }
  };

  // Result view
  if (showResult && result) {
    return (
      <FHCResultView
        result={result}
        formData={formData}
        onEditData={handleEditData}
        onReset={handleReset}
      />
    );
  }

  return (
    <div>
      {/* Progress bar */}
      <div className="mb-8">
        <FHCProgress currentStep={currentStep} totalSteps={TOTAL_STEPS} />
        {isFirstStep && (
          <p className="text-sm text-muted-foreground text-center mt-2">
            {TOTAL_STEPS} ขั้นตอน ใช้เวลาประมาณ 3 นาที
          </p>
        )}
      </div>

      {/* Step content with animation */}
      <div className="min-h-[320px] flex flex-col">
        {validationMessage && (
          <p
            id="fhc-error-summary"
            role="alert"
            aria-live="assertive"
            className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            ตรวจสอบข้อมูลก่อนดำเนินการ: {validationMessage}
          </p>
        )}
        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              ref={stepRef}
              key={currentStep}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation buttons */}
        <div
          className={`flex items-center mt-8 pt-6 border-t border-border/30 ${
            isFirstStep ? 'justify-center' : 'justify-between'
          }`}
        >
          {/* Back button — hidden on first step to avoid ghost space */}
          {!isFirstStep && (
            <button
              type="button"
              onClick={handlePrev}
              aria-label="ย้อนกลับ"
              className="glass-button text-foreground flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>ย้อนกลับ</span>
            </button>
          )}

          {/* Step counter — hidden on first step (only one button centered) */}
          {!isFirstStep && (
            <span className="text-sm text-muted-foreground">
              {currentStep + 1} / {TOTAL_STEPS}
            </span>
          )}

          <button
            type="button"
            onClick={handleNext}
            className="gold-button flex items-center gap-2"
          >
            <span>{isLastStep ? 'ดูผลวิเคราะห์' : 'ถัดไป'}</span>
            {isLastStep ? (
              <BarChart3 className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
