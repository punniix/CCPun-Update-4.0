'use client';

import { CI_STEP_LABELS } from '@/features/ci-planning/calculator/constants';

/** Contained segments replace the edge-overhanging labels from the old stepper. */
export default function CIProgress({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-6 w-full">
      <p className="text-sm font-semibold text-primary" aria-live="polite" aria-atomic="true">
        ขั้นตอนที่ {currentStep + 1} จาก {CI_STEP_LABELS.length} · {CI_STEP_LABELS[currentStep]}
      </p>
      <div role="progressbar" aria-label="ความคืบหน้าการกรอกข้อมูล" aria-valuemin={1}
        aria-valuemax={CI_STEP_LABELS.length} aria-valuenow={currentStep + 1}
        aria-valuetext={CI_STEP_LABELS[currentStep]} className="mt-3 grid grid-cols-2 gap-2">
        {CI_STEP_LABELS.map((label, index) => (
          <span key={label} className={`h-1 rounded-full ${index <= currentStep ? 'bg-primary' : 'bg-muted'}`} />
        ))}
      </div>
    </div>
  );
}
