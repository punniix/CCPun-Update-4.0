import assert from "node:assert/strict";
import test from "node:test";
import {
  allocationTotal,
  amountForPercent,
  calculatePlan,
  constructionCoverageMatches,
  createAdvisorHandoffPayload,
  isAllocationComplete,
  normalizeLiquidity,
  percentForAmount,
} from "../features/investment-allocation/domain/calculation";
import { UAT_SYNTHETIC_FUNDS } from "../features/investment-allocation/server/demo-funds";
import type { AllocationRow, AssetBucket, ConstructionBucket, SelectedFund } from "../features/investment-allocation/domain/types";

function fund(id: string) {
  const match = UAT_SYNTHETIC_FUNDS.find((row) => row.id === id);
  assert.ok(match, `missing UAT fund fixture ${id}`);
  return match;
}

function selected(id: string, weightPercent: number): SelectedFund {
  return { fund: fund(id), weightPercent, selectionSource: "customer" };
}

const target505015: AllocationRow<Exclude<AssetBucket, "unknown">>[] = [
  { key: "equity", percent: 50 },
  { key: "fixed_income", percent: 35 },
  { key: "cash", percent: 15 },
  { key: "other", percent: 0 },
];

test("allocation validation requires an exact 100.00% final total", () => {
  const valid = [{ key: "a", percent: 40 }, { key: "b", percent: 60 }];
  const invalid = [{ key: "a", percent: 40 }, { key: "b", percent: 59.99 }];
  assert.equal(allocationTotal(valid), 100);
  assert.equal(isAllocationComplete(valid), true);
  assert.equal(isAllocationComplete(invalid), false);
  assert.equal(amountForPercent(500_000, 12.5), 62_500);
  assert.equal(percentForAmount(500_000, 200_000), 40);
  assert.equal(isAllocationComplete([
    { key: "a", percent: percentForAmount(1_000_000, 333_333.33) },
    { key: "b", percent: percentForAmount(1_000_000, 333_333.33) },
    { key: "c", percent: percentForAmount(1_000_000, 333_333.34) },
  ]), true, "amount entry that totals the plan must survive display rounding and still validate as 100%");
});

test("liquidity normalization is deliberately conservative", () => {
  assert.equal(normalizeLiquidity("T+1"), "T+1");
  assert.equal(normalizeLiquidity(" t+2 "), "T+2");
  assert.equal(normalizeLiquidity("T+3"), "T+3");
  assert.equal(normalizeLiquidity("T +2"), "other");
  assert.equal(normalizeLiquidity("ภายใน 2 วันทำการ"), "other");
  assert.equal(normalizeLiquidity(null), "unknown");
});

test("mixed fund look-through keeps disclosed allocation on the portfolio basis", () => {
  const construction: AllocationRow<ConstructionBucket>[] = [
    { key: "mixed", percent: 100 },
    { key: "equity", percent: 0 },
    { key: "fixed_income", percent: 0 },
    { key: "money_market", percent: 0 },
    { key: "other", percent: 0 },
  ];
  const result = calculatePlan({
    investmentAmount: 100_000,
    fundConstructionAllocation: construction,
    targetAssetAllocation: [
      { key: "equity", percent: 50 },
      { key: "fixed_income", percent: 40 },
      { key: "cash", percent: 10 },
      { key: "other", percent: 0 },
    ],
    selectedFunds: [selected("uat-mixed-01", 100)],
  });
  assert.deepEqual(
    result.effectiveAllocation.map((row) => [row.key, row.percent]),
    [["equity", 50], ["fixed_income", 40], ["cash", 10], ["other", 0], ["unknown", 0]],
  );
  assert.equal(result.coverage.effectiveAssetPercentKnown, 100);
  assert.ok(result.targetDelta.every((row) => row.conclusive));
  assert.ok(result.targetDelta.every((row) => row.deltaPercentagePoints === 0));
});

test("partial disclosure remains unknown and is never renormalized", () => {
  const construction: AllocationRow<ConstructionBucket>[] = [
    { key: "mixed", percent: 100 },
    { key: "equity", percent: 0 },
    { key: "fixed_income", percent: 0 },
    { key: "money_market", percent: 0 },
    { key: "other", percent: 0 },
  ];
  const result = calculatePlan({
    investmentAmount: 100_000,
    fundConstructionAllocation: construction,
    targetAssetAllocation: target505015,
    selectedFunds: [selected("uat-partial-01", 100)],
  });
  assert.deepEqual(
    result.effectiveAllocation.map((row) => [row.key, row.percent]),
    [["equity", 35], ["fixed_income", 25], ["cash", 0], ["other", 0], ["unknown", 40]],
  );
  assert.equal(result.coverage.effectiveAssetPercentKnown, 60);
  assert.equal(result.coverage.riskPercentKnown, 0);
  assert.equal(result.coverage.liquidityPercentKnown, 0);
  assert.ok(result.targetDelta.every((row) => row.conclusive === false));
  assert.ok(result.targetDelta.every((row) => row.deltaPercentagePoints === null));
  assert.ok(result.warnings.includes("partial_asset_allocation"));
  assert.ok(result.warnings.includes("target_delta_inconclusive"));
});

test("hybrid construction calculates effective allocation, risk and liquidity deterministically", () => {
  const construction: AllocationRow<ConstructionBucket>[] = [
    { key: "mixed", percent: 40 },
    { key: "equity", percent: 30 },
    { key: "fixed_income", percent: 20 },
    { key: "money_market", percent: 10 },
    { key: "other", percent: 0 },
  ];
  const chosen = [
    selected("uat-mixed-01", 40),
    selected("uat-equity-01", 30),
    selected("uat-fixed-01", 20),
    selected("uat-money-01", 10),
  ];
  assert.equal(constructionCoverageMatches(construction, chosen), true);
  const result = calculatePlan({ investmentAmount: 500_000, fundConstructionAllocation: construction, targetAssetAllocation: target505015, selectedFunds: chosen });
  assert.deepEqual(
    result.effectiveAllocation.map((row) => [row.key, row.percent, row.amount]),
    [
      ["equity", 48.8, 244_000],
      ["fixed_income", 36.8, 184_000],
      ["cash", 14.4, 72_000],
      ["other", 0, 0],
      ["unknown", 0, 0],
    ],
  );
  const risk = Object.fromEntries(result.riskDistribution.map((row) => [String(row.level), row.percent]));
  assert.equal(risk["2"], 10);
  assert.equal(risk["4"], 20);
  assert.equal(risk["5"], 40);
  assert.equal(risk["6"], 30);
  assert.equal(risk.unknown, 0);
  const liquidity = Object.fromEntries(result.liquiditySummary.map((row) => [row.bucket, row.percent]));
  assert.deepEqual(liquidity, { "T+1": 10, "T+2": 60, "T+3": 30, other: 0, unknown: 0 });
  assert.deepEqual(result.targetDelta.map((row) => [row.asset, row.deltaPercentagePoints]), [
    ["equity", -1.2],
    ["fixed_income", 1.8],
    ["cash", -0.6],
    ["other", 0],
  ]);
});

test("fund weights must match the customer-defined construction buckets", () => {
  const construction: AllocationRow<ConstructionBucket>[] = [
    { key: "mixed", percent: 40 },
    { key: "equity", percent: 60 },
    { key: "fixed_income", percent: 0 },
    { key: "money_market", percent: 0 },
    { key: "other", percent: 0 },
  ];
  assert.equal(constructionCoverageMatches(construction, [selected("uat-mixed-01", 50), selected("uat-equity-01", 50)]), false);
  assert.throws(() => calculatePlan({
    investmentAmount: 100_000,
    fundConstructionAllocation: construction,
    targetAssetAllocation: [],
    selectedFunds: [selected("uat-mixed-01", 50), selected("uat-equity-01", 50)],
  }), /selected_fund_weights_do_not_match_construction/);
});

test("advisor handoff preserves customer provenance and methodology without generating advice", () => {
  const construction: AllocationRow<ConstructionBucket>[] = [
    { key: "mixed", percent: 100 },
    { key: "equity", percent: 0 },
    { key: "fixed_income", percent: 0 },
    { key: "money_market", percent: 0 },
    { key: "other", percent: 0 },
  ];
  const result = calculatePlan({ investmentAmount: 120_000, fundConstructionAllocation: construction, targetAssetAllocation: [], selectedFunds: [selected("uat-mixed-01", 100)] });
  const payload = createAdvisorHandoffPayload("plan-test", result, "2026-09-17T00:00:00.000Z");
  assert.equal(payload.methodology_version, "investment_allocation_v1");
  assert.equal(payload.selected_funds[0]?.selection_source, "customer");
  assert.equal(payload.selected_funds[0]?.selected_weight_percent, 100);
  assert.ok(payload.sec_snapshot_ids.every((id) => id.startsWith("uat-synthetic:")));
  assert.ok(payload.warnings.includes("demo_data"));
});
