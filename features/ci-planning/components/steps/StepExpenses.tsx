'use client';

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
  return <p id={id} role="alert" tabIndex={-1} className="text-sm text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{message}</p>;
}

export default function StepExpenses({ data, updateData, errors }: StepProps) {
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
    <p className="text-xs leading-5 text-white/45"><span className="font-medium text-white/65">รายได้ ภาระ และระยะที่ต้องการวางแผน</span> · อย่างน้อยกรอกรายได้ หรือค่าใช้จ่ายและภาระ 1 รายการ ช่องอื่นเว้นได้</p>

    <div className="space-y-2">
      <label htmlFor="ci-monthly-income" className="text-sm font-medium text-foreground">รายได้ต่อเดือน</label>
      <CurrencyInput
        id="ci-monthly-income"
        value={expenses.monthlyIncome}
        onChange={(value) => handleExpense('monthlyIncome', value)}
        placeholder="เช่น 50,000"
        error={Boolean(errors.monthlyIncome || errors.expenses)}
        aria-describedby={describedBy('ci-monthly-income-help', errors.monthlyIncome && 'ci-monthly-income-error', errors.expenses && 'ci-expenses-error')}
      />
      <p id="ci-monthly-income-help" className="text-xs leading-5 text-white/45">กรอกเมื่อต้องการดูทุนตามรายได้ ระบบจะแสดงแยกจากทุนตามรายจ่าย</p>
      <FieldError id="ci-monthly-income-error" message={errors.monthlyIncome} />
    </div>

    <div className="space-y-2">
      <label htmlFor="ci-household" className="text-sm font-medium text-foreground">รายจ่ายครัวเรือนต่อเดือน</label>
      <CurrencyInput
        id="ci-household"
        value={expenses.household}
        onChange={(value) => handleExpense('household', value)}
        placeholder="เช่น 20,000"
        error={Boolean(errors.household || errors.expenses)}
        aria-describedby={describedBy('ci-household-help', errors.household && 'ci-household-error', errors.expenses && 'ci-expenses-error')}
      />
      <p id="ci-household-help" className="text-xs leading-5 text-white/45">รวมรายจ่ายจำเป็นของคนในบ้านที่ต้องดูแลต่อ</p>
      <FieldError id="ci-household-error" message={errors.household} />
    </div>

    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">ต้องการเตรียมเงินก้อนให้รองรับกี่ปี?</legend>
      <div className="flex items-center justify-between text-xs text-white/45">
        <span>1 ปี</span>
        <output htmlFor="ci-reserve-years" className="text-base font-semibold tabular-nums text-primary">{reserveYears} ปี</output>
        <span>10 ปี</span>
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
        aria-label="จำนวนปีที่ต้องการเตรียมเงินก้อนสำรอง หากต้องหยุดทำงานเพื่อรักษาตัวจากโรคร้ายแรง"
        aria-invalid={Boolean(errors.reserveYears) || undefined}
        aria-describedby={errors.reserveYears ? 'ci-reserve-years-error' : undefined}
      />
      <FieldError id="ci-reserve-years-error" message={errors.reserveYears} />
    </fieldset>

    {errors.expenses && <p id="ci-expenses-error" role="alert" tabIndex={-1} className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{errors.expenses}</p>}

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

    <RecoveryReserveSection
      recovery={recovery}
      errors={errors}
      recoveryPreview={recoveryPreview}
      onChangeRecovery={updateRecovery}
    />

    {planPreview ? <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-white/10 pt-4 text-xs sm:grid-cols-3 lg:grid-cols-6">
      <div><dt className="text-white/40">ครัวเรือน</dt><dd className="mt-1 font-medium text-white/80">{baht(planPreview.householdNeed)}</dd></div>
      <div><dt className="text-white/40">การศึกษา</dt><dd className="mt-1 font-medium text-white/80">{baht(planPreview.educationNeed)}</dd></div>
      <div><dt className="text-white/40">ภาระหนี้รวม</dt><dd className="mt-1 font-medium text-white/80">{baht(planPreview.debtNeed)}</dd></div>
      <div><dt className="text-white/40">Recovery Reserve</dt><dd className="mt-1 font-medium text-white/80">{baht(recoveryPreview.reserveNeed)}</dd></div>
      <div><dt className="text-white/40">ทุนตามรายจ่ายรวม</dt><dd className="mt-1 font-semibold text-primary">{planPreview.expenseBaseNeed > 0 ? baht(planPreview.expenseTotalNeed) : '—'}</dd></div>
      <div><dt className="text-white/40">ทุนตามรายได้รวม</dt><dd className="mt-1 font-semibold text-primary">{planPreview.incomeBaseNeed > 0 ? baht(planPreview.incomeTotalNeed) : '—'}</dd></div>
    </dl> : <p id="ci-preview-range-warning" role="status" className="border-t border-white/10 pt-4 text-xs leading-5 text-destructive">ตัวเลขบางส่วนสูงเกินช่วงที่เครื่องมือนี้แสดงตัวอย่างระหว่างกรอกได้ กรุณาตรวจสอบข้อมูลก่อนดำเนินการต่อ ระบบจะไม่คำนวณผลลัพธ์จากค่าที่เกินช่วงอย่างเงียบ ๆ</p>}
  </div>;
}
