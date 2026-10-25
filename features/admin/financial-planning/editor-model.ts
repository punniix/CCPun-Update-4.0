import type {
  AssetItem,
  CashflowItem,
  FinancialPosition,
  LiabilityItem,
} from "../../../lib/admin/financial-planning/contracts";
import { amountToInput, parseAmountInput } from "./format";

/**
 * Editable form state for the financial position page and its pure
 * conversion to/from the stored contract. Amounts stay as the text ปั้น typed
 * until conversion, so "1,200" and an empty field round-trip without surprise.
 */

export type CashflowRow = {
  key: string;
  label: string;
  amount: string;
  frequency: CashflowItem["frequency"];
  incomeType: NonNullable<CashflowItem["incomeType"]> | "";
  expenseKind: NonNullable<CashflowItem["expenseKind"]> | "";
};
export type AssetRow = { key: string; label: string; value: string; liquidity: AssetItem["liquidity"]; valuedOn: string };
export type LiabilityRow = {
  key: string;
  label: string;
  balance: string;
  monthlyPayment: string;
  rate: string;
  kind: LiabilityItem["kind"];
};

export type EditorRows = {
  income: CashflowRow[];
  expense: CashflowRow[];
  assets: AssetRow[];
  liabilities: LiabilityRow[];
};

export type EditorConversion =
  | { ok: true; position: FinancialPosition }
  | { ok: false; invalidKeys: string[]; position: FinancialPosition };

export function rowsFromPosition(position: FinancialPosition, nextKey: () => string): EditorRows {
  const cashflow = (item: CashflowItem): CashflowRow => ({
    key: nextKey(),
    label: item.label,
    amount: amountToInput(item.amount),
    frequency: item.frequency,
    incomeType: item.incomeType ?? "",
    expenseKind: item.expenseKind ?? "",
  });
  return {
    income: position.cashflow.filter((item) => item.direction === "income").map(cashflow),
    expense: position.cashflow.filter((item) => item.direction === "expense").map(cashflow),
    assets: position.assets.map((item) => ({
      key: nextKey(),
      label: item.label,
      value: amountToInput(item.value),
      liquidity: item.liquidity,
      valuedOn: item.valuedOn ?? "",
    })),
    liabilities: position.liabilities.map((item) => ({
      key: nextKey(),
      label: item.label,
      balance: amountToInput(item.balance),
      monthlyPayment: amountToInput(item.monthlyPayment),
      rate: item.annualInterestRatePct === null ? "" : String(item.annualInterestRatePct),
      kind: item.kind,
    })),
  };
}

function parseRate(raw: string): { ok: true; value: number | null } | { ok: false } {
  const parsed = parseAmountInput(raw.replace(/%/g, ""));
  if (!parsed.ok) return parsed;
  if (parsed.value !== null && parsed.value > 100) return { ok: false };
  return parsed;
}

/** Converts form rows to the stored contract; invalid fields are reported, never guessed. */
export function positionFromRows(rows: EditorRows): EditorConversion {
  const invalidKeys: string[] = [];
  const amount = (key: string, field: string, raw: string) => {
    const parsed = parseAmountInput(raw);
    if (!parsed.ok) { invalidKeys.push(`${key}:${field}`); return null; }
    return parsed.value;
  };
  const cashflow = (direction: CashflowItem["direction"]) => (row: CashflowRow): CashflowItem => ({
    direction,
    label: row.label.trim(),
    amount: amount(row.key, "amount", row.amount),
    frequency: row.frequency,
    incomeType: direction === "income" && row.incomeType ? row.incomeType : null,
    expenseKind: direction === "expense" && row.expenseKind ? row.expenseKind : null,
  });
  const position: FinancialPosition = {
    cashflow: [...rows.income.map(cashflow("income")), ...rows.expense.map(cashflow("expense"))],
    assets: rows.assets.map((row) => ({
      label: row.label.trim(),
      value: amount(row.key, "value", row.value),
      liquidity: row.liquidity,
      valuedOn: /^\d{4}-\d{2}-\d{2}$/.test(row.valuedOn) ? row.valuedOn : null,
    })),
    liabilities: rows.liabilities.map((row) => {
      const rate = parseRate(row.rate);
      if (!rate.ok) invalidKeys.push(`${row.key}:rate`);
      return {
        label: row.label.trim(),
        balance: amount(row.key, "balance", row.balance),
        monthlyPayment: amount(row.key, "monthlyPayment", row.monthlyPayment),
        annualInterestRatePct: rate.ok ? rate.value : null,
        kind: row.kind,
      };
    }),
  };
  return invalidKeys.length ? { ok: false, invalidKeys, position } : { ok: true, position };
}

export function blankCashflowRow(key: string, direction: CashflowItem["direction"]): CashflowRow {
  return {
    key,
    label: "",
    amount: "",
    frequency: "monthly",
    incomeType: direction === "income" ? "40(1)" : "",
    expenseKind: direction === "expense" ? "living" : "",
  };
}

export function blankAssetRow(key: string): AssetRow {
  return { key, label: "", value: "", liquidity: "liquid", valuedOn: "" };
}

export function blankLiabilityRow(key: string): LiabilityRow {
  return { key, label: "", balance: "", monthlyPayment: "", rate: "", kind: "other" };
}
