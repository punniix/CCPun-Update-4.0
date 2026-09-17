export type ConstructionBucket = "mixed" | "equity" | "fixed_income" | "money_market" | "other";
export type AssetBucket = "equity" | "fixed_income" | "cash" | "other" | "unknown";
export type LiquidityBucket = "T+1" | "T+2" | "T+3" | "other" | "unknown";
export type DataState = "fresh" | "stale" | "partial" | "unavailable" | "demo";
export type FundSource = "sec_v2" | "uat_synthetic";

export type AllocationRow<T extends string> = {
  key: T;
  percent: number;
};

export type FundAssetAllocation = {
  asset: Exclude<AssetBucket, "unknown">;
  percent: number;
  label: string;
  sourceDate: string | null;
};

export type FundLiquidity = {
  rawText: string | null;
  normalized: LiquidityBucket;
  sourceDate: string | null;
};

export type FundProvenance = {
  source: FundSource;
  snapshotIds: string[];
  sourceDate: string | null;
  fetchedAt: string;
  state: DataState;
  notes: string[];
};

export type PlanningFund = {
  id: string;
  projectId: string;
  className: string | null;
  name: string;
  shortName: string;
  constructionBucket: ConstructionBucket | null;
  policyText: string | null;
  riskSpectrum: number | null;
  assetAllocation: FundAssetAllocation[];
  liquidity: FundLiquidity;
  feeSummary: string | null;
  masterFund: string | null;
  provenance: FundProvenance;
};

export type SelectedFund = {
  fund: PlanningFund;
  weightPercent: number;
  selectionSource: "customer";
};

export type EffectiveAllocationRow = AllocationRow<AssetBucket> & {
  amount: number;
};

export type RiskDistributionRow = {
  level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | "unknown";
  percent: number;
  amount: number;
};

export type LiquidityDistributionRow = {
  bucket: LiquidityBucket;
  percent: number;
  amount: number;
};

export type TargetDelta = {
  asset: Exclude<AssetBucket, "unknown">;
  targetPercent: number;
  effectivePercent: number;
  deltaPercentagePoints: number | null;
  conclusive: boolean;
};

export type PlanWarningCode =
  | "demo_data"
  | "partial_asset_allocation"
  | "missing_risk"
  | "missing_liquidity"
  | "target_not_set"
  | "target_delta_inconclusive"
  | "stale_data";

export type InvestmentPlanResult = {
  investmentAmount: number;
  fundConstructionAllocation: AllocationRow<ConstructionBucket>[];
  targetAssetAllocation: AllocationRow<Exclude<AssetBucket, "unknown">>[];
  selectedFunds: SelectedFund[];
  effectiveAllocation: EffectiveAllocationRow[];
  riskDistribution: RiskDistributionRow[];
  liquiditySummary: LiquidityDistributionRow[];
  targetDelta: TargetDelta[];
  warnings: PlanWarningCode[];
  snapshotIds: string[];
  coverage: {
    effectiveAssetPercentKnown: number;
    riskPercentKnown: number;
    liquidityPercentKnown: number;
  };
};

export type AdvisorHandoffPayload = {
  schema_version: 1;
  plan_id: string;
  investment_amount: number;
  fund_construction_allocation: AllocationRow<ConstructionBucket>[];
  target_asset_allocation: AllocationRow<Exclude<AssetBucket, "unknown">>[];
  selected_funds: Array<{
    project_id: string;
    class_name: string | null;
    fund_name: string;
    selected_weight_percent: number;
    selection_source: "customer";
  }>;
  effective_allocation: EffectiveAllocationRow[];
  risk_distribution: RiskDistributionRow[];
  liquidity_summary: LiquidityDistributionRow[];
  warnings: PlanWarningCode[];
  sec_snapshot_ids: string[];
  methodology_version: "investment_allocation_v1";
  created_at: string;
};

export type FundSearchResponse = {
  mode: "sec_live" | "uat_demo";
  state: DataState;
  query: string;
  funds: PlanningFund[];
  message: string | null;
  fetchedAt: string;
};

export type FundCatalogCategory = "equity" | "mixed" | "fixed_income" | "alternative" | "other";
export type FundCatalogSubcategory = "all" | "domestic" | "foreign" | "domestic_foreign" | "money_market";

export type FundCatalogItem = {
  projectId: string;
  amcId: string;
  amcNameTh: string;
  amcNameEn: string | null;
  nameTh: string;
  nameEn: string | null;
  abbreviation: string;
  fundStatus: "Registered" | "IPO";
  policyDesc: string;
  category: FundCatalogCategory;
  investCountryFlag: "1" | "2" | "3" | "4" | null;
  managementStyle: string | null;
  masterFund: string | null;
  feederCountry: string | null;
  lastUpdated: string | null;
};

export type FundCatalogResponse = {
  source: "sec_v2" | "uat_synthetic" | "unavailable";
  state: DataState;
  items: FundCatalogItem[];
  nextCursor: string | null;
  hasMore: boolean;
  query: string;
  category: FundCatalogCategory | "all";
  subcategory: FundCatalogSubcategory;
  fetchedAt: string;
  message: string | null;
};

export type FundClassOption = {
  name: string;
  detail: string | null;
  description: string | null;
  taxIncentiveType: string | null;
  isin: string | null;
};

export type FundSpecificationFact = {
  code: string;
  description: string;
  className: string;
  lastUpdated: string | null;
};

export type FundRiskFact = {
  level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | null;
  rawCode: string | null;
  description: string | null;
  sourceDate: string | null;
  lastUpdated: string | null;
};

export type FundAssetAllocationFact = {
  name: string;
  percentNav: number;
  sourceDate: string | null;
  lastUpdated: string | null;
};

export type FundDealingFact = {
  className: string;
  subscriptionPeriod: string | null;
  subscriptionPeriodOther: string | null;
  redemptionPeriod: string | null;
  redemptionPeriodOther: string | null;
  settlementPeriod: string | null;
  settlementBucket: LiquidityBucket;
  sourceDate: string | null;
  lastUpdated: string | null;
};

export type FundDetailResponse = {
  source: "sec_v2" | "unavailable";
  state: DataState;
  fund: FundCatalogItem | null;
  classes: FundClassOption[];
  selectedClassName: string | null;
  specifications: FundSpecificationFact[];
  risk: FundRiskFact | null;
  assetAllocation: FundAssetAllocationFact[];
  dealing: FundDealingFact | null;
  dataDate: string | null;
  fetchedAt: string;
  warnings: string[];
  endpointStates: Record<string, "ok" | "empty" | "unavailable">;
};
