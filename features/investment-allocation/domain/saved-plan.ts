import { allocationTotal, clampPercentInput, MAX_INVESTMENT_AMOUNT, parseInvestmentAmount } from "./calculation";
import type { FundScope } from "./fund-scope";
import type { AllocationRow, AssetBucket, ConstructionBucket } from "./types";

export const SAVED_PLAN_KEYS = { single: "ccpun_investment_single_fund_plan_v1", portfolio: "ccpun_investment_allocation_plan_v1" } as const;
type Mode = keyof typeof SAVED_PLAN_KEYS;
type StorageAccess = Pick<Storage, "getItem" | "setItem">;
type SavedFund = { projectId: string; className: string | null; query: string; weight: number };
export type SavedPlanInput = { amount: number; funds: SavedFund[]; construction: AllocationRow<ConstructionBucket>[]; target: AllocationRow<Exclude<AssetBucket, "unknown">>[] };
const CONSTRUCTION = ["mixed", "equity", "fixed_income", "money_market", "other"] as const;
const TARGET = ["equity", "fixed_income", "cash", "other"] as const;
const MAX_STORAGE_CHARS = 200_000;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const invalid = (): never => { throw new Error("saved_plan_invalid"); };
const boundedText = (value: unknown, max: number): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);

function rows<K extends string>(value: unknown, keys: readonly K[], allowZero: boolean): AllocationRow<K>[] {
  if (!Array.isArray(value) || value.length !== keys.length) return invalid();
  const result = value.map(row => {
    if (!record(row) || !keys.includes(row.key as K) || typeof row.percent !== "number" || !Number.isFinite(row.percent) || row.percent < 0 || row.percent > 100 || clampPercentInput(row.percent) !== row.percent) return invalid();
    return { key: row.key as K, percent: row.percent };
  });
  if (new Set(result.map(row => row.key)).size !== keys.length) return invalid();
  const total = allocationTotal(result);
  if (total !== 100 && !(allowZero && total === 0)) return invalid();
  return result;
}

/** Storage is untrusted: restore only bounded user choices, never cached financial facts. */
export function parseSavedPlan(value: unknown, mode: Mode, scope: FundScope): SavedPlanInput {
  if (!record(value) || value.schema_version !== 1 || value.tool_scope !== scope || typeof value.investment_amount !== "number" || !Number.isFinite(value.investment_amount) || value.investment_amount <= 0 || value.investment_amount > MAX_INVESTMENT_AMOUNT || parseInvestmentAmount(String(value.investment_amount)) !== value.investment_amount) return invalid();
  const single = mode === "single";
  if ((single && value.journey_mode !== "single_fund") || (!single && value.methodology_version !== "investment_allocation_v1")) return invalid();
  const selections = single ? [value.selected_fund] : value.selected_funds;
  if (!Array.isArray(selections) || !selections.length) return invalid();
  if (selections.length > 50) throw new Error("saved_plan_restore_limit");
  const funds = selections.map(selection => {
    if (!record(selection) || !boundedText(selection.project_id, 80) || !/^(?:M\d{4}_\d{4}|UAT-[A-Z0-9-]+)$/.test(selection.project_id) || (selection.class_name !== null && !boundedText(selection.class_name, 120)) || !boundedText(selection.restore_query, 120)) return invalid();
    const weight = single ? 100 : selection.selected_weight_percent;
    if (typeof weight !== "number" || !Number.isFinite(weight) || weight < 0 || weight > 100 || clampPercentInput(weight) !== weight) return invalid();
    return { projectId: selection.project_id, className: selection.class_name as string | null, query: selection.restore_query, weight };
  });
  if (new Set(funds.map(fund => fund.projectId)).size !== funds.length || allocationTotal(funds.map(fund => ({ key: fund.projectId, percent: fund.weight }))) !== 100) return invalid();
  return { amount: value.investment_amount, funds, construction: single ? [] : rows(value.fund_construction_allocation, CONSTRUCTION, false), target: single ? [] : rows(value.target_asset_allocation, TARGET, true) };
}

function envelope(raw: string | null): { storage_version: 2; plans: Record<string, unknown>; legacy?: string } {
  if (!raw) return { storage_version: 2, plans: {} };
  try {
    const value: unknown = JSON.parse(raw);
    if (record(value) && value.storage_version === 2 && record(value.plans)) {
      return { storage_version: 2, plans: { ...(Object.hasOwn(value.plans, "main") ? { main: value.plans.main } : {}), ...(Object.hasOwn(value.plans, "aia") ? { aia: value.plans.aia } : {}) }, ...(typeof value.legacy === "string" ? { legacy: value.legacy } : {}) };
    }
  } catch { /* Retain the previous value when saving a new scoped plan. */ }
  return { storage_version: 2, plans: {}, legacy: raw };
}

export function savePlanLocally(storage: StorageAccess, mode: Mode, scope: FundScope, payload: Record<string, unknown>): void {
  // Preserve existing UI validation and native Storage quota; bounds apply only to restore.
  const next = envelope(storage.getItem(SAVED_PLAN_KEYS[mode]));
  next.plans[scope] = payload;
  const json = JSON.stringify(next);
  storage.setItem(SAVED_PLAN_KEYS[mode], json);
}

export function readSavedPlan(storage: Pick<Storage, "getItem">, mode: Mode, scope: FundScope): SavedPlanInput | null {
  const raw = storage.getItem(SAVED_PLAN_KEYS[mode]);
  if (!raw) return null;
  if (raw.length > MAX_STORAGE_CHARS) throw new Error("saved_plan_too_large");
  const saved = envelope(raw);
  if (!Object.hasOwn(saved.plans, scope)) {
    if (saved.legacy) throw new Error("saved_plan_legacy");
    return null;
  }
  return parseSavedPlan(saved.plans[scope], mode, scope);
}

/** Honour the existing API budget; never retry other failures or a cancelled restore. */
export async function fetchRestoreData(url: string, current: () => boolean, fetcher: typeof fetch = fetch, wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))): Promise<Response> {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!current()) throw new Error("restore_cancelled");
    const response = await fetcher(url, { headers: { Accept: "application/json" } });
    if (!current()) throw new Error("restore_cancelled");
    if (response.ok) return response;
    const seconds = Number(response.headers.get("Retry-After"));
    if (response.status !== 429 || attempt === 2 || !Number.isInteger(seconds) || seconds < 1 || seconds > 30) throw new Error("restore_unavailable");
    await wait(seconds * 1000 + 100);
  }
  throw new Error("restore_unavailable");
}
