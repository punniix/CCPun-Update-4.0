import type {
  AdvisorHandoffPayload,
  AllocationRow,
  AssetBucket,
  ConstructionBucket,
  InvestmentPlanResult,
  LiquidityBucket,
  LiquidityDistributionRow,
  PlanWarningCode,
  RiskDistributionRow,
  SelectedFund,
  TargetDelta,
} from "./types";

const ASSET_BUCKETS: Array<Exclude<AssetBucket, "unknown">> = ["equity", "fixed_income", "cash", "other"];
const LIQUIDITY_BUCKETS: LiquidityBucket[] = ["T+1", "T+2", "T+3", "other", "unknown"];

// Upper bound for a planning amount (THB). Larger inputs are treated as invalid
// rather than producing amounts beyond exact floating-point satang precision.
export const MAX_INVESTMENT_AMOUNT = 100_000_000_000;

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Parses a customer amount ("500,000", " 1000.50 "). Returns 0 for anything that is not a usable positive amount. */
export function parseInvestmentAmount(raw: string | null | undefined): number {
  const text = (raw ?? "").replace(/[,\s]/g, "");
  if (!/^\+?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return 0;
  const value = round2(Number(text));
  return Number.isFinite(value) && value > 0 && value <= MAX_INVESTMENT_AMOUNT ? value : 0;
}

/** Local plan identifier (never sent to analytics). Uses crypto.randomUUID when available. */
export function createPlanId(prefix: string, source: { randomUUID?: () => string } | undefined = globalThis.crypto, now: () => number = Date.now): string {
  return typeof source?.randomUUID === "function" ? source.randomUUID() : `${prefix}-${now()}`;
}

/** Customer percent input clamped to 0–100 with two decimals; non-numeric input is 0. */
export function clampPercentInput(raw: string | number): number {
  const parsed = typeof raw === "number" ? raw : Number(String(raw).trim() || "NaN");
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, round2(parsed)));
}

/**
 * Rounds `values` to 1/scale units so the rounded values add up exactly to `total`
 * (largest-remainder method). Used only for values that already add up to `total`;
 * if they do not (beyond floating-point noise), plain rounding is returned unchanged.
 */
export function distributeRounded(values: number[], total: number, scale = 100): number[] {
  const targetUnits = Math.round(total * scale);
  const exact = values.map((value) => (Number.isFinite(value) ? value : 0) * scale);
  const sum = exact.reduce((acc, value) => acc + value, 0);
  if (Math.abs(sum - targetUnits) > 1e-6 * Math.max(1, Math.abs(targetUnits)) + values.length * 1e-6) {
    return values.map((value) => round2(Number.isFinite(value) ? value : 0));
  }
  const floors = exact.map((value) => Math.floor(value + 1e-9));
  let remainder = targetUnits - floors.reduce((acc, value) => acc + value, 0);
  const order = exact.map((value, index) => ({ index, fraction: value - floors[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const { index } of order) {
    if (remainder <= 0) break;
    floors[index] += 1;
    remainder -= 1;
  }
  return floors.map((units) => units / scale);
}

export function allocationTotal<T extends string>(rows: AllocationRow<T>[]): number {
  return round2(rows.reduce((sum, row) => sum + (Number.isFinite(row.percent) ? row.percent : 0), 0));
}

export function isAllocationComplete<T extends string>(rows: AllocationRow<T>[]): boolean {
  return Math.round(allocationTotal(rows) * 100) === 10_000 && rows.every((row) => row.percent >= 0 && row.percent <= 100);
}

export function amountForPercent(amount: number, percent: number): number {
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(percent)) return 0;
  return round2((amount * percent) / 100);
}

export function percentForAmount(totalAmount: number, bucketAmount: number): number {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0 || !Number.isFinite(bucketAmount)) return 0;
  const bounded = Math.min(totalAmount, Math.max(0, bucketAmount));
  return Math.round(((bounded / totalAmount) * 100) * 1_000_000) / 1_000_000;
}

export function normalizeLiquidity(rawText: string | null | undefined): LiquidityBucket {
  const value = rawText?.trim().toUpperCase();
  if (!value) return "unknown";
  if (value === "T+1") return "T+1";
  if (value === "T+2") return "T+2";
  if (value === "T+3") return "T+3";
  return "other";
}

export function constructionCoverageMatches(
  construction: AllocationRow<ConstructionBucket>[],
  selectedFunds: SelectedFund[],
): boolean {
  const selectedByBucket = new Map<ConstructionBucket, number>();
  for (const selected of selectedFunds) {
    const bucket = selected.fund.constructionBucket;
    if (!bucket) return false;
    selectedByBucket.set(bucket, round2((selectedByBucket.get(bucket) ?? 0) + selected.weightPercent));
  }
  return construction.every((row) => Math.round((selectedByBucket.get(row.key) ?? 0) * 100) === Math.round(row.percent * 100));
}

export function calculatePlan(input: {
  investmentAmount: number;
  fundConstructionAllocation: AllocationRow<ConstructionBucket>[];
  targetAssetAllocation: AllocationRow<Exclude<AssetBucket, "unknown">>[];
  selectedFunds: SelectedFund[];
}): InvestmentPlanResult {
  const { investmentAmount, fundConstructionAllocation, targetAssetAllocation, selectedFunds } = input;
  if (!Number.isFinite(investmentAmount) || investmentAmount <= 0) throw new Error("investment_amount_invalid");
  if (!isAllocationComplete(fundConstructionAllocation)) throw new Error("fund_construction_allocation_not_100");
  if (!isAllocationComplete(selectedFunds.map((row) => ({ key: row.fund.id, percent: row.weightPercent })))) throw new Error("selected_fund_weights_not_100");
  if (!constructionCoverageMatches(fundConstructionAllocation, selectedFunds)) throw new Error("selected_fund_weights_do_not_match_construction");

  const targetTotal = allocationTotal(targetAssetAllocation);
  if (targetTotal !== 0 && !isAllocationComplete(targetAssetAllocation)) throw new Error("target_asset_allocation_must_be_0_or_100");

  const effective = new Map<AssetBucket, number>([["equity", 0], ["fixed_income", 0], ["cash", 0], ["other", 0], ["unknown", 0]]);
  const risk = new Map<RiskDistributionRow["level"], number>();
  const liquidity = new Map<LiquidityBucket, number>();
  const warnings = new Set<PlanWarningCode>();
  const snapshotIds = new Set<string>();

  for (const selected of selectedFunds) {
    const fundWeight = selected.weightPercent;
    const reportedRows = selected.fund.assetAllocation;
    const disclosedTotal = reportedRows.reduce((sum, row) => sum + row.percent, 0);
    // A disclosure with a non-finite/negative row or a total above 100% cannot be
    // looked through; the whole fund weight stays unknown rather than renormalized.
    const usable = reportedRows.every((row) => Number.isFinite(row.percent) && row.percent >= 0 && row.percent <= 100)
      && disclosedTotal <= 100.005;
    const allocationRows = usable ? reportedRows : [];
    const knownTotal = usable ? Math.min(100, disclosedTotal) : 0;

    // Accumulate unrounded contributions; rounding happens once, at the end.
    for (const row of allocationRows) {
      effective.set(row.asset, (effective.get(row.asset) ?? 0) + (fundWeight * row.percent) / 100);
    }
    const missingInsideFund = Math.max(0, 100 - knownTotal);
    if (round2(missingInsideFund) > 0 || !usable) {
      effective.set("unknown", (effective.get("unknown") ?? 0) + (fundWeight * missingInsideFund) / 100);
      warnings.add("partial_asset_allocation");
    }

    const riskKey = selected.fund.riskSpectrum && selected.fund.riskSpectrum >= 1 && selected.fund.riskSpectrum <= 8
      ? selected.fund.riskSpectrum as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
      : "unknown";
    risk.set(riskKey, round2((risk.get(riskKey) ?? 0) + fundWeight));
    if (riskKey === "unknown") warnings.add("missing_risk");

    const liquidityKey = selected.fund.liquidity.normalized;
    liquidity.set(liquidityKey, round2((liquidity.get(liquidityKey) ?? 0) + fundWeight));
    if (liquidityKey === "unknown") warnings.add("missing_liquidity");

    if (selected.fund.provenance.source === "uat_synthetic") warnings.add("demo_data");
    if (selected.fund.provenance.state === "stale") warnings.add("stale_data");
    for (const snapshotId of selected.fund.provenance.snapshotIds) snapshotIds.add(snapshotId);
  }

  // Each distribution covers exactly 100% of the plan: round so displayed percents
  // add to 100.00 and amounts add to the exact plan amount (no satang drift).
  const distribute = <K,>(keys: K[], source: Map<K, number>) => {
    const percents = distributeRounded(keys.map((key) => source.get(key) ?? 0), 100);
    const amounts = distributeRounded(percents.map((percent) => (investmentAmount * percent) / 100), investmentAmount);
    return keys.map((key, index) => ({ key, percent: percents[index], amount: amounts[index] }));
  };

  const effectiveAllocation = distribute(["equity", "fixed_income", "cash", "other", "unknown"] as AssetBucket[], effective);
  const riskDistribution: RiskDistributionRow[] = distribute([1, 2, 3, 4, 5, 6, 7, 8, "unknown"] as RiskDistributionRow["level"][], risk)
    .map(({ key, percent, amount }) => ({ level: key, percent, amount }));
  const liquiditySummary: LiquidityDistributionRow[] = distribute(LIQUIDITY_BUCKETS, liquidity)
    .map(({ key, percent, amount }) => ({ bucket: key, percent, amount }));
  const effectivePercent = new Map(effectiveAllocation.map((row) => [row.key, row.percent]));

  const unknownAssetPercent = effectivePercent.get("unknown") ?? 0;
  const targetDelta: TargetDelta[] = [];
  if (targetTotal === 0) {
    warnings.add("target_not_set");
  } else {
    for (const asset of ASSET_BUCKETS) {
      const targetPercent = targetAssetAllocation.find((row) => row.key === asset)?.percent ?? 0;
      const assetPercent = effectivePercent.get(asset) ?? 0;
      const conclusive = Math.round(unknownAssetPercent * 100) === 0;
      targetDelta.push({
        asset,
        targetPercent,
        effectivePercent: assetPercent,
        deltaPercentagePoints: conclusive ? round2(assetPercent - targetPercent) : null,
        conclusive,
      });
    }
    if (unknownAssetPercent > 0) warnings.add("target_delta_inconclusive");
  }

  const riskUnknown = risk.get("unknown") ?? 0;
  const liquidityUnknown = liquidity.get("unknown") ?? 0;

  return {
    investmentAmount,
    fundConstructionAllocation,
    targetAssetAllocation,
    selectedFunds,
    effectiveAllocation,
    riskDistribution,
    liquiditySummary,
    targetDelta,
    warnings: Array.from(warnings),
    snapshotIds: Array.from(snapshotIds),
    coverage: {
      effectiveAssetPercentKnown: round2(100 - unknownAssetPercent),
      riskPercentKnown: round2(100 - riskUnknown),
      liquidityPercentKnown: round2(100 - liquidityUnknown),
    },
  };
}

export function createAdvisorHandoffPayload(planId: string, result: InvestmentPlanResult, createdAt = new Date().toISOString()): AdvisorHandoffPayload {
  return {
    schema_version: 1,
    plan_id: planId,
    investment_amount: result.investmentAmount,
    fund_construction_allocation: result.fundConstructionAllocation,
    target_asset_allocation: result.targetAssetAllocation,
    selected_funds: result.selectedFunds.map((selected) => ({
      project_id: selected.fund.projectId,
      class_name: selected.fund.className,
      fund_name: selected.fund.name,
      selected_weight_percent: selected.weightPercent,
      selection_source: "customer",
      provenance: selected.fund.provenance,
    })),
    effective_allocation: result.effectiveAllocation,
    risk_distribution: result.riskDistribution,
    liquidity_summary: result.liquiditySummary,
    warnings: result.warnings,
    sec_snapshot_ids: result.snapshotIds,
    methodology_version: "investment_allocation_v1",
    created_at: createdAt,
  };
}
