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

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
    const allocationRows = selected.fund.assetAllocation;
    const disclosedTotal = round2(allocationRows.reduce((sum, row) => sum + row.percent, 0));

    for (const row of allocationRows) {
      const contribution = round2((fundWeight * row.percent) / 100);
      effective.set(row.asset, round2((effective.get(row.asset) ?? 0) + contribution));
    }
    const missingInsideFund = Math.max(0, round2(100 - disclosedTotal));
    if (missingInsideFund > 0) {
      effective.set("unknown", round2((effective.get("unknown") ?? 0) + (fundWeight * missingInsideFund) / 100));
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

  const effectiveAllocation = (["equity", "fixed_income", "cash", "other", "unknown"] as AssetBucket[]).map((key) => {
    const percent = round2(effective.get(key) ?? 0);
    return { key, percent, amount: amountForPercent(investmentAmount, percent) };
  });

  const riskDistribution: RiskDistributionRow[] = ([1, 2, 3, 4, 5, 6, 7, 8, "unknown"] as RiskDistributionRow["level"][]).map((level) => {
    const percent = round2(risk.get(level) ?? 0);
    return { level, percent, amount: amountForPercent(investmentAmount, percent) };
  });

  const liquiditySummary: LiquidityDistributionRow[] = LIQUIDITY_BUCKETS.map((bucket) => {
    const percent = round2(liquidity.get(bucket) ?? 0);
    return { bucket, percent, amount: amountForPercent(investmentAmount, percent) };
  });

  const unknownAssetPercent = effective.get("unknown") ?? 0;
  const targetDelta: TargetDelta[] = [];
  if (targetTotal === 0) {
    warnings.add("target_not_set");
  } else {
    for (const asset of ASSET_BUCKETS) {
      const targetPercent = targetAssetAllocation.find((row) => row.key === asset)?.percent ?? 0;
      const effectivePercent = round2(effective.get(asset) ?? 0);
      const conclusive = Math.round(unknownAssetPercent * 100) === 0;
      targetDelta.push({
        asset,
        targetPercent,
        effectivePercent,
        deltaPercentagePoints: conclusive ? round2(effectivePercent - targetPercent) : null,
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
