'use client';
import { usePublicCopy } from '@/components/ui/PublicCopyProvider';
import { CI_COPY_DEFAULTS } from '@/lib/content/tool-copy-defaults';


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
  const t = usePublicCopy(CI_COPY_DEFAULTS);

  return (
<details open={hasAdvancedData} className="group border-t border-white/10 pt-4">
      <summary className="min-h-11 py-3 cursor-pointer text-sm font-medium text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t("ci.obligations.expandLabel")}</summary>
      <div className="mt-5 space-y-7">
        <section aria-labelledby="ci-education-title">
          <div className="flex items-end justify-between gap-3"><div><h4 id="ci-education-title" className="text-sm font-medium text-foreground">{t("ci.obligations.educationTitle.heading")}</h4><p className="mt-1 text-xs leading-5 text-muted-foreground">{t("ci.obligations.description")}</p></div><button type="button" onClick={handleAddEducationPlan} className="glass-button inline-flex min-h-11 items-center gap-2 px-3 text-sm"><Plus className="h-4 w-4" aria-hidden="true" />{t("ci.obligations.action")}</button></div>
          {educationPlans.length ? <div className="mt-4 space-y-5">{educationPlans.map((plan, index) => {
            const annualCostError = errors[`educationPlans.${index}.annualCost`];
            const yearsError = errors[`educationPlans.${index}.yearsRemaining`];
            const annualCostId = `ci-education-${index}-annual-cost`;
            const yearsId = `ci-education-${index}-years`;
            return <fieldset key={index} className="rounded-xl border border-white/10 p-4"><legend className="flex w-full items-center justify-between gap-3 px-1 text-sm font-medium"><span>{t("ci.obligations.label")}{index + 1}</span><button type="button" onClick={() => handleRemoveEducationPlan(index)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={t("ci.obligations.ariaLabel").replaceAll("{value1}", String(index + 1))}><Trash2 className="h-4 w-4" aria-hidden="true" /></button></legend><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><label htmlFor={annualCostId} className="text-xs text-muted-foreground">{t("ci.obligations.label2")}</label><CurrencyInput id={annualCostId} value={plan.annualCost} onChange={(value) => handleEducationPlan(index, 'annualCost', value)} placeholder={t("ci.obligations.placeholder")} error={Boolean(annualCostError)} aria-describedby={annualCostError ? `${annualCostId}-error` : undefined} /><FieldError id={`${annualCostId}-error`} message={annualCostError} /></div><div className="space-y-2"><label htmlFor={yearsId} className="text-xs text-muted-foreground">{t("ci.obligations.label3")}</label><input id={yearsId} type="number" inputMode="numeric" min={1} max={30} step={1} value={plan.yearsRemaining || ''} onChange={(event) => handleEducationYears(index, event)} placeholder={t("ci.obligations.placeholder2")} aria-invalid={Boolean(yearsError) || undefined} aria-describedby={describedBy(`${yearsId}-help`, yearsError && `${yearsId}-error`)} className={`h-12 w-full rounded-md border bg-background/50 px-3 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${yearsError ? 'border-destructive' : 'border-border/50'}`} /><p id={`${yearsId}-help`} className="text-xs text-muted-foreground">{t("ci.obligations.description2")}</p><FieldError id={`${yearsId}-error`} message={yearsError} /></div></div><p className="mt-3 text-xs text-muted-foreground">{t("ci.obligations.description3")}<strong className="font-medium text-foreground">{previewBaht(previewEducationSubtotal(plan))}</strong></p></fieldset>;
          })}<p className="text-sm text-muted-foreground">{t("ci.obligations.description4")}<strong className="font-semibold text-foreground">{planPreview ? baht(planPreview.educationNeed) : '—'}</strong></p></div> : <p className="mt-3 text-xs text-muted-foreground">{t("ci.obligations.description5")}</p>}
        </section>

        <section aria-labelledby="ci-debt-title" className="border-t border-white/10 pt-5">
          <h4 id="ci-debt-title" className="text-sm font-medium text-foreground">{t("ci.obligations.debtTitle.heading")}</h4>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div className="space-y-2"><label htmlFor="ci-mortgage-payment" className="text-xs text-muted-foreground">{t("ci.obligations.mortgagePayment.label")}</label><CurrencyInput id="ci-mortgage-payment" value={expenses.mortgagePayment} onChange={(value) => handleExpense('mortgagePayment', value)} placeholder="15,000" error={Boolean(errors.mortgagePayment)} aria-describedby={errors.mortgagePayment ? 'ci-mortgage-payment-error' : undefined} /><FieldError id="ci-mortgage-payment-error" message={errors.mortgagePayment} /></div>
            <div className="space-y-2"><label htmlFor="ci-mortgage-installments" className="text-xs text-muted-foreground">{t("ci.obligations.mortgageInstallments.label")}</label><input id="ci-mortgage-installments" type="number" inputMode="numeric" min={0} max={600} step={1} value={expenses.mortgageInstallmentsRemaining || ''} onChange={(event) => handleInstallments('mortgageInstallmentsRemaining', event)} placeholder="60" aria-invalid={Boolean(errors.mortgageInstallmentsRemaining) || undefined} aria-describedby={describedBy('ci-mortgage-installments-help', errors.mortgageInstallmentsRemaining && 'ci-mortgage-installments-error')} className={`h-12 w-full rounded-md border bg-background/50 px-3 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${errors.mortgageInstallmentsRemaining ? 'border-destructive' : 'border-border/50'}`} /><p id="ci-mortgage-installments-help" className="text-xs text-muted-foreground">{t("ci.obligations.mortgageInstallmentsHelp.description")}</p><FieldError id="ci-mortgage-installments-error" message={errors.mortgageInstallmentsRemaining} /></div>
            <div className="space-y-2"><label htmlFor="ci-car-payment" className="text-xs text-muted-foreground">{t("ci.obligations.carPayment.label")}</label><CurrencyInput id="ci-car-payment" value={expenses.carPayment} onChange={(value) => handleExpense('carPayment', value)} placeholder="8,000" error={Boolean(errors.carPayment)} aria-describedby={errors.carPayment ? 'ci-car-payment-error' : undefined} /><FieldError id="ci-car-payment-error" message={errors.carPayment} /></div>
            <div className="space-y-2"><label htmlFor="ci-car-installments" className="text-xs text-muted-foreground">{t("ci.obligations.carInstallments.label")}</label><input id="ci-car-installments" type="number" inputMode="numeric" min={0} max={600} step={1} value={expenses.carInstallmentsRemaining || ''} onChange={(event) => handleInstallments('carInstallmentsRemaining', event)} placeholder="36" aria-invalid={Boolean(errors.carInstallmentsRemaining) || undefined} aria-describedby={describedBy('ci-car-installments-help', errors.carInstallmentsRemaining && 'ci-car-installments-error')} className={`h-12 w-full rounded-md border bg-background/50 px-3 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${errors.carInstallmentsRemaining ? 'border-destructive' : 'border-border/50'}`} /><p id="ci-car-installments-help" className="text-xs text-muted-foreground">{t("ci.obligations.mortgageInstallmentsHelp.description")}</p><FieldError id="ci-car-installments-error" message={errors.carInstallmentsRemaining} /></div>
          </div>
          <div className="mt-5 space-y-2"><label htmlFor="ci-other-debt-balance" className="text-xs text-muted-foreground">{t("ci.obligations.otherDebtBalance.label")}</label><CurrencyInput id="ci-other-debt-balance" value={expenses.otherDebtBalance} onChange={(value) => handleExpense('otherDebtBalance', value)} placeholder={t("ci.obligations.placeholder3")} error={Boolean(errors.otherDebtBalance)} aria-describedby={describedBy('ci-other-debt-balance-help', errors.otherDebtBalance && 'ci-other-debt-balance-error')} /><p id="ci-other-debt-balance-help" className="text-xs leading-5 text-muted-foreground">{t("ci.obligations.otherDebtBalanceHelp.description")}</p><FieldError id="ci-other-debt-balance-error" message={errors.otherDebtBalance} /></div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">{t("ci.obligations.description6")}</p>
        </section>
      </div>
    </details>
  );
}
