import type {
  AssetItem,
  CashflowItem,
  FaEmploymentType,
  FinancialPosition,
  LiabilityItem,
} from "../../../lib/admin/financial-planning/contracts";
import {
  FA_BENCHMARK_PENDING,
  FA_BENCHMARK_SET_VERSION,
  FA_BENCHMARKS,
  FA_EMERGENCY_FUND_SELF_EMPLOYED,
  type FaBenchmarkRule,
  type FaRatioId,
} from "./benchmarks";
import { formatMonths, formatPercent } from "./format";

/**
 * Financial position calculations (สถานะการเงิน + อัตราส่วน).
 *
 * Pure functions only: the same input always gives the same output, nothing is
 * read from the network, clock, storage or environment, and nothing is logged.
 * Missing amounts (null) are never treated as zero silently: they are left out
 * of the totals and reported, and any ratio that depends on them is flagged.
 */

export const FA_ADVICE_DISCLAIMER =
  "ตัวเลขนี้คำนวณจากข้อมูลที่กรอกและเกณฑ์ที่ยังรอปั้นยืนยัน ใช้ประกอบการคุยเท่านั้น ยังไม่ใช่คำแนะนำเฉพาะบุคคลจนกว่าปั้นจะตรวจทาน" as const;

export type FaRatioStatus = "good" | "watch" | "adjust" | "unavailable";

export type FaUnavailableReason =
  | "no-income"
  | "no-expense"
  | "no-assets"
  | "net-worth-not-positive";

export type FaRatioResult = {
  id: FaRatioId;
  label: string;
  formula: string;
  value: number | null;
  display: string;
  status: FaRatioStatus;
  unavailableReason: FaUnavailableReason | null;
  /** True when an input this ratio depends on was left blank. */
  incompleteInputs: boolean;
  benchmarkConfirmation: string;
};

export type FaMissingSection = "income" | "expense" | "assets" | "liabilities" | "debtPayments";

export type FaPositionSummary = {
  monthlyIncome: number;
  monthlyExpenseEntered: number;
  monthlyDebtPayments: number;
  monthlyMortgagePayments: number;
  /** Entered expenses plus debt payments pulled from the liabilities table. */
  monthlyExpenseTotal: number;
  monthlySavingContributions: number;
  monthlySurplus: number;
  assetsLiquid: number;
  assetsInvest: number;
  assetsPersonal: number;
  assetsTotal: number;
  liabilitiesTotal: number;
  netWorth: number;
  missing: Record<FaMissingSection, number>;
  complete: boolean;
};

export type FaFinancialAnalysis = {
  summary: FaPositionSummary;
  ratios: FaRatioResult[];
  disclaimer: typeof FA_ADVICE_DISCLAIMER;
  benchmarkSetVersion: string;
};

function monthly(item: Pick<CashflowItem, "amount" | "frequency">): number {
  if (item.amount === null) return 0;
  return item.frequency === "yearly" ? item.amount / 12 : item.amount;
}

function sumKnown<T>(items: readonly T[], pick: (item: T) => number | null): { total: number; missing: number } {
  let total = 0;
  let missing = 0;
  for (const item of items) {
    const value = pick(item);
    if (value === null || !Number.isFinite(value)) missing += 1;
    else total += value;
  }
  return { total, missing };
}

export function summarizeFinancialPosition(position: FinancialPosition): FaPositionSummary {
  const income = position.cashflow.filter((item) => item.direction === "income");
  const expense = position.cashflow.filter((item) => item.direction === "expense");

  const incomeSum = sumKnown(income, (item) => (item.amount === null ? null : monthly(item)));
  const expenseSum = sumKnown(expense, (item) => (item.amount === null ? null : monthly(item)));
  const savingSum = sumKnown(
    expense.filter((item) => item.expenseKind === "saving"),
    (item) => (item.amount === null ? null : monthly(item)),
  );
  const debtPayments = sumKnown(position.liabilities, (item: LiabilityItem) => item.monthlyPayment);
  const mortgagePayments = sumKnown(
    position.liabilities.filter((item) => item.kind === "mortgage"),
    (item) => item.monthlyPayment,
  );
  const liabilities = sumKnown(position.liabilities, (item) => item.balance);
  const byLiquidity = (kind: AssetItem["liquidity"]) =>
    sumKnown(position.assets.filter((item) => item.liquidity === kind), (item) => item.value);
  const liquid = byLiquidity("liquid");
  const invest = byLiquidity("invest");
  const personal = byLiquidity("personal");

  const monthlyExpenseTotal = expenseSum.total + debtPayments.total;
  const assetsTotal = liquid.total + invest.total + personal.total;
  const missing: Record<FaMissingSection, number> = {
    income: incomeSum.missing,
    expense: expenseSum.missing,
    assets: liquid.missing + invest.missing + personal.missing,
    liabilities: liabilities.missing,
    debtPayments: debtPayments.missing,
  };

  return {
    monthlyIncome: incomeSum.total,
    monthlyExpenseEntered: expenseSum.total,
    monthlyDebtPayments: debtPayments.total,
    monthlyMortgagePayments: mortgagePayments.total,
    monthlyExpenseTotal,
    monthlySavingContributions: savingSum.total,
    monthlySurplus: incomeSum.total - monthlyExpenseTotal,
    assetsLiquid: liquid.total,
    assetsInvest: invest.total,
    assetsPersonal: personal.total,
    assetsTotal,
    liabilitiesTotal: liabilities.total,
    netWorth: assetsTotal - liabilities.total,
    missing,
    complete: Object.values(missing).every((count) => count === 0),
  };
}

export function rateAgainstRule(value: number, rule: FaBenchmarkRule): Exclude<FaRatioStatus, "unavailable"> {
  if (rule.direction === "higher-is-better") {
    if (value >= rule.goodMin) return "good";
    if (rule.watchMin !== undefined && value >= rule.watchMin) return "watch";
    return "adjust";
  }
  if (value <= rule.goodMax) return "good";
  if (rule.watchMax !== undefined && value <= rule.watchMax) return "watch";
  return "adjust";
}

function ratio(
  id: FaRatioId,
  input: {
    value: number | null;
    unavailableReason: FaUnavailableReason | null;
    incompleteInputs: boolean;
    rule?: FaBenchmarkRule;
    statusOverride?: Exclude<FaRatioStatus, "unavailable">;
  },
): FaRatioResult {
  const benchmark = FA_BENCHMARKS[id];
  const rule = input.rule ?? benchmark.rule;
  const available = input.value !== null && Number.isFinite(input.value);
  const status: FaRatioStatus = input.statusOverride
    ?? (available ? rateAgainstRule(input.value as number, rule) : "unavailable");
  const display = available
    ? benchmark.unit === "months" ? formatMonths(input.value) : formatPercent(input.value)
    : "—";
  return {
    id,
    label: benchmark.label,
    formula: benchmark.formula,
    value: available ? (input.value as number) : null,
    display,
    status,
    unavailableReason: available ? null : input.unavailableReason,
    incompleteInputs: input.incompleteInputs,
    benchmarkConfirmation: benchmark.confirmation,
  };
}

export function calculateFinancialRatios(
  summary: FaPositionSummary,
  employment: FaEmploymentType = "salaried",
): FaRatioResult[] {
  const { missing } = summary;
  const hasIncome = summary.monthlyIncome > 0;
  const incomeIncomplete = missing.income > 0;

  const emergencyRule = employment === "self_employed" ? FA_EMERGENCY_FUND_SELF_EMPLOYED.rule : undefined;
  const emergency = ratio("emergency_fund", {
    value: summary.monthlyExpenseTotal > 0 ? summary.assetsLiquid / summary.monthlyExpenseTotal : null,
    unavailableReason: "no-expense",
    incompleteInputs: missing.assets > 0 || missing.expense > 0 || missing.debtPayments > 0,
    rule: emergencyRule,
  });

  const saved = summary.monthlySavingContributions + Math.max(summary.monthlySurplus, 0);
  const savings = ratio("savings_rate", {
    value: hasIncome ? saved / summary.monthlyIncome : null,
    unavailableReason: "no-income",
    incompleteInputs: incomeIncomplete || missing.expense > 0 || missing.debtPayments > 0,
  });

  const debtService = ratio("debt_service", {
    value: hasIncome ? summary.monthlyDebtPayments / summary.monthlyIncome : null,
    unavailableReason: "no-income",
    incompleteInputs: incomeIncomplete || missing.debtPayments > 0,
  });

  const housing = ratio("housing_debt_service", {
    value: hasIncome ? summary.monthlyMortgagePayments / summary.monthlyIncome : null,
    unavailableReason: "no-income",
    incompleteInputs: incomeIncomplete || missing.debtPayments > 0,
  });

  // Debt with no recorded assets cannot be a ratio, but it is clearly over the
  // benchmark, so it is reported as "adjust" instead of being hidden.
  const debtToAsset = summary.assetsTotal > 0
    ? ratio("debt_to_asset", {
      value: summary.liabilitiesTotal / summary.assetsTotal,
      unavailableReason: null,
      incompleteInputs: missing.assets > 0 || missing.liabilities > 0,
    })
    : {
      ...ratio("debt_to_asset", {
        value: null,
        unavailableReason: "no-assets",
        incompleteInputs: missing.assets > 0 || missing.liabilities > 0,
      }),
      ...(summary.liabilitiesTotal > 0 ? { status: "adjust" as const } : {}),
    };

  // A negative or zero net worth makes this ratio meaningless (dividing by a
  // negative flips its sign), so it is reported as unavailable with a reason.
  const investment = ratio("investment_to_net_worth", {
    value: summary.netWorth > 0 ? summary.assetsInvest / summary.netWorth : null,
    unavailableReason: "net-worth-not-positive",
    incompleteInputs: missing.assets > 0 || missing.liabilities > 0,
  });

  return [emergency, savings, debtService, housing, debtToAsset, investment];
}

export function analyzeFinancialPosition(
  position: FinancialPosition,
  employment: FaEmploymentType = "salaried",
): FaFinancialAnalysis {
  const summary = summarizeFinancialPosition(position);
  return {
    summary,
    ratios: calculateFinancialRatios(summary, employment),
    disclaimer: FA_ADVICE_DISCLAIMER,
    benchmarkSetVersion: FA_BENCHMARK_SET_VERSION,
  };
}

export { FA_BENCHMARK_PENDING };
