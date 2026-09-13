'use client';

import { GraduationCap, Plus, Trash2, Wallet } from 'lucide-react';
import CurrencyInput from '@/components/ui/CurrencyInput';
import { calcDebtNeed, calcHouseholdNeed } from '@/features/ci-planning/calculator/calculator';
import type { CIEducationPlan, CIFormData } from '@/features/ci-planning/calculator/types';

interface StepProps {
  data: CIFormData;
  updateData: (section: keyof CIFormData, value: CIFormData[keyof CIFormData]) => void;
  errors: Record<string, string>;
}

type ExpenseField =
  | 'monthlyIncome'
  | 'household'
  | 'mortgagePayment'
  | 'mortgageInstallmentsRemaining'
  | 'carPayment'
  | 'carInstallmentsRemaining'
  | 'otherDebtBalance';

function baht(value: number) {
  return `${Math.round(value).toLocaleString('th-TH')} บาท`;
}

function describedBy(...ids: Array<string | false | undefined>) {
  return ids.filter(Boolean).join(' ') || undefined;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;

  return (
    <p id={id} role="alert" tabIndex={-1} className="text-sm text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {message}
    </p>
  );
}

function previewInstallments(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= 600 ? value : 0;
}

function previewEducationSubtotal(plan: CIEducationPlan) {
  const annualCost = Number.isFinite(plan.annualCost) && plan.annualCost > 0 ? plan.annualCost : 0;
  const years = Number.isInteger(plan.yearsRemaining) && plan.yearsRemaining > 0
    ? plan.yearsRemaining
    : 0;
  return annualCost * years;
}

export default function StepExpenses({ data, updateData, errors }: StepProps) {
  const expenses = data.expenses;
  const { educationPlans, reserveYears } = expenses;

  const updateExpenses = (nextExpenses: CIFormData['expenses']) => {
    updateData('expenses', nextExpenses);
  };

  const handleExpense = (field: ExpenseField, value: number) => {
    updateExpenses({ ...expenses, [field]: value });
  };

  const handleInstallments = (
    field: 'mortgageInstallmentsRemaining' | 'carInstallmentsRemaining',
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.target.value === '' ? 0 : Number(event.target.value);
    handleExpense(field, value);
  };

  const handleReserveYears = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (Number.isInteger(value) && value >= 1 && value <= 10) {
      updateExpenses({ ...expenses, reserveYears: value });
    }
  };

  const handleAddEducationPlan = () => {
    const nextIndex = educationPlans.length;
    updateExpenses({
      ...expenses,
      educationPlans: [...educationPlans, { annualCost: 0, yearsRemaining: 0 }],
    });

    window.setTimeout(() => {
      document.getElementById(`ci-education-${nextIndex}-annual-cost`)?.focus({ preventScroll: true });
    }, 0);
  };

  const handleEducationPlan = (
    index: number,
    field: keyof CIEducationPlan,
    value: number,
  ) => {
    const nextPlans = educationPlans.map((plan, planIndex) => (
      planIndex === index ? { ...plan, [field]: value } : plan
    ));
    updateExpenses({ ...expenses, educationPlans: nextPlans });
  };

  const handleEducationYears = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value === '' ? 0 : Number(event.target.value);
    handleEducationPlan(index, 'yearsRemaining', value);
  };

  const handleRemoveEducationPlan = (index: number) => {
    updateExpenses({
      ...expenses,
      educationPlans: educationPlans.filter((_, planIndex) => planIndex !== index),
    });
  };

  const householdNeed = calcHouseholdNeed(expenses.household, reserveYears);
  const educationNeed = educationPlans.reduce(
    (total, plan) => total + previewEducationSubtotal(plan),
    0,
  );
  const mortgageDebtNeed = calcDebtNeed(
    expenses.mortgagePayment,
    previewInstallments(expenses.mortgageInstallmentsRemaining),
    reserveYears,
  );
  const carDebtNeed = calcDebtNeed(
    expenses.carPayment,
    previewInstallments(expenses.carInstallmentsRemaining),
    reserveYears,
  );
  const otherDebtBalance = Number.isFinite(expenses.otherDebtBalance) && expenses.otherDebtBalance >= 0
    ? expenses.otherDebtBalance
    : 0;
  const debtNeed = mortgageDebtNeed + carDebtNeed + otherDebtBalance;
  const calculatedNeed = householdNeed + educationNeed + debtNeed;

  return (
    <div className="form-glass space-y-8 p-5 md:p-8 lg:p-10">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Wallet className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h2 tabIndex={-1} className="scroll-mt-28 rounded-sm text-xl font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">รายได้ ภาระ และระยะที่ต้องการวางแผน</h2>
          <p className="text-sm text-muted-foreground">อย่างน้อยกรอกรายได้ หรือค่าใช้จ่ายและภาระ 1 รายการ ช่องอื่นเว้นได้</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">เริ่มจากข้อมูลที่แน่ใจก่อน แล้วค่อยเติมส่วนที่ต้องการนำมาดูในแผนนี้</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="ci-monthly-income" className="text-sm font-semibold text-foreground">
            รายได้ต่อเดือน
          </label>
          <CurrencyInput
            id="ci-monthly-income"
            value={expenses.monthlyIncome}
            onChange={(value) => handleExpense('monthlyIncome', value)}
            placeholder="เช่น 50,000"
            error={Boolean(errors.monthlyIncome || errors.expenses)}
            aria-describedby={describedBy(
              'ci-monthly-income-help',
              errors.monthlyIncome && 'ci-monthly-income-error',
              errors.expenses && 'ci-expenses-error',
            )}
          />
          <p id="ci-monthly-income-help" className="text-sm leading-relaxed text-muted-foreground">
            กรอกเมื่อต้องการดูทุนตามรายได้ ระบบจะแสดงแยกจากทุนตามรายจ่าย
          </p>
          <FieldError id="ci-monthly-income-error" message={errors.monthlyIncome} />
        </div>

        <div className="space-y-2">
          <label htmlFor="ci-household" className="text-sm font-semibold text-foreground">
            ค่าใช้จ่ายครัวเรือนรวมต่อเดือน
          </label>
          <CurrencyInput
            id="ci-household"
            value={expenses.household}
            onChange={(value) => handleExpense('household', value)}
            placeholder="เช่น 20,000"
            error={Boolean(errors.household || errors.expenses)}
            aria-describedby={describedBy(
              'ci-household-help',
              errors.household && 'ci-household-error',
              errors.expenses && 'ci-expenses-error',
            )}
          />
          <p id="ci-household-help" className="text-sm leading-relaxed text-muted-foreground">
            รวมรายจ่ายจำเป็นของคนในบ้านที่ต้องดูแลต่อในแต่ละเดือน
          </p>
          <FieldError id="ci-household-error" message={errors.household} />
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-foreground">ถ้าต้องหยุดทำงานเพื่อรักษาตัวจากโรคร้ายแรง ต้องการเตรียมเงินก้อนสำรองไว้กี่ปี? (คิดจากรายจ่ายหรือรายได้)</legend>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">1 ปี</span>
            <output htmlFor="ci-reserve-years" className="text-lg font-bold tabular-nums text-primary">
              {reserveYears} ปี
            </output>
            <span className="text-sm text-muted-foreground">10 ปี</span>
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
      </div>

      <section aria-labelledby="ci-education-title" className="border-y border-border/30 py-6">
        <div className="flex items-start gap-3">
          <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h3 id="ci-education-title" className="font-semibold text-foreground">แผนการศึกษาบุตร (ถ้ามี)</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              เพิ่มแยกเป็นรายคน โดยกรอกค่าใช้จ่ายต่อปีและจำนวนปีที่คุณคาดว่าจะส่งเรียนต่อ
            </p>
          </div>
        </div>

        {educationPlans.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-border/40 bg-background/20 p-5 text-center">
            <p className="text-sm text-muted-foreground">หากไม่มีแผนการศึกษาบุตร ไม่ต้องเพิ่มข้อมูลส่วนนี้</p>
            <button
              type="button"
              onClick={handleAddEducationPlan}
              className="glass-button mt-4 inline-flex min-h-11 items-center justify-center gap-2 px-5"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              เพิ่มบุตร
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-6">
            {educationPlans.map((plan, index) => {
              const annualCostError = errors[`educationPlans.${index}.annualCost`];
              const yearsError = errors[`educationPlans.${index}.yearsRemaining`];
              const annualCostId = `ci-education-${index}-annual-cost`;
              const yearsId = `ci-education-${index}-years`;

              return (
                <fieldset key={index} className="border-l-2 border-primary/30 pl-4 md:pl-5">
                  <legend className="flex w-full items-center justify-between gap-4 pb-3 font-semibold text-foreground">
                    <span>บุตรคนที่ {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveEducationPlan(index)}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`ลบแผนการศึกษาบุตรคนที่ ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </legend>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label htmlFor={annualCostId} className="text-sm text-muted-foreground">ค่าใช้จ่ายการศึกษาต่อปี</label>
                      <CurrencyInput
                        id={annualCostId}
                        value={plan.annualCost}
                        onChange={(value) => handleEducationPlan(index, 'annualCost', value)}
                        placeholder="เช่น 60,000"
                        error={Boolean(annualCostError)}
                        aria-describedby={annualCostError ? `${annualCostId}-error` : undefined}
                      />
                      <FieldError id={`${annualCostId}-error`} message={annualCostError} />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor={yearsId} className="text-sm text-muted-foreground">ต้องเตรียมต่ออีกกี่ปี</label>
                      <input
                        id={yearsId}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={30}
                        step={1}
                        value={plan.yearsRemaining || ''}
                        onChange={(event) => handleEducationYears(index, event)}
                        placeholder="เช่น 10"
                        aria-invalid={Boolean(yearsError) || undefined}
                        aria-describedby={describedBy(`${yearsId}-help`, yearsError && `${yearsId}-error`)}
                        className={`h-12 w-full rounded-md border bg-background/50 px-3 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${yearsError ? 'border-destructive' : 'border-border/50'}`}
                      />
                      <p id={`${yearsId}-help`} className="text-sm text-muted-foreground">1–30 ปี</p>
                      <FieldError id={`${yearsId}-error`} message={yearsError} />
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-muted-foreground">
                    ทุนการศึกษาบุตรคนที่ {index + 1}: <strong className="font-semibold tabular-nums text-foreground">{baht(previewEducationSubtotal(plan))}</strong>
                  </p>
                </fieldset>
              );
            })}

            <div className="flex flex-col gap-3 border-t border-border/25 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                รวมทุนการศึกษา: <strong className="font-semibold tabular-nums text-foreground">{baht(educationNeed)}</strong>
              </p>
              <button
                type="button"
                onClick={handleAddEducationPlan}
                className="glass-button inline-flex min-h-11 items-center justify-center gap-2 px-5"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                เพิ่มบุตร
              </button>
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="ci-debt-title" className="rounded-xl border border-border/30 bg-background/20 p-4">
        <h3 id="ci-debt-title" className="text-sm font-semibold text-foreground">ภาระหนี้ที่ยังเหลือ (ถ้ามี)</h3>
        <div className="space-y-7 pt-5">
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-foreground">สินเชื่อบ้าน</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="ci-mortgage-payment" className="text-sm text-muted-foreground">ค่างวดต่อเดือน</label>
                <CurrencyInput
                  id="ci-mortgage-payment"
                  value={expenses.mortgagePayment}
                  onChange={(value) => handleExpense('mortgagePayment', value)}
                  placeholder="15,000"
                  error={Boolean(errors.mortgagePayment)}
                  aria-describedby={errors.mortgagePayment ? 'ci-mortgage-payment-error' : undefined}
                />
                <FieldError id="ci-mortgage-payment-error" message={errors.mortgagePayment} />
              </div>
              <div className="space-y-2">
                <label htmlFor="ci-mortgage-installments" className="text-sm text-muted-foreground">จำนวนงวดที่เหลือ</label>
                <input
                  id="ci-mortgage-installments"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={600}
                  step={1}
                  value={expenses.mortgageInstallmentsRemaining || ''}
                  onChange={(event) => handleInstallments('mortgageInstallmentsRemaining', event)}
                  placeholder="60"
                  aria-invalid={Boolean(errors.mortgageInstallmentsRemaining) || undefined}
                  aria-describedby={describedBy('ci-mortgage-installments-help', errors.mortgageInstallmentsRemaining && 'ci-mortgage-installments-error')}
                  className={`h-12 w-full rounded-md border bg-background/50 px-3 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${errors.mortgageInstallmentsRemaining ? 'border-destructive' : 'border-border/50'}`}
                />
                <p id="ci-mortgage-installments-help" className="text-sm text-muted-foreground">0–600 งวด</p>
                <FieldError id="ci-mortgage-installments-error" message={errors.mortgageInstallmentsRemaining} />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-foreground">สินเชื่อรถ</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="ci-car-payment" className="text-sm text-muted-foreground">ค่างวดต่อเดือน</label>
                <CurrencyInput
                  id="ci-car-payment"
                  value={expenses.carPayment}
                  onChange={(value) => handleExpense('carPayment', value)}
                  placeholder="8,000"
                  error={Boolean(errors.carPayment)}
                  aria-describedby={errors.carPayment ? 'ci-car-payment-error' : undefined}
                />
                <FieldError id="ci-car-payment-error" message={errors.carPayment} />
              </div>
              <div className="space-y-2">
                <label htmlFor="ci-car-installments" className="text-sm text-muted-foreground">จำนวนงวดที่เหลือ</label>
                <input
                  id="ci-car-installments"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={600}
                  step={1}
                  value={expenses.carInstallmentsRemaining || ''}
                  onChange={(event) => handleInstallments('carInstallmentsRemaining', event)}
                  placeholder="36"
                  aria-invalid={Boolean(errors.carInstallmentsRemaining) || undefined}
                  aria-describedby={describedBy('ci-car-installments-help', errors.carInstallmentsRemaining && 'ci-car-installments-error')}
                  className={`h-12 w-full rounded-md border bg-background/50 px-3 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${errors.carInstallmentsRemaining ? 'border-destructive' : 'border-border/50'}`}
                />
                <p id="ci-car-installments-help" className="text-sm text-muted-foreground">0–600 งวด</p>
                <FieldError id="ci-car-installments-error" message={errors.carInstallmentsRemaining} />
              </div>
            </div>
          </fieldset>

          <div className="space-y-2 border-t border-border/25 pt-5">
            <label htmlFor="ci-other-debt-balance" className="text-sm font-semibold text-foreground">
              หนี้อื่นๆ คงเหลือทั้งหมด
            </label>
            <CurrencyInput
              id="ci-other-debt-balance"
              value={expenses.otherDebtBalance}
              onChange={(value) => handleExpense('otherDebtBalance', value)}
              placeholder="เช่น 100,000"
              error={Boolean(errors.otherDebtBalance)}
              aria-describedby={describedBy('ci-other-debt-balance-help', errors.otherDebtBalance && 'ci-other-debt-balance-error')}
            />
            <p id="ci-other-debt-balance-help" className="text-sm leading-relaxed text-muted-foreground">
              รวมยอดคงเหลือของบัตรเครดิต สินเชื่อส่วนบุคคล หรือหนี้อื่นที่ไม่ใช่บ้านและรถ แล้วกรอกครั้งเดียว
            </p>
            <FieldError id="ci-other-debt-balance-error" message={errors.otherDebtBalance} />
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground">
            ค่างวดบ้านและรถนับตามงวดที่เหลือภายในช่วงที่เลือก ส่วนหนี้อื่นนับจากยอดคงเหลือครั้งเดียว
          </p>
        </div>
      </section>

      {errors.expenses && (
        <p id="ci-expenses-error" role="alert" tabIndex={-1} className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {errors.expenses}
        </p>
      )}

      <dl className="grid gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">ทุนครัวเรือน</dt>
          <dd className="mt-1 font-semibold tabular-nums text-foreground">{baht(householdNeed)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">ทุนการศึกษา</dt>
          <dd className="mt-1 font-semibold tabular-nums text-foreground">{baht(educationNeed)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">ภาระหนี้รวม</dt>
          <dd className="mt-1 font-semibold tabular-nums text-foreground">{baht(debtNeed)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">ทุนตามรายจ่าย</dt>
          <dd className="mt-1 font-bold tabular-nums text-primary">{baht(calculatedNeed)}</dd>
        </div>
      </dl>
    </div>
  );
}
