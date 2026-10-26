// Unit tests for every exported function of features/investment-allocation/domain,
// the catalog cursor, the synthetic dataset and the shared copy helpers.
// Normal, edge and error cases; no network, no SEC traffic.
import assert from "node:assert/strict";
import test from "node:test";
import {
  allocationTotal,
  amountForPercent,
  calculatePlan,
  clampPercentInput,
  createPlanId,
  constructionCoverageMatches,
  createAdvisorHandoffPayload,
  distributeRounded,
  isAllocationComplete,
  MAX_INVESTMENT_AMOUNT,
  normalizeLiquidity,
  parseInvestmentAmount,
  percentForAmount,
  round2,
} from "../features/investment-allocation/domain/calculation";
import {
  categoryFromPolicy,
  equitySubcategoryLabel,
  FUND_CATEGORY_DESCRIPTIONS,
  FUND_CATEGORY_LABELS,
  FUND_SUBCATEGORY_LABELS,
  geographyLabel,
  matchesGeography,
  subcategoryOptions,
} from "../features/investment-allocation/domain/catalog";
import {
  INVESTMENT_NO_GUARANTEE_STATEMENT,
  INVESTMENT_RISK_STATEMENT,
  RATE_LIMIT_MESSAGE,
  requestFailureMessage,
} from "../features/investment-allocation/domain/copy";
import { planningFundFromDetail } from "../features/investment-allocation/domain/detail-to-planning";
import { encodeCatalogCursor, INITIAL_CATALOG_CURSOR, parseCatalogCursor } from "../features/investment-allocation/server/catalog-cursor";
import { searchDemoFunds, UAT_SYNTHETIC_FUNDS } from "../features/investment-allocation/server/demo-funds";
import type { FundCatalogCategory, FundCatalogSubcategory, FundDetailResponse, PlanningFund, SelectedFund } from "../features/investment-allocation/domain/types";

const CATEGORIES: FundCatalogCategory[] = ["equity", "mixed", "fixed_income", "alternative", "other"];
const SUBCATEGORIES: FundCatalogSubcategory[] = ["all", "domestic", "foreign", "domestic_foreign"];

function demo(id: string): PlanningFund {
  const fund = UAT_SYNTHETIC_FUNDS.find((row) => row.id === id);
  assert.ok(fund, id);
  return fund;
}
const pick = (id: string, weightPercent: number): SelectedFund => ({ fund: demo(id), weightPercent, selectionSource: "customer" });
const sum = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;

function customFund(id: string, rows: Array<[PlanningFund["assetAllocation"][number]["asset"], number]>, extra: Partial<PlanningFund> = {}): PlanningFund {
  const base = demo("uat-mixed-01");
  return {
    ...base, id, projectId: id,
    assetAllocation: rows.map(([asset, percent]) => ({ asset, percent, label: asset, sourceDate: "2026-09-01" })),
    provenance: { ...base.provenance, snapshotIds: [`snap-${id}`] },
    ...extra,
  };
}

// ---------- calculation.ts ----------

test("round2 rounds half away from zero at two decimals, including binary edge values", () => {
  assert.equal(round2(1.005), 1.01);
  assert.equal(round2(2.675), 2.68);
  assert.equal(round2(0), 0);
  assert.equal(round2(-1.234), -1.23);
  assert.equal(round2(33.333333), 33.33);
});

test("parseInvestmentAmount accepts plain and comma-grouped positive amounts and rejects everything else", () => {
  assert.equal(parseInvestmentAmount("500000"), 500000);
  assert.equal(parseInvestmentAmount("500,000"), 500000);
  assert.equal(parseInvestmentAmount(" 1,000.505 "), 1000.51);
  assert.equal(parseInvestmentAmount(".5"), 0.5);
  assert.equal(parseInvestmentAmount("+100"), 100);
  assert.equal(parseInvestmentAmount(String(MAX_INVESTMENT_AMOUNT)), MAX_INVESTMENT_AMOUNT);
  for (const bad of [null, undefined, "", " ", "0", "0.00", "0.004", "-1", "1e3", "Infinity", "NaN", "abc", "๑๐๐", "100 บาท", "1.2.3", String(MAX_INVESTMENT_AMOUNT + 1)]) {
    assert.equal(parseInvestmentAmount(bad as string), 0, String(bad));
  }
});

test("clampPercentInput bounds 0–100 at two decimals and maps invalid input to 0", () => {
  assert.equal(clampPercentInput("45.678"), 45.68);
  assert.equal(clampPercentInput("150"), 100);
  assert.equal(clampPercentInput("-3"), 0);
  assert.equal(clampPercentInput(""), 0);
  assert.equal(clampPercentInput("abc"), 0);
  assert.equal(clampPercentInput(12.5), 12.5);
  assert.equal(clampPercentInput(Number.NaN), 0);
});

test("createPlanId prefers crypto.randomUUID and falls back to a prefixed timestamp", () => {
  assert.equal(createPlanId("single", { randomUUID: () => "uuid-1" }), "uuid-1");
  assert.equal(createPlanId("plan", { randomUUID: undefined }, () => 42), "plan-42");
  assert.equal(createPlanId("plan", {}, () => 7), "plan-7");
  assert.match(createPlanId("plan"), /^[0-9a-f-]{36}$|^plan-\d+$/);
});

test("distributeRounded keeps exact totals with the largest-remainder method", () => {
  assert.deepEqual(distributeRounded([100 / 3, 100 / 3, 100 / 3], 100), [33.34, 33.33, 33.33]);
  assert.equal(sum(distributeRounded([12.345, 47.655, 40], 100)), 100);
  assert.deepEqual(distributeRounded([0, 0, 100], 100), [0, 0, 100]);
  assert.deepEqual(distributeRounded([], 0), []);
  assert.equal(sum(distributeRounded([333.333, 333.333, 333.334], 1000)), 1000);
  // Inputs that do not add up to the total are rounded but never renormalized.
  assert.deepEqual(distributeRounded([10.004, 20.006], 100), [10, 20.01]);
  assert.deepEqual(distributeRounded([Number.NaN, 100], 100), [0, 100]);
});

test("allocationTotal and isAllocationComplete require exactly 100.00% with every row in range", () => {
  assert.equal(allocationTotal([{ key: "a", percent: 33.33 }, { key: "b", percent: 66.67 }]), 100);
  assert.equal(allocationTotal([{ key: "a", percent: Number.NaN }, { key: "b", percent: 40 }]), 40);
  assert.equal(allocationTotal([]), 0);
  assert.equal(isAllocationComplete([{ key: "a", percent: 33.33 }, { key: "b", percent: 66.67 }]), true);
  assert.equal(isAllocationComplete([{ key: "a", percent: 99.99 }]), false);
  assert.equal(isAllocationComplete([{ key: "a", percent: 110 }, { key: "b", percent: -10 }]), false);
  assert.equal(isAllocationComplete([{ key: "a", percent: Number.NaN }, { key: "b", percent: 100 }]), false);
  assert.equal(isAllocationComplete([]), false);
});

test("amountForPercent and percentForAmount handle normal, boundary and invalid values", () => {
  assert.equal(amountForPercent(100_000, 33.33), 33330);
  assert.equal(amountForPercent(1, 50), 0.5);
  assert.equal(amountForPercent(-1, 50), 0);
  assert.equal(amountForPercent(Number.NaN, 50), 0);
  assert.equal(amountForPercent(1000, Number.POSITIVE_INFINITY), 0);
  assert.equal(percentForAmount(300, 100), 33.333333);
  assert.equal(percentForAmount(100, 250), 100, "bounded above by the total");
  assert.equal(percentForAmount(100, -5), 0, "bounded below by zero");
  assert.equal(percentForAmount(0, 5), 0);
  assert.equal(percentForAmount(100, Number.NaN), 0);
});

test("normalizeLiquidity maps only exact T+1/T+2/T+3 codes", () => {
  assert.equal(normalizeLiquidity("t+1"), "T+1");
  assert.equal(normalizeLiquidity(" T+3 "), "T+3");
  assert.equal(normalizeLiquidity("T+4"), "other");
  assert.equal(normalizeLiquidity("ภายใน 5 วันทำการ"), "other");
  assert.equal(normalizeLiquidity(""), "unknown");
  assert.equal(normalizeLiquidity(undefined), "unknown");
});

test("constructionCoverageMatches compares per-bucket weights to the customer construction", () => {
  const construction = [{ key: "mixed" as const, percent: 60 }, { key: "equity" as const, percent: 40 }];
  assert.equal(constructionCoverageMatches(construction, [pick("uat-mixed-01", 60), pick("uat-equity-01", 40)]), true);
  assert.equal(constructionCoverageMatches(construction, [pick("uat-mixed-01", 50), pick("uat-equity-01", 50)]), false);
  assert.equal(constructionCoverageMatches(construction, [pick("uat-mixed-01", 30), pick("uat-partial-01", 30), pick("uat-equity-01", 40)]), true, "two funds can fill one bucket");
  const missingBucket: SelectedFund = { fund: { ...demo("uat-mixed-01"), constructionBucket: undefined as never }, weightPercent: 100, selectionSource: "customer" };
  assert.equal(constructionCoverageMatches([{ key: "mixed", percent: 100 }], [missingBucket]), false);
});

test("calculatePlan rejects invalid amount, construction, weights and target", () => {
  const ok = { investmentAmount: 100_000, fundConstructionAllocation: [{ key: "mixed" as const, percent: 100 }], targetAssetAllocation: [], selectedFunds: [pick("uat-mixed-01", 100)] };
  assert.doesNotThrow(() => calculatePlan(ok));
  assert.throws(() => calculatePlan({ ...ok, investmentAmount: 0 }), /investment_amount_invalid/);
  assert.throws(() => calculatePlan({ ...ok, investmentAmount: Number.NaN }), /investment_amount_invalid/);
  assert.throws(() => calculatePlan({ ...ok, fundConstructionAllocation: [{ key: "mixed", percent: 90 }] }), /fund_construction_allocation_not_100/);
  assert.throws(() => calculatePlan({ ...ok, selectedFunds: [pick("uat-mixed-01", 90)] }), /selected_fund_weights_not_100/);
  assert.throws(() => calculatePlan({ ...ok, selectedFunds: [pick("uat-equity-01", 100)] }), /selected_fund_weights_do_not_match_construction/);
  assert.throws(() => calculatePlan({ ...ok, targetAssetAllocation: [{ key: "equity", percent: 50 }] }), /target_asset_allocation_must_be_0_or_100/);
});

test("calculatePlan effective, risk and liquidity distributions always total exactly 100% and the plan amount", () => {
  const thirds = ["a", "b", "c"].map((id) => customFund(id, [["equity", 33.333], ["fixed_income", 33.333], ["cash", 33.334]]));
  const result = calculatePlan({
    investmentAmount: 1_000_000.01,
    fundConstructionAllocation: [{ key: "mixed", percent: 100 }],
    targetAssetAllocation: [],
    selectedFunds: [
      { fund: thirds[0], weightPercent: 33.33, selectionSource: "customer" },
      { fund: thirds[1], weightPercent: 33.33, selectionSource: "customer" },
      { fund: thirds[2], weightPercent: 33.34, selectionSource: "customer" },
    ],
  });
  for (const rows of [result.effectiveAllocation, result.riskDistribution, result.liquiditySummary]) {
    assert.equal(sum(rows.map((row) => row.percent)), 100);
    assert.equal(sum(rows.map((row) => row.amount)), 1_000_000.01);
  }
  assert.equal(result.effectiveAllocation.find((row) => row.key === "unknown")?.percent, 0);
  assert.ok(result.warnings.includes("target_not_set"));
  assert.deepEqual(result.snapshotIds, ["snap-a", "snap-b", "snap-c"]);
});

test("calculatePlan keeps partial disclosure unknown and treats invalid disclosures as fully unknown", () => {
  const partial = customFund("partial", [["equity", 60]]);
  const negative = customFund("negative", [["equity", 120], ["cash", -20]]);
  const over = customFund("over", [["equity", 70], ["fixed_income", 40]]);
  const nan = customFund("nan", [["equity", Number.NaN], ["cash", 50]]);
  const run = (fund: PlanningFund) => calculatePlan({ investmentAmount: 1000, fundConstructionAllocation: [{ key: "mixed", percent: 100 }], targetAssetAllocation: [{ key: "equity", percent: 100 }], selectedFunds: [{ fund, weightPercent: 100, selectionSource: "customer" }] });
  const p = run(partial);
  assert.equal(p.effectiveAllocation.find((row) => row.key === "equity")?.percent, 60);
  assert.equal(p.effectiveAllocation.find((row) => row.key === "unknown")?.percent, 40);
  assert.equal(p.coverage.effectiveAssetPercentKnown, 60);
  assert.ok(p.warnings.includes("partial_asset_allocation") && p.warnings.includes("target_delta_inconclusive"));
  assert.equal(p.targetDelta.every((row) => row.deltaPercentagePoints === null), true);
  for (const fund of [negative, over, nan]) {
    const r = run(fund);
    assert.equal(r.effectiveAllocation.find((row) => row.key === "unknown")?.percent, 100, fund.id);
    assert.equal(sum(r.effectiveAllocation.map((row) => row.percent)), 100, fund.id);
    assert.equal(r.coverage.effectiveAssetPercentKnown, 0, fund.id);
  }
});

test("calculatePlan reports conclusive target deltas, missing risk/liquidity, demo and stale data", () => {
  const stale = { ...demo("uat-equity-01"), provenance: { ...demo("uat-equity-01").provenance, state: "stale" as const } };
  const noLiquidity = { ...demo("uat-mixed-01"), liquidity: { rawText: null, normalized: "unknown" as const, sourceDate: null }, riskSpectrum: null };
  const result = calculatePlan({
    investmentAmount: 250_000,
    fundConstructionAllocation: [{ key: "mixed", percent: 50 }, { key: "equity", percent: 50 }],
    targetAssetAllocation: [{ key: "equity", percent: 70 }, { key: "fixed_income", percent: 20 }, { key: "cash", percent: 10 }, { key: "other", percent: 0 }],
    selectedFunds: [{ fund: noLiquidity, weightPercent: 50, selectionSource: "customer" }, { fund: stale, weightPercent: 50, selectionSource: "customer" }],
  });
  const equity = result.targetDelta.find((row) => row.asset === "equity");
  assert.equal(equity?.effectivePercent, 73);
  assert.equal(equity?.deltaPercentagePoints, 3);
  assert.equal(equity?.conclusive, true);
  for (const code of ["missing_risk", "missing_liquidity", "demo_data", "stale_data"]) assert.ok(result.warnings.includes(code as never), code);
  assert.equal(result.riskDistribution.find((row) => row.level === "unknown")?.percent, 50);
  assert.equal(result.coverage.riskPercentKnown, 50);
  assert.equal(result.coverage.liquidityPercentKnown, 50);
});

test("calculatePlan handles very small and very large amounts without satang drift", () => {
  const base = { fundConstructionAllocation: [{ key: "mixed" as const, percent: 100 }], targetAssetAllocation: [], selectedFunds: [pick("uat-mixed-01", 100)] };
  const tiny = calculatePlan({ ...base, investmentAmount: 0.01 });
  assert.equal(sum(tiny.effectiveAllocation.map((row) => row.amount)), 0.01);
  const huge = calculatePlan({ ...base, investmentAmount: MAX_INVESTMENT_AMOUNT });
  assert.equal(sum(huge.effectiveAllocation.map((row) => row.amount)), MAX_INVESTMENT_AMOUNT);
  assert.equal(huge.effectiveAllocation.find((row) => row.key === "equity")?.amount, 50_000_000_000);
});

test("createAdvisorHandoffPayload carries customer selections and provenance without advice fields", () => {
  const result = calculatePlan({ investmentAmount: 1000, fundConstructionAllocation: [{ key: "mixed", percent: 100 }], targetAssetAllocation: [], selectedFunds: [pick("uat-mixed-01", 100)] });
  const payload = createAdvisorHandoffPayload("plan-1", result, "2026-10-24T00:00:00.000Z");
  assert.equal(payload.schema_version, 1);
  assert.equal(payload.plan_id, "plan-1");
  assert.equal(payload.created_at, "2026-10-24T00:00:00.000Z");
  assert.equal(payload.selected_funds[0].selection_source, "customer");
  assert.equal(payload.selected_funds[0].project_id, demo("uat-mixed-01").projectId);
  assert.equal(payload.methodology_version, "investment_allocation_v1");
  assert.doesNotMatch(JSON.stringify(payload), /recommend|best|score|rank/i);
  assert.match(createAdvisorHandoffPayload("p", result).created_at, /^\d{4}-\d{2}-\d{2}T/);
});

// ---------- catalog.ts ----------

test("catalog labels cover every category and subcategory in Thai", () => {
  for (const category of CATEGORIES) {
    assert.ok(FUND_CATEGORY_LABELS[category] && FUND_CATEGORY_DESCRIPTIONS[category], category);
    assert.match(FUND_CATEGORY_LABELS[category], /[฀-๿]/);
  }
  for (const subcategory of SUBCATEGORIES) assert.ok(FUND_SUBCATEGORY_LABELS[subcategory], subcategory);
});

test("categoryFromPolicy maps only exact SEC policy values", () => {
  assert.equal(categoryFromPolicy("ตราสารทุน"), "equity");
  assert.equal(categoryFromPolicy("ผสม"), "mixed");
  assert.equal(categoryFromPolicy("ตราสารหนี้"), "fixed_income");
  assert.equal(categoryFromPolicy("ทรัพย์สินทางเลือก"), "alternative");
  for (const other of ["ตราสารทุน ", "Equity", "", null, undefined, "อื่น ๆ"]) assert.equal(categoryFromPolicy(other), "other", String(other));
});

test("subcategoryOptions offers geography only for categories that carry it", () => {
  for (const category of ["equity", "mixed", "fixed_income", "alternative"] as const) assert.deepEqual(subcategoryOptions(category), SUBCATEGORIES);
  assert.deepEqual(subcategoryOptions("other"), ["all"]);
  assert.deepEqual(subcategoryOptions("all"), ["all"]);
});

test("geographyLabel and matchesGeography follow SEC invest_country_flag semantics", () => {
  assert.equal(geographyLabel("3", "equity"), "หุ้นไทย");
  assert.equal(geographyLabel("1", "equity"), "หุ้นต่างประเทศ");
  assert.equal(geographyLabel("2", "equity"), "หุ้นต่างประเทศ");
  assert.equal(geographyLabel("4", "equity"), "หุ้นไทย + ต่างประเทศ");
  assert.equal(geographyLabel("1"), "เน้นลงทุนต่างประเทศ");
  assert.equal(geographyLabel("2", "mixed"), "ลงทุนต่างประเทศบางส่วน");
  assert.equal(geographyLabel("3", "fixed_income"), "ไม่มีความเสี่ยงต่างประเทศ");
  assert.equal(geographyLabel("4", "all"), "มีความเสี่ยงทั้งในและต่างประเทศ");
  assert.equal(geographyLabel(null, "equity"), "SEC ไม่ระบุขอบเขตประเทศ");
  const table: Array<[FundCatalogSubcategory, Array<"1" | "2" | "3" | "4" | null>]> = [
    ["all", ["1", "2", "3", "4", null]], ["domestic", ["3"]], ["foreign", ["1", "2"]], ["domestic_foreign", ["4"]],
  ];
  for (const [subcategory, accepted] of table) {
    for (const flag of ["1", "2", "3", "4", null] as const) {
      assert.equal(matchesGeography({ investCountryFlag: flag }, subcategory), accepted.includes(flag), `${subcategory}/${flag}`);
    }
  }
});

test("equitySubcategoryLabel uses plain equity wording", () => {
  assert.equal(equitySubcategoryLabel("domestic"), "หุ้นไทย");
  assert.equal(equitySubcategoryLabel("foreign"), "หุ้นต่างประเทศ");
  assert.equal(equitySubcategoryLabel("domestic_foreign"), "หุ้นไทย + ต่างประเทศ");
  assert.equal(equitySubcategoryLabel("all"), FUND_SUBCATEGORY_LABELS.all);
});

// ---------- copy.ts ----------

test("requestFailureMessage shows the rate-limit copy only for HTTP 429 failures", () => {
  assert.equal(requestFailureMessage(new Error("catalog_429"), "fallback"), RATE_LIMIT_MESSAGE);
  assert.equal(requestFailureMessage(new Error("detail_503"), "fallback"), "fallback");
  assert.equal(requestFailureMessage(new Error("catalog_4290"), "fallback"), "fallback");
  assert.equal(requestFailureMessage("catalog_429", "fallback"), "fallback", "non-Error values never match");
  assert.equal(requestFailureMessage(null, "fallback"), "fallback");
  for (const statement of [INVESTMENT_RISK_STATEMENT, INVESTMENT_NO_GUARANTEE_STATEMENT, RATE_LIMIT_MESSAGE]) assert.match(statement, /[฀-๿]/);
  assert.match(INVESTMENT_NO_GUARANTEE_STATEMENT, /ไม่ใช่คำแนะนำการลงทุน/);
  assert.match(INVESTMENT_NO_GUARANTEE_STATEMENT, /ผลการดำเนินงานในอดีต/);
});

// ---------- detail-to-planning.ts ----------

function detailFor(fund: PlanningFund, overrides: Partial<FundDetailResponse> = {}): FundDetailResponse {
  return {
    source: "sec_v2", state: "fresh",
    fund: { projectId: fund.projectId, amcId: "A", amcNameTh: "บลจ.", amcNameEn: null, nameTh: fund.name, nameEn: null, abbreviation: fund.shortName, fundStatus: "Registered", policyDesc: "ตราสารทุน", category: "equity", investCountryFlag: "3", managementStyle: null, masterFund: null, feederCountry: null, lastUpdated: "2026-09-30" },
    classes: [], selectedClassName: null, specifications: [],
    risk: { level: 6, rawCode: "RS6", description: null, sourceDate: "2026-09-01", lastUpdated: null },
    assetAllocation: [{ name: "ตราสารทุน", percentNav: 97.5, sourceDate: "2026-09-01", lastUpdated: null }, { name: "เงินฝาก", percentNav: 2.5, sourceDate: "2026-09-01", lastUpdated: null }],
    dealing: null, dataDate: null, fetchedAt: "2026-10-24T00:00:00Z", warnings: ["w"], endpointStates: {}, snapshotIds: ["detail-snap"],
    ...overrides,
  };
}

test("planningFundFromDetail maps exact SEC labels, falls back to the profile date and merges snapshots", () => {
  const live: PlanningFund = { ...demo("uat-equity-01"), projectId: "M0002_2567", provenance: { ...demo("uat-equity-01").provenance, source: "sec_v2", snapshotIds: ["profile-snap"] } };
  const mapped = planningFundFromDetail(live, detailFor(live), null);
  assert.deepEqual(mapped.assetAllocation.map((row) => [row.asset, row.percent]), [["equity", 97.5], ["cash", 2.5]]);
  assert.equal(mapped.riskSpectrum, 6);
  assert.equal(mapped.provenance.sourceDate, "2026-09-30", "no data date -> profile last update");
  assert.deepEqual(mapped.provenance.snapshotIds, ["profile-snap", "detail-snap"]);
  assert.equal(mapped.liquidity.normalized, "unknown", "no class choice -> no dealing facts");
  assert.deepEqual(mapped.provenance.notes, ["w"]);
});

test("planningFundFromDetail rejects unavailable, cross-source, cross-project and unknown-class details", () => {
  const live: PlanningFund = { ...demo("uat-equity-01"), projectId: "M0002_2567", provenance: { ...demo("uat-equity-01").provenance, source: "sec_v2" } };
  assert.throws(() => planningFundFromDetail(live, detailFor(live, { state: "unavailable" }), null), /identity_unavailable/);
  assert.throws(() => planningFundFromDetail(live, detailFor(live, { source: "uat_synthetic" }), null), /identity_unavailable/);
  assert.throws(() => planningFundFromDetail(live, detailFor(live, { fund: null }), null), /identity_unavailable/);
  assert.throws(() => planningFundFromDetail(live, detailFor(live, { selectedClassName: "B", classes: [] }), "B"), /class_mismatch/);
  const synthetic = demo("uat-mixed-01");
  const kept = planningFundFromDetail(synthetic, detailFor(synthetic, { source: "uat_synthetic", assetAllocation: [] }), null);
  assert.deepEqual(kept.assetAllocation, synthetic.assetAllocation, "synthetic funds keep their fixture allocation");
});

// ---------- catalog-cursor.ts ----------

test("catalog cursor round-trips issued shapes and rejects tampering", () => {
  assert.deepEqual(parseCatalogCursor(encodeCatalogCursor(INITIAL_CATALOG_CURSOR)), INITIAL_CATALOG_CURSOR);
  const issued = { statusIndex: 1 as const, secCursor: "abc=", offset: 100, skipProjectId: "M0001_2567" };
  assert.deepEqual(parseCatalogCursor(encodeCatalogCursor(issued)), issued);
  assert.equal(parseCatalogCursor(""), null);
  assert.equal(parseCatalogCursor("%%%"), null);
  assert.equal(parseCatalogCursor(encodeCatalogCursor({ ...issued, offset: 101 })), null);
  assert.equal(parseCatalogCursor(encodeCatalogCursor({ ...issued, statusIndex: 2 as never })), null);
  assert.equal(parseCatalogCursor(encodeCatalogCursor({ ...issued, secCursor: "ไทย" })), null, "non-ASCII cursor text is rejected");
  assert.equal(Object.isFrozen(INITIAL_CATALOG_CURSOR), true);
});

// ---------- demo-funds.ts ----------

test("synthetic UAT funds are internally consistent and clearly labelled", () => {
  const ids = new Set<string>();
  for (const fund of UAT_SYNTHETIC_FUNDS) {
    assert.equal(ids.has(fund.id), false, fund.id);
    ids.add(fund.id);
    assert.equal(fund.provenance.source, "uat_synthetic", fund.id);
    assert.match(fund.projectId, /^UAT-[A-Z0-9-]+$/, fund.id);
    assert.ok(sum(fund.assetAllocation.map((row) => row.percent)) <= 100, fund.id);
    assert.ok(fund.riskSpectrum === null || (fund.riskSpectrum >= 1 && fund.riskSpectrum <= 8), fund.id);
  }
  assert.ok(UAT_SYNTHETIC_FUNDS.some((fund) => sum(fund.assetAllocation.map((row) => row.percent)) < 100), "a partial-disclosure fixture exists");
});

test("searchDemoFunds matches name, short name or project and the generic demo keywords", () => {
  assert.deepEqual(searchDemoFunds(""), []);
  assert.deepEqual(searchDemoFunds("   "), []);
  assert.equal(searchDemoFunds("uat").length, UAT_SYNTHETIC_FUNDS.length);
  assert.equal(searchDemoFunds("ตัวอย่าง").length, UAT_SYNTHETIC_FUNDS.length);
  const first = UAT_SYNTHETIC_FUNDS[0];
  assert.ok(searchDemoFunds(first.projectId.toLowerCase()).some((fund) => fund.id === first.id));
  assert.deepEqual(searchDemoFunds("no-such-fund-xyz"), []);
});
