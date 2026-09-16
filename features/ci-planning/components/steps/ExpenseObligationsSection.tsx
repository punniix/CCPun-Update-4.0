'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { ChangeEvent } from 'react';
import CurrencyInput from '@/components/ui/CurrencyInput';
import type { CIEducationPlan, CIFormData } from '@/features/ci-planning/calculator/types';
import { baht, describedBy, previewBaht, previewEducationSubtotal, safePlanPreview, type ExpenseField } from './StepExpenses.model';

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} role="alert" tabIndex={-1} className="text-sm text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{message}</p>;
}

type Props = {
  open: boolean;
  educationPlans: CIEducationPlan[];
  expenses: CIFormData['expenses'];
  errors: Record<string, string>;
  planPreview: ReturnType<typeof safePlanPreview>;
  handleAddEducationPlan: () => void;
  handleEducationPlan: (index: number, field: keyof CIEducationPlan, value: number) => void;
  handleEducationYears: (index: number, event: ChangeEvent<HTMLInputElement>) => void;
  handleRemoveEducationPlan: (index: number) => void;
  handleExpense: (field: ExpenseField, value: number) => void;
  handleInstallments: (field: 'mortgageInstallmentsRemaining' | 'carInstallmentsRemaining', event: ChangeEvent<HTMLInputElement>) => void;
};

export default function ExpenseObligationsSection({ open: hasAdvancedData, educationPlans, expenses, errors, planPreview, handleAddEducationPlan, handleEducationPlan, handleEducationYears, handleRemoveEducationPlan, handleExpense, handleInstallments }: Props) {
  return (
<details open={hasAdvancedData} className="group border-t border-white/10 pt-4">
      <summary className="cursor-pointer text-sm font-medium text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">เพิ่มภาระอื่น: ค่าเรียนและหนี้ (ถ้ามี)</summary>
      <div className="mt-5 space-y-7">
        <section aria-labelledby="ci-education-title">
          <div className="flex items-end justify-between gap-3"><div><h4 id="ci-education-title" className="text-sm font-medium text-foreground">แผนการศึกษาบุตร</h4><p className="mt-1 text-xs leading-5 text-white/45">เพิ่มแยกเป็นรายคนได้</p></div><button type="button" onClick={handleAddEducationPlan} className="glass-button inline-flex min-h-10 items-center gap-2 px-3 text-sm"><Plus className="h-4 w-4" aria-hidden="true" />เพิ่มบุตร</button></div>
          {educationPlans.length ? <div className="mt-4 space-y-5">{educationPlans.map((plan, index) => {
            const annualCostError = errors[`educationPlans.${index}.annualCost`];
            const yearsError = errors[`educationPlans.${index}.yearsRemaining`];
            const annualCostId = `ci-education-${index}-annual-cost`;
            const yearsId = `ci-education-${index}-years`;
            return <fieldset key={index} className="rounded-xl border border-white/10 p-4"><legend className="flex w-full items-center justify-between gap-3 px-1 text-sm font-medium"><span>บุตรคนที่ {index + 1}</span><button type="button" onClick={() => handleRemoveEducationPlan(index)} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full text-white/45 hover:bg-destructive/10 hover:text-destructive" aria-label={`ลบแผนการศึกษาบุตรคนที่ ${index + 1}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></button></legend><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><label htmlFor={annualCostId} className="text-xs text-white/55">ค่าใช้จ่ายต่อปี</label><CurrencyInput id={annualCostId} value={plan.annualCost} onChange={(value) => handleEducationPlan(index, 'annualCost', value)} placeholder="เช่น 60,000" error={Boolean(annualCostError)} aria-describedby={annualCostError ? `${annualCostId}-error` : undefined} /><FieldError id={`${annualCostId}-error`} message={annualCostError} /></div><div className="space-y-2"><label htmlFor={yearsId} className="text-xs text-white/55">เหลืออีกกี่ปี</label><input id={yearsId} type="number" inputMode="numeric" min={1} max={30} step={1} value={plan.yearsRemaining || ''} onChange={(event) => handleEducationYears(index, event)} placeholder="เช่น 10" aria-invalid={Boolean(yearsError) || undefined} aria-describedby={describedBy(`${yearsId}-help`, yearsError && `${yearsId}-error`)} className={`h-12 w-full rounded-md border bg-background/50 px-3 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${yearsError ? 'border-destructive' : 'border-border/50'}`} /><p id={`${yearsId}-help`} className="text-xs text-white/45">1–30 ปี</p><FieldError id={`${yearsId}-error`} message={yearsError} /></div></div><p className="mt-3 text-xs text-white/45">รวมคนนี้: <strong className="font-medium text-foreground">{previewBaht(previewEducationSubtotal(plan))}</strong></p></fieldset>;
          })}<p className="text-sm text-white/55">รวมทุนการศึกษา <strong className="font-semibold text-foreground">{planPreview ? baht(planPreview.educationNeed) : '—'}</strong></p></div> : <p className="mt-3 text-xs text-white/40">ไม่มีข้อมูลส่วนนี้ก็ข้ามได้</p>}
        </section>

        <section aria-labelledby="ci-debt-title" className="border-t border-white/10 pt-5">
          <h4 id="ci-debt-title" className="text-sm font-medium text-foreground">ภาระหนี้</h4>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div className="space-y-2"><label htmlFor="ci-mortgage-payment" className="text-xs text-white/55">ค่างวดบ้าน/เดือน</label><CurrencyInput id="ci-mortgage-payment" value={expenses.mortgagePayment} onChange={(value) => handleExpense('mortgagePayment', value)} placeholder="15,000" error={Boolean(errors.mortgagePayment)} aria-describedby={errors.mortgagePayment ? 'ci-mortgage-payment-error' : undefined} /><FieldError id="ci-mortgage-payment-error" message={errors.mortgagePayment} /></div>
            <div className="space-y-2"><label htmlFor="ci-mortgage-installments" className="text-xs text-white/55">งวดบ้านที่เหลือ</label><input id="ci-mortgage-installments" type="number" inputMode="numeric" min={0} max={600} step={1} value={expenses.mortgageInstallmentsRemaining || ''} onChange={(event) => handleInstallments('mortgageInstallmentsRemaining', event)} placeholder="60" aria-invalid={Boolean(errors.mortgageInstallmentsRemaining) || undefined} aria-describedby={describedBy('ci-mortgage-installments-help', errors.mortgageInstallmentsRemaining && 'ci-mortgage-installments-error')} className={`h-12 w-full rounded-md border bg-background/50 px-3 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${errors.mortgageInstallmentsRemaining ? 'border-destructive' : 'border-border/50'}`} /><p id="ci-mortgage-installments-help" className="text-xs text-white/45">0–600 งวด</p><FieldError id="ci-mortgage-installments-error" message={errors.mortgageInstallmentsRemaining} /></div>
            <div className="space-y-2"><label htmlFor="ci-car-payment" className="text-xs text-white/55">ค่างวดรถ/เดือน</label><CurrencyInput id="ci-car-payment" value={expenses.carPayment} onChange={(value) => handleExpense('carPayment', value)} placeholder="8,000" error={Boolean(errors.carPayment)} aria-describedby={errors.carPayment ? 'ci-car-payment-error' : undefined} /><FieldError id="ci-car-payment-error" message={errors.carPayment} /></div>
            <div className="space-y-2"><label htmlFor="ci-car-installments" className="text-xs text-white/55">งวดรถที่เหลือ</label><input id="ci-car-installments" type="number" inputMode="numeric" min={0} max={600} step={1} value={expenses.carInstallmentsRemaining || ''} onChange={(event) => handleInstallments('carInstallmentsRemaining', event)} placeholder="36" aria-invalid={Boolean(errors.carInstallmentsRemaining) || undefined} aria-describedby={describedBy('ci-car-installments-help', errors.carInstallmentsRemaining && 'ci-car-installments-error')} className={`h-12 w-full rounded-md border bg-background/50 px-3 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${errors.carInstallmentsRemaining ? 'border-destructive' : 'border-border/50'}`} /><p id="ci-car-installments-help" className="text-xs text-white/45">0–600 งวด</p><FieldError id="ci-car-installments-error" message={errors.carInstallmentsRemaining} /></div>
          </div>
          <div className="mt-5 space-y-2"><label htmlFor="ci-other-debt-balance" className="text-xs text-white/55">หนี้อื่นๆ คงเหลือทั้งหมด</label><CurrencyInput id="ci-other-debt-balance" value={expenses.otherDebtBalance} onChange={(value) => handleExpense('otherDebtBalance', value)} placeholder="เช่น 100,000" error={Boolean(errors.otherDebtBalance)} aria-describedby={describedBy('ci-other-debt-balance-help', errors.otherDebtBalance && 'ci-other-debt-balance-error')} /><p id="ci-other-debt-balance-help" className="text-xs leading-5 text-white/45">รวมบัตรเครดิต สินเชื่อส่วนบุคคล หรือหนี้อื่นแล้วกรอกครั้งเดียว</p><FieldError id="ci-other-debt-balance-error" message={errors.otherDebtBalance} /></div>
          <p className="mt-4 text-xs leading-5 text-white/45">ค่างวดบ้านและรถนับตามงวดที่เหลือภายในช่วงที่เลือก ส่วนหนี้อื่นนับจากยอดคงเหลือครั้งเดียว</p>
        </section>
      </div>
    </details>
  );
}
