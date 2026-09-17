import "server-only";
import { IS_REVIEW_ENVIRONMENT } from "@/lib/deployment-environment";
import { normalizeLiquidity } from "../domain/calculation";
import { categoryFromPolicy, matchesGeography } from "../domain/catalog";
import type {
  FundAmcOption,
  FundAmcResponse,
  FundAssetAllocationFact,
  FundCatalogCategory,
  FundCatalogItem,
  FundCatalogResponse,
  FundCatalogSubcategory,
  FundClassOption,
  FundDealingFact,
  FundDetailResponse,
  FundRiskFact,
  FundSearchResponse,
  FundSpecificationFact,
  PlanningFund,
} from "../domain/types";
import { searchDemoFunds, UAT_SYNTHETIC_FUNDS } from "./demo-funds";

const SEC_BASE_URL = "https://api.sec.or.th";
const SEC_HEADER = "Ocp-Apim-Subscription-Key";
const SEC_PAGE_SIZE = 100;
const CATALOG_PAGE_SIZE = 20;
const SEC_REVALIDATE_SECONDS = 60 * 60 * 6;
const ACTIVE_STATUSES = ["Registered", "IPO"] as const;

type SecEnvelope = {
  message?: unknown;
  items?: unknown;
  next_cursor?: unknown;
  page_size?: unknown;
};

type CatalogCursor = {
  statusIndex: number;
  secCursor: string;
  offset: number;
  skipProjectId: string | null;
};

type SecRiskRow = {
  risk_spectrum: string | null;
  risk_spectrum_desc: string | null;
  start_date: string | null;
  end_date: string | null;
  prospectus_type: string | null;
  last_upd_date: string | null;
};

function isReviewLikeEnvironment(): boolean {
  const uatMode = process.env.CCPUN_UAT_MODE?.trim().toLowerCase();
  return IS_REVIEW_ENVIRONMENT || process.env.CCPUN_APP_ENV === "web-uat" || uatMode === "1" || uatMode === "true";
}

function getSubscriptionKey(): string | null {
  return process.env.SEC_API_PRIMARY_KEY?.trim() || process.env.SEC_API_SECONDARY_KEY?.trim() || null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asItems(envelope: SecEnvelope): unknown[] {
  return Array.isArray(envelope.items) ? envelope.items : [];
}

function constructionBucketFromCategory(category: FundCatalogCategory): PlanningFund["constructionBucket"] {
  if (category === "equity") return "equity";
  if (category === "mixed") return "mixed";
  if (category === "fixed_income") return "fixed_income";
  return "other";
}

function normalizeCountryFlag(value: unknown): FundCatalogItem["investCountryFlag"] {
  return value === "1" || value === "2" || value === "3" || value === "4" ? value : null;
}

function normalizeCatalogItem(value: unknown): FundCatalogItem | null {
  const row = asRecord(value);
  if (!row) return null;
  const projectId = asString(row.proj_id);
  const abbreviation = asString(row.proj_abbr_name);
  const nameTh = asString(row.proj_name_th);
  const amcId = asString(row.unique_id);
  const amcNameTh = asString(row.comp_name_th);
  const status = asString(row.fund_status);
  if (!projectId || !abbreviation || !nameTh || !amcId || !amcNameTh || (status !== "Registered" && status !== "IPO")) return null;
  const policyDesc = asString(row.policy_desc) ?? "อื่น ๆ";
  return {
    projectId,
    amcId,
    amcNameTh,
    amcNameEn: asString(row.comp_name_en),
    nameTh,
    nameEn: asString(row.proj_name_en),
    abbreviation,
    fundStatus: status,
    policyDesc,
    category: categoryFromPolicy(policyDesc),
    investCountryFlag: normalizeCountryFlag(row.invest_country_flag),
    managementStyle: asString(row.management_style),
    masterFund: asString(row.feederfund_master_fund),
    feederCountry: asString(row.feederfund_country),
    lastUpdated: asString(row.last_upd_date),
  };
}

function normalizeAmc(value: unknown): FundAmcOption | null {
  const row = asRecord(value);
  if (!row) return null;
  const id = asString(row.unique_id);
  const nameTh = asString(row.comp_name_th);
  if (!id || !nameTh) return null;
  return {
    id,
    nameTh,
    nameEn: asString(row.comp_name_en),
    lastUpdated: asString(row.last_upd_date),
  };
}

function normalizeClass(value: unknown): FundClassOption | null {
  const row = asRecord(value);
  if (!row) return null;
  const name = asString(row.fund_class_name);
  if (!name) return null;
  return {
    name,
    detail: asString(row.fund_class_detail),
    description: asString(row.fund_class_description),
    taxIncentiveType: asString(row.fund_class_tax_incentive_type),
    isin: asString(row.fund_class_isin_code),
  };
}

function normalizeRisk(value: unknown): SecRiskRow | null {
  const row = asRecord(value);
  if (!row) return null;
  return {
    risk_spectrum: asString(row.risk_spectrum),
    risk_spectrum_desc: asString(row.risk_spectrum_desc),
    start_date: asString(row.start_date),
    end_date: asString(row.end_date),
    prospectus_type: asString(row.prospectus_type),
    last_upd_date: asString(row.last_upd_date),
  };
}

function riskLevel(value: string | null): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | null {
  if (!value) return null;
  const match = value.toUpperCase().match(/^RS([1-8])$/);
  return match ? Number(match[1]) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 : null;
}

function normalizeSettlementBucket(raw: string | null) {
  if (!raw) return "unknown" as const;
  const value = raw.trim().toUpperCase();
  if (/^T\+1\b/.test(value)) return "T+1" as const;
  if (/^T\+2\b/.test(value)) return "T+2" as const;
  if (/^T\+3\b/.test(value)) return "T+3" as const;
  return normalizeLiquidity(raw);
}

async function secGet(path: string, key: string, revalidate = SEC_REVALIDATE_SECONDS): Promise<SecEnvelope> {
  const response = await fetch(`${SEC_BASE_URL}${path}`, {
    method: "GET",
    headers: { [SEC_HEADER]: key, Accept: "application/json" },
    next: { revalidate },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`sec_http_${response.status}`);
  const body: unknown = await response.json();
  const envelope = asRecord(body);
  if (!envelope) throw new Error("sec_invalid_envelope");
  return envelope as SecEnvelope;
}

function encodeCatalogCursor(cursor: CatalogCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCatalogCursor(value: string | null | undefined): CatalogCursor {
  if (!value) return { statusIndex: 0, secCursor: "", offset: 0, skipProjectId: null };
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<CatalogCursor>;
    const statusIndex = parsed.statusIndex === 1 ? 1 : 0;
    const secCursor = typeof parsed.secCursor === "string" ? parsed.secCursor : "";
    const offset = typeof parsed.offset === "number" && Number.isInteger(parsed.offset) && parsed.offset >= 0 ? parsed.offset : 0;
    const skipProjectId = typeof parsed.skipProjectId === "string" && parsed.skipProjectId ? parsed.skipProjectId : null;
    return { statusIndex, secCursor, offset, skipProjectId };
  } catch {
    return { statusIndex: 0, secCursor: "", offset: 0, skipProjectId: null };
  }
}

let moneyMarketIdsPromise: Promise<Set<string>> | null = null;

async function loadMoneyMarketProjectIds(key: string): Promise<Set<string>> {
  if (moneyMarketIdsPromise) return moneyMarketIdsPromise;
  moneyMarketIdsPromise = (async () => {
    const ids = new Set<string>();
    let cursor = "";
    for (let page = 0; page < 100; page += 1) {
      const params = new URLSearchParams({ page_size: String(SEC_PAGE_SIZE) });
      if (cursor) params.set("next_cursor", cursor);
      const envelope = await secGet(`/v2/fund/general-info/specifications?${params.toString()}`, key);
      for (const item of asItems(envelope)) {
        const row = asRecord(item);
        if (!row || asString(row.spec_code) !== "MM") continue;
        const projectId = asString(row.proj_id);
        if (projectId) ids.add(projectId);
      }
      cursor = asString(envelope.next_cursor) ?? "";
      if (!cursor) break;
    }
    return ids;
  })().catch((error) => {
    moneyMarketIdsPromise = null;
    throw error;
  });
  return moneyMarketIdsPromise;
}

export async function listFundAmcs(): Promise<FundAmcResponse> {
  const fetchedAt = new Date().toISOString();
  const key = getSubscriptionKey();

  if (!key) {
    if (!isReviewLikeEnvironment()) {
      return { source: "unavailable", state: "unavailable", items: [], fetchedAt, message: "รายชื่อ บลจ. ยังไม่พร้อมใช้งาน" };
    }
    return {
      source: "uat_synthetic",
      state: "demo",
      items: [{ id: "UAT-AMC", nameTh: "บลจ. ตัวอย่าง", nameEn: null, lastUpdated: null }],
      fetchedAt,
      message: "ใช้รายชื่อจำลองชั่วคราว",
    };
  }

  try {
    const items: FundAmcOption[] = [];
    const seen = new Set<string>();
    let cursor = "";
    for (let page = 0; page < 20; page += 1) {
      const params = new URLSearchParams({ page_size: String(SEC_PAGE_SIZE) });
      if (cursor) params.set("next_cursor", cursor);
      const envelope = await secGet(`/v2/fund/general-info/amcs?${params.toString()}`, key, 60 * 60 * 24);
      for (const raw of asItems(envelope)) {
        const amc = normalizeAmc(raw);
        if (!amc || seen.has(amc.id)) continue;
        seen.add(amc.id);
        items.push(amc);
      }
      cursor = asString(envelope.next_cursor) ?? "";
      if (!cursor) break;
    }
    items.sort((a, b) => a.nameTh.localeCompare(b.nameTh, "th"));
    return { source: "sec_v2", state: "fresh", items, fetchedAt, message: null };
  } catch {
    return { source: "unavailable", state: "unavailable", items: [], fetchedAt, message: "โหลดรายชื่อ บลจ. ไม่สำเร็จชั่วคราว" };
  }
}

function demoCatalogItems(): FundCatalogItem[] {
  return UAT_SYNTHETIC_FUNDS.map((fund) => {
    const category: FundCatalogCategory = fund.constructionBucket === "equity"
      ? "equity"
      : fund.constructionBucket === "mixed"
        ? "mixed"
        : fund.constructionBucket === "fixed_income" || fund.constructionBucket === "money_market"
          ? "fixed_income"
          : "other";
    return {
      projectId: fund.projectId,
      amcId: "UAT-AMC",
      amcNameTh: "UAT Asset Management (ข้อมูลสังเคราะห์)",
      amcNameEn: null,
      nameTh: fund.name,
      nameEn: null,
      abbreviation: fund.shortName,
      fundStatus: "Registered",
      policyDesc: category === "equity" ? "ตราสารทุน" : category === "mixed" ? "ผสม" : category === "fixed_income" ? "ตราสารหนี้" : "อื่น ๆ",
      category,
      investCountryFlag: null,
      managementStyle: null,
      masterFund: fund.masterFund,
      feederCountry: null,
      lastUpdated: fund.provenance.sourceDate,
    };
  });
}

export async function listFundCatalog(options: {
  query?: string;
  category?: FundCatalogCategory | "all";
  subcategory?: FundCatalogSubcategory;
  amcId?: string | null;
  cursor?: string | null;
  limit?: number;
}): Promise<FundCatalogResponse> {
  const fetchedAt = new Date().toISOString();
  const query = options.query?.trim().slice(0, 120) ?? "";
  const category = options.category ?? "all";
  const subcategory = options.subcategory ?? "all";
  const amcId = options.amcId?.trim() || null;
  const limit = Math.min(40, Math.max(8, options.limit ?? CATALOG_PAGE_SIZE));
  const key = getSubscriptionKey();

  if (!key) {
    if (!isReviewLikeEnvironment()) {
      return { source: "unavailable", state: "unavailable", items: [], nextCursor: null, hasMore: false, query, category, subcategory, amcId, fetchedAt, message: "บริการข้อมูลกองทุนยังไม่พร้อมใช้งาน" };
    }
    const normalizedQuery = query.toLowerCase();
    const items = demoCatalogItems().filter((item) => {
      if (normalizedQuery && !`${item.nameTh} ${item.abbreviation}`.toLowerCase().includes(normalizedQuery)) return false;
      if (category !== "all" && item.category !== category) return false;
      if (amcId && item.amcId !== amcId) return false;
      return true;
    }).slice(0, limit);
    return { source: "uat_synthetic", state: "demo", items, nextCursor: null, hasMore: false, query, category, subcategory, amcId, fetchedAt, message: "กำลังใช้ข้อมูลตัวอย่างชั่วคราว" };
  }

  try {
    const moneyMarketIds = subcategory === "money_market" ? await loadMoneyMarketProjectIds(key) : null;
    const start = decodeCatalogCursor(options.cursor);
    const results: FundCatalogItem[] = [];
    const seen = new Set<string>();
    let statusIndex = start.statusIndex;
    let secCursor = start.secCursor;
    let offset = start.offset;
    const skipProjectId = start.skipProjectId;
    let pagesScanned = 0;

    while (statusIndex < ACTIVE_STATUSES.length && results.length < limit && pagesScanned < 16) {
      const status = ACTIVE_STATUSES[statusIndex];
      const currentCursor = secCursor;
      const params = new URLSearchParams({ page_size: String(SEC_PAGE_SIZE), fund_status: status });
      if (query) params.set("project_info", query);
      if (amcId) params.set("company_info", amcId);
      if (currentCursor) params.set("next_cursor", currentCursor);
      const envelope = await secGet(`/v2/fund/general-info/profiles?${params.toString()}`, key);
      const rawItems = asItems(envelope);
      pagesScanned += 1;

      for (let index = offset; index < rawItems.length; index += 1) {
        const item = normalizeCatalogItem(rawItems[index]);
        if (!item) continue;
        if (skipProjectId && item.projectId === skipProjectId) continue;
        if (seen.has(item.projectId)) continue;
        if (category !== "all" && item.category !== category) continue;
        if (!matchesGeography(item, subcategory)) continue;
        if (subcategory === "money_market" && !moneyMarketIds?.has(item.projectId)) continue;
        seen.add(item.projectId);
        results.push(item);
        if (results.length >= limit) {
          return {
            source: "sec_v2",
            state: "fresh",
            items: results,
            nextCursor: encodeCatalogCursor({ statusIndex, secCursor: currentCursor, offset: index + 1, skipProjectId: item.projectId }),
            hasMore: true,
            query,
            category,
            subcategory,
            amcId,
            fetchedAt,
            message: null,
          };
        }
      }

      offset = 0;
      const next = asString(envelope.next_cursor) ?? "";
      if (next) {
        secCursor = next;
      } else {
        statusIndex += 1;
        secCursor = "";
      }
    }

    const hasMore = statusIndex < ACTIVE_STATUSES.length;
    return {
      source: "sec_v2",
      state: results.length ? "fresh" : "unavailable",
      items: results,
      nextCursor: hasMore ? encodeCatalogCursor({ statusIndex, secCursor, offset: 0, skipProjectId: null }) : null,
      hasMore,
      query,
      category,
      subcategory,
      amcId,
      fetchedAt,
      message: results.length ? null : "ไม่พบกองทุนที่ตรงกับตัวกรองนี้",
    };
  } catch {
    return { source: "unavailable", state: "unavailable", items: [], nextCursor: null, hasMore: false, query, category, subcategory, amcId, fetchedAt, message: "โหลดข้อมูลกองทุนไม่สำเร็จชั่วคราว" };
  }
}

async function settledEnvelope(path: string, key: string): Promise<{ state: "ok" | "empty" | "unavailable"; items: unknown[] }> {
  try {
    const envelope = await secGet(path, key);
    const items = asItems(envelope);
    return { state: items.length ? "ok" : "empty", items };
  } catch {
    return { state: "unavailable", items: [] };
  }
}

function latestDate(values: Array<string | null | undefined>): string | null {
  const dates = values.filter((value): value is string => Boolean(value));
  return dates.length ? dates.sort((a, b) => b.localeCompare(a))[0] : null;
}

export async function getFundDetail(projectId: string, requestedClassName?: string | null): Promise<FundDetailResponse> {
  const fetchedAt = new Date().toISOString();
  const key = getSubscriptionKey();
  if (!key || !/^M\d{4}_\d{4}$/.test(projectId)) {
    return { source: "unavailable", state: "unavailable", fund: null, classes: [], selectedClassName: null, specifications: [], risk: null, assetAllocation: [], dealing: null, dataDate: null, fetchedAt, warnings: ["ข้อมูลรายละเอียดกองทุนยังไม่พร้อมใช้งาน"], endpointStates: {} };
  }

  const encoded = encodeURIComponent(projectId);
  const [profileResult, specificationResult, riskResult, allocationResult, dealingResult] = await Promise.all([
    settledEnvelope(`/v2/fund/general-info/profiles?project_info=${encoded}&page_size=100`, key),
    settledEnvelope(`/v2/fund/general-info/specifications?proj_id=${encoded}&page_size=100`, key),
    settledEnvelope(`/v2/fund/factsheet/risk-spectrum?proj_id=${encoded}&latest=true&page_size=100`, key),
    settledEnvelope(`/v2/fund/factsheet/asset-allocation?proj_id=${encoded}&latest=true&page_size=100`, key),
    settledEnvelope(`/v2/fund/factsheet/subscription-redemption-periods?proj_id=${encoded}&latest=true&page_size=100`, key),
  ]);

  const profileRows = profileResult.items.map(asRecord).filter((row): row is Record<string, unknown> => Boolean(row));
  const activeProfiles = profileRows.filter((row) => row.fund_status === "Registered" || row.fund_status === "IPO");
  const fund = normalizeCatalogItem(activeProfiles[0] ?? profileRows[0]);
  const classes = activeProfiles.map(normalizeClass).filter((row): row is FundClassOption => Boolean(row));
  const classNames = new Set(classes.map((row) => row.name));
  const requested = requestedClassName?.trim() || null;
  const selectedClassName = requested && classNames.has(requested)
    ? requested
    : classes.length === 1
      ? classes[0].name
      : classNames.has("main")
        ? "main"
        : null;

  const specifications: FundSpecificationFact[] = specificationResult.items.flatMap((value) => {
    const row = asRecord(value);
    if (!row) return [];
    const code = asString(row.spec_code);
    const description = asString(row.spec_desc);
    const className = asString(row.fund_class_name);
    if (!code || !description || !className) return [];
    return [{ code, description, className, lastUpdated: asString(row.last_upd_date) }];
  }).filter((row) => !selectedClassName || row.className === selectedClassName || row.className === "main");

  const riskRow = riskResult.items.map(normalizeRisk).find((row): row is SecRiskRow => Boolean(row)) ?? null;
  const risk: FundRiskFact | null = riskRow ? {
    level: riskLevel(riskRow.risk_spectrum),
    rawCode: riskRow.risk_spectrum,
    description: riskRow.risk_spectrum_desc,
    sourceDate: riskRow.start_date,
    lastUpdated: riskRow.last_upd_date,
  } : null;

  const assetAllocation: FundAssetAllocationFact[] = allocationResult.items.flatMap((value) => {
    const row = asRecord(value);
    if (!row) return [];
    const name = asString(row.asset_name);
    const percentNav = asNumber(row.asset_ratio);
    if (!name || percentNav === null) return [];
    return [{ name, percentNav, sourceDate: asString(row.start_date), lastUpdated: asString(row.last_upd_date) }];
  }).sort((a, b) => b.percentNav - a.percentNav);

  let dealing: FundDealingFact | null = null;
  if (selectedClassName) {
    const classRows = dealingResult.items.map(asRecord).filter((row): row is Record<string, unknown> => Boolean(row) && asString((row as Record<string, unknown>).fund_class_name) === selectedClassName);
    const subscription = classRows.find((row) => asString(row.type) === "subscription") ?? null;
    const redemption = classRows.find((row) => asString(row.type) === "redemption") ?? null;
    const settlementPeriod = redemption ? asString(redemption.settlement_period) : null;
    const sourceDate = latestDate([subscription ? asString(subscription.start_date) : null, redemption ? asString(redemption.start_date) : null]);
    const lastUpdated = latestDate([subscription ? asString(subscription.last_upd_date) : null, redemption ? asString(redemption.last_upd_date) : null]);
    dealing = {
      className: selectedClassName,
      subscriptionPeriod: subscription ? asString(subscription.period) : null,
      subscriptionPeriodOther: subscription ? asString(subscription.redemp_period_oth) : null,
      redemptionPeriod: redemption ? asString(redemption.period) : null,
      redemptionPeriodOther: redemption ? asString(redemption.redemp_period_oth) : null,
      settlementPeriod,
      settlementBucket: normalizeSettlementBucket(settlementPeriod),
      sourceDate,
      lastUpdated,
    };
  }

  const endpointStates = {
    profile: profileResult.state,
    specification: specificationResult.state,
    risk: riskResult.state,
    allocation: allocationResult.state,
    dealing: dealingResult.state,
  };
  const warnings: string[] = [];
  if (!fund) warnings.push("ยังไม่พบข้อมูลพื้นฐานของกองทุนนี้");
  if (classes.length > 1 && !selectedClassName) warnings.push("กองนี้มีหลายชนิดหน่วยลงทุน กรุณาเลือกชนิดหน่วยก่อนดูเงื่อนไขซื้อขาย");
  if (!risk) warnings.push("ยังไม่มีข้อมูลระดับความเสี่ยงที่แสดงได้ในตอนนี้");
  if (!assetAllocation.length) warnings.push("ยังไม่มีข้อมูลสัดส่วนสินทรัพย์ที่แสดงได้ในตอนนี้");
  if (assetAllocation.some((row) => row.percentNav < 0)) warnings.push("ข้อมูลสัดส่วนสินทรัพย์มีบางรายการเป็นค่าติดลบตามที่กองทุนรายงาน ระบบจึงแสดงตามต้นทางโดยไม่ปรับตัวเลขเอง");
  const assetTotal = assetAllocation.reduce((sum, row) => sum + row.percentNav, 0);
  if (assetAllocation.length && Math.abs(assetTotal - 100) > 0.5) warnings.push(`สัดส่วนสินทรัพย์ที่รายงานรวม ${Math.round(assetTotal * 100) / 100}% ระบบแสดงตามข้อมูลต้นทางโดยไม่ปรับให้เป็น 100%`);
  if (selectedClassName && !dealing) warnings.push("ยังไม่มีข้อมูลเงื่อนไขซื้อและขายคืนสำหรับชนิดหน่วยที่เลือก");
  if (Object.values(endpointStates).includes("unavailable")) warnings.push("ข้อมูลบางส่วนจาก ก.ล.ต. ไม่พร้อมใช้งานชั่วคราว");
  if (risk?.rawCode && !risk.level) warnings.push("ข้อมูลระดับความเสี่ยงของกองนี้อยู่ในรูปแบบที่เครื่องมือยังไม่สามารถแสดงเป็นระดับ 1–8 ได้");

  const dataDate = latestDate([
    risk?.sourceDate,
    ...assetAllocation.map((row) => row.sourceDate),
    dealing?.sourceDate,
  ]);
  const state = fund && risk && assetAllocation.length ? (Object.values(endpointStates).includes("unavailable") ? "partial" : "fresh") : "partial";

  return { source: "sec_v2", state, fund, classes, selectedClassName, specifications, risk, assetAllocation, dealing, dataDate, fetchedAt, warnings, endpointStates };
}

async function loadLatestRisk(projectId: string, key: string): Promise<{ level: number | null; sourceDate: string | null; snapshotId: string }> {
  const params = new URLSearchParams({ proj_id: projectId, latest: "true", page_size: "100" });
  const envelope = await secGet(`/v2/fund/factsheet/risk-spectrum?${params.toString()}`, key);
  const latest = asItems(envelope).map(normalizeRisk).find((row): row is SecRiskRow => Boolean(row)) ?? null;
  return { level: riskLevel(latest?.risk_spectrum ?? null), sourceDate: latest?.start_date ?? null, snapshotId: `sec-v2:risk-spectrum:${projectId}:${latest?.start_date ?? "unknown"}` };
}

function profileToPlanningFund(profile: FundCatalogItem, risk: { level: number | null; sourceDate: string | null; snapshotId: string } | null, fetchedAt: string): PlanningFund {
  return {
    id: `sec:${profile.projectId}:project`,
    projectId: profile.projectId,
    className: null,
    name: profile.nameTh,
    shortName: profile.abbreviation,
    constructionBucket: constructionBucketFromCategory(profile.category),
    policyText: profile.policyDesc,
    riskSpectrum: risk?.level ?? null,
    assetAllocation: [],
    liquidity: { rawText: null, normalized: "unknown", sourceDate: null },
    feeSummary: null,
    masterFund: profile.masterFund,
    provenance: {
      source: "sec_v2",
      snapshotIds: [`sec-v2:profile:${profile.projectId}:${profile.lastUpdated ?? "unknown"}`, ...(risk ? [risk.snapshotId] : [])],
      sourceDate: risk?.sourceDate ?? profile.lastUpdated,
      fetchedAt,
      state: "partial",
      notes: ["Fund profile and Risk Spectrum come from SEC v2. Asset Allocation and dealing details are loaded only after fund selection."],
    },
  };
}

export async function searchPlanningFunds(query: string): Promise<FundSearchResponse> {
  const normalizedQuery = query.trim().slice(0, 120);
  const fetchedAt = new Date().toISOString();
  const key = getSubscriptionKey();
  if (!normalizedQuery) return { mode: key ? "sec_live" : "uat_demo", state: "unavailable", query: "", funds: [], message: "กรอกชื่อกองหรือชื่อย่อเพื่อค้นหา", fetchedAt };

  if (!key) {
    if (!isReviewLikeEnvironment()) return { mode: "sec_live", state: "unavailable", query: normalizedQuery, funds: [], message: "บริการค้นหาข้อมูลกองทุนยังไม่พร้อมใช้งาน", fetchedAt };
    return { mode: "uat_demo", state: "demo", query: normalizedQuery, funds: searchDemoFunds(normalizedQuery), message: "กำลังใช้ข้อมูลตัวอย่างชั่วคราว", fetchedAt };
  }

  const catalog = await listFundCatalog({ query: normalizedQuery, limit: 8 });
  if (catalog.source !== "sec_v2") return { mode: "sec_live", state: "unavailable", query: normalizedQuery, funds: [], message: catalog.message, fetchedAt };
  const funds = await Promise.all(catalog.items.map(async (profile) => {
    try { return profileToPlanningFund(profile, await loadLatestRisk(profile.projectId, key), fetchedAt); }
    catch { return profileToPlanningFund(profile, null, fetchedAt); }
  }));
  return { mode: "sec_live", state: funds.length ? "partial" : "unavailable", query: normalizedQuery, funds, message: funds.length ? "ผลค้นหาจากข้อมูลกองทุนของ ก.ล.ต." : "ไม่พบกองทุนจากคำค้นนี้", fetchedAt };
}
