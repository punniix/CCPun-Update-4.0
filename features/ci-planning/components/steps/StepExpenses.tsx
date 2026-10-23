'use client';
import { usePublicCopy } from '@/components/ui/PublicCopyProvider';
import { CI_COPY_DEFAULTS } from '@/lib/content/tool-copy-defaults';


import CurrencyInput from '@/components/ui/CurrencyInput';
import type { CIEducationPlan, CIFormData, CIRecoveryCosts } from '@/features/ci-planning/calculator/types';
import { EMPTY_CI_RECOVERY } from '@/features/ci-planning/recovery-evidence';
import ExpenseObligationsSection from './ExpenseObligationsSection';
import RecoveryReserveSection from './RecoveryReserveSection';
import {
  baht,
  describedBy,
  safePlanPreview,
  safeRecoveryPreview,
  type ExpenseField,
} from './StepExpenses.model';

interface StepProps {
  data: CIFormData;
  updateData: (section: keyof CIFormData, value: CIFormData[keyof CIFormData]) => void;
  errors: Record<string, string>;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} role="alert" tabIndex={-1} className="text-sm text-[#ffb4b4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{message}</p>;
}

export default function StepExpenses({ data, updateData, errors }: StepProps) {
  const t = usePublicCopy(CI_COPY_DEFAULTS);

  const expenses = data.expenses;
  const { educationPlans, reserveYears } = expenses;
  const recovery: CIRecoveryCosts = expenses.recovery ?? { ...EMPTY_CI_RECOVERY };

  const updateExpenses = (nextExpenses: CIFormData['expenses']) => updateData('expenses', nextExpenses);
  const handleExpense = (field: ExpenseField, value: number) => updateExpenses({ ...expenses, [field]: value });
  const updateRecovery = (nextRecovery: CIRecoveryCosts) => updateExpenses({ ...expenses, recovery: nextRecovery });

  const handleInstallments = (field: 'mortgageInstallmentsRemaining' | 'carInstallmentsRemaining', event: React.ChangeEvent<HTMLInputElement>) => {
    handleExpense(field, event.target.value === '' ? 0 : Number(event.target.value));
  };

  const handleReserveYears = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (Number.isInteger(value) && value >= 1 && value <= 10) {
      updateExpenses({ ...expenses, reserveYears: value });
    }
  };

  const handleAddEducationPlan = () => {
    const nextIndex = educationPlans.length;
    updateExpenses({ ...expenses, educationPlans: [...educationPlans, { annualCost: 0, yearsRemaining: 0 }] });
    window.setTimeout(() => document.getElementById(`ci-education-${nextIndex}-annual-cost`)?.focus({ preventScroll: true }), 0);
  };

  const handleEducationPlan = (index: number, field: keyof CIEducationPlan, value: number) => {
    updateExpenses({
      ...expenses,
      educationPlans: educationPlans.map((plan, planIndex) => planIndex === index ? { ...plan, [field]: value } : plan),
    });
  };

  const handleEducationYears = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    handleEducationPlan(index, 'yearsRemaining', event.target.value === '' ? 0 : Number(event.target.value));
  };

  const handleRemoveEducationPlan = (index: number) => {
    updateExpenses({ ...expenses, educationPlans: educationPlans.filter((_, planIndex) => planIndex !== index) });
  };

  const recoveryPreview = safeRecoveryPreview(recovery);
  const planPreview = safePlanPreview(expenses, recoveryPreview.reserveNeed);
  const hasAdvancedData =
    educationPlans.length > 0
    || expenses.mortgagePayment > 0
    || expenses.mortgageInstallmentsRemaining > 0
    || expenses.carPayment > 0
    || expenses.carInstallmentsRemaining > 0
    || expenses.otherDebtBalance > 0;

  return <div className="space-y-5" data-ui="human-centered-ci-expenses">
    <p className="text-xs leading-6 text-white/70"><span className="font-medium text-white/85">{t.node("ci.expenses.label")}</span> {t.node("ci.expenses.description")}</p>

    <div className="space-y-2">
      <label htmlFor="ci-monthly-income" className="text-sm font-medium text-foreground">{t.node("ci.expenses.monthlyIncome.label")}</label>
      <CurrencyInput
        id="ci-monthly-income"
        value={expenses.monthlyIncome}
        onChange={(value) => handleExpense('monthlyIncome', value)}
        placeholder={t("ci.expenses.placeholder")}
        error={Boolean(errors.monthlyIncome || errors.expenses)}
        aria-describedby={describedBy('ci-monthly-income-help', errors.monthlyIncome && 'ci-monthly-income-error', errors.expenses && 'ci-expenses-error')}
      />
      <p id="ci-monthly-income-help" className="text-xs leading-6 text-white/70">{t.node("ci.expenses.monthlyIncomeHelp.description")}</p>
      <FieldError id="ci-monthly-income-error" message={errors.monthlyIncome} />
    </div>

    <div className="space-y-2">
      <label htmlFor="ci-household" className="text-sm font-medium text-foreground">{t.node("ci.expenses.household.label")}</label>
      <CurrencyInput
        id="ci-household"
        value={expenses.household}
        onChange={(value) => handleExpense('household', value)}
        placeholder={t("ci.expenses.placeholder2")}
        error={Boolean(errors.household || errors.expenses)}
        aria-describedby={describedBy('ci-household-help', errors.household && 'ci-household-error', errors.expenses && 'ci-expenses-error')}
      />
      <p id="ci-household-help" className="text-xs leading-6 text-white/70">{t.node("ci.expenses.householdHelp.description")}</p>
      <FieldError id="ci-household-error" message={errors.household} />
    </div>

    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">{t.node("ci.expenses.groupLabel")}</legend>
      <div className="flex items-center justify-between text-xs text-white/70">
        <span>{t.node("ci.expenses.label2")}</span>
        <output htmlFor="ci-reserve-years" className="text-base font-semibold tabular-nums text-primary">{reserveYears} {t.node("ci.expenses.reserveYears.label")}</output>
        <span>{t.node("ci.expenses.label3")}</span>
      </div>
      <input
        id="ci-reserve-years"
        type="range"
        min={1}
        max={10}
        step={1}
        value={reserveYears}
        onChange={handleReserveYears}
        className="min-h-11 w-full cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t("ci.expenses.ariaLabel")}
        aria-invalid={Boolean(errors.reserveYears) || undefined}
        aria-describedby={errors.reserveYears ? 'ci-reserve-years-error' : undefined}
      />
      <FieldError id="ci-reserve-years-error" message={errors.reserveYears} />
    </fieldset>

    {errors.expenses && <p id="ci-expenses-error" role="alert" tabIndex={-1} className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-[#ffb4b4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{errors.expenses}</p>}

    <ExpenseObligationsSection
      open={hasAdvancedData}
      educationPlans={educationPlans}
      expenses={expenses}
      errors={errors}
      planPreview={planPreview}
      handleAddEducationPlan={handleAddEducationPlan}
      handleEducationPlan={handleEducationPlan}
      handleEducationYears={handleEducationYears}
      handleRemoveEducationPlan={handleRemoveEducationPlan}
      handleExpense={handleExpense}
      handleInstallments={handleInstallments}
    />

    {planPreview && <aside className="sticky top-24 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-background p-4 text-sm" aria-label={t("ci.expenses.ariaLabel2")}>
      {planPreview.expenseBaseNeed > 0 && <span>{t.node("ci.expenses.label4")}<strong className="tabular-nums text-primary">{baht(planPreview.expenseTotalNeed)}</strong></span>}
      {planPreview.incomeBaseNeed > 0 && <span>{t.node("ci.expenses.label5")}<strong className="tabular-nums text-primary">{baht(planPreview.incomeTotalNeed)}</strong></span>}
      <a href="#ci-plan-preview" className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">{t.node("ci.expenses.linkLabel")}</a>
    </aside>}
    <RecoveryReserveSection
      recovery={recovery}
      errors={errors}
      recoveryPreview={recoveryPreview}
      onChangeRecovery={updateRecovery}
    />

    {planPreview ? <dl id="ci-plan-preview" style={{ scrollMarginTop: 96 }} className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-white/10 pt-4 text-sm sm:grid-cols-3 lg:grid-cols-4">
      <div className="min-w-0"><dt className="leading-5 text-white/70">{t.node("ci.expenses.metricLabel")}</dt><dd className="mt-1 text-base font-medium leading-6 text-white/90 tabular-nums [overflow-wrap:anywhere]">{baht(planPreview.householdNeed)}</dd></div>
      <div className="min-w-0"><dt className="leading-5 text-white/70">{t.node("ci.expenses.metricLabel2")}</dt><dd className="mt-1 text-base font-medium leading-6 text-white/90 tabular-nums [overflow-wrap:anywhere]">{baht(planPreview.educationNeed)}</dd></div>
      <div className="min-w-0"><dt className="leading-5 text-white/70">{t.node("ci.expenses.metricLabel3")}</dt><dd className="mt-1 text-base font-medium leading-6 text-white/90 tabular-nums [overflow-wrap:anywhere]">{baht(planPreview.debtNeed)}</dd></div>
      <div className="min-w-0"><dt className="leading-5 text-white/70">{t.node("ci.expenses.metricLabel4")}</dt><dd className="mt-1 text-base font-medium leading-6 text-white/90 tabular-nums [overflow-wrap:anywhere]">{planPreview.incomeBaseNeed > 0 ? baht(planPreview.incomeBaseNeed) : '—'}</dd></div>
      <div className="min-w-0"><dt className="leading-5 text-white/70">{t.node("ci.expenses.metricLabel5")}</dt><dd className="mt-1 text-base font-medium leading-6 text-white/90 tabular-nums [overflow-wrap:anywhere]">{baht(recoveryPreview.reserveNeed)}</dd></div>
      <div className="min-w-0"><dt className="leading-5 text-white/70">{t.node("ci.expenses.metricLabel6")}</dt><dd className="mt-1 text-base font-semibold leading-6 text-primary tabular-nums [overflow-wrap:anywhere]">{planPreview.expenseBaseNeed > 0 ? baht(planPreview.expenseTotalNeed) : '—'}</dd></div>
      <div className="min-w-0"><dt className="leading-5 text-white/70">{t.node("ci.expenses.metricLabel7")}</dt><dd className="mt-1 text-base font-semibold leading-6 text-primary tabular-nums [overflow-wrap:anywhere]">{planPreview.incomeBaseNeed > 0 ? baht(planPreview.incomeTotalNeed) : '—'}</dd></div>
    </dl> : <p id="ci-preview-range-warning" role="status" className="border-t border-white/10 pt-4 text-xs leading-5 text-[#ffb4b4]">{t.node("ci.expenses.previewRangeWarning.description")}</p>}
  </div>;
}
