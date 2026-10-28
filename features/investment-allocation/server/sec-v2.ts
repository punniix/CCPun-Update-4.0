import "server-only";
import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { IS_REVIEW_ENVIRONMENT } from "@/lib/deployment-environment";
import { deploymentContractFailures, getDeploymentLaneByEnvironment } from "@/lib/runtime/deployment-contract";
import { normalizeLiquidity } from "../domain/calculation";
import { categoryFromPolicy, matchesGeography } from "../domain/catalog";
import { amcAllowedInScope, isAiaAmcName, type FundScope } from "../domain/fund-scope";
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
import { searchDemoFunds, syntheticAmcFor, UAT_SYNTHETIC_AIA_AMC, UAT_SYNTHETIC_FUNDS } from "./demo-funds";
import { encodeCatalogCursor, INITIAL_CATALOG_CURSOR, parseCatalogCursor } from "./catalog-cursor";
import { SEC_BASE_URL, SEC_HEADER, SEC_PAGE_SIZE, SEC_PUBLIC_FIELDS } from "./sec-projection";
import { getFundCatalogStore, type StoredCatalog, type StoredFund } from "./fund-catalog-store";
import { FUND_LIVE_FALLBACK_LEASE_SECONDS, readThroughStore } from "./store-fallback";
const CATALOG_PAGE_SIZE = 20;
// Upper bound on upstream SEC profile pages one catalog request may scan.
const MAX_CATALOG_SEC_PAGES_PER_REQUEST = 16;
const SEC_REVALIDATE_SECONDS = 60 * 60 * 6;
const SEC_CACHE_MAX_BYTES = 1024 * 1024;
const ACTIVE_STATUSES = ["Registered", "IPO"] as const;
// Wall-clock budget for one multi-page request (each upstream call also has its own
// 10 s timeout). Catalog returns what it has plus a resume cursor; AMCs fail soft.
const MULTI_PAGE_BUDGET_MS = 20_000;
// The resolved AIA AMC id is kept per server process; the AMC pages behind it are
// already cached for 24 h by secGet. Only a successful, unambiguous match is kept.
const AIA_AMC_ID_TTL_MS = 6 * 60 * 60 * 1000;
const AIA_UNRESOLVED_MESSAGE = "ยังระบุ บลจ. เอไอเอ จากข้อมูล ก.ล.ต. ไม่ได้ชั่วคราว";
// Stored catalog (Neon ccpun_fund, written by the private VPS sync job). New copy
// pending owner approval (2026-10-26).
const AIA_STORE_BUSY_MESSAGE = "กำลังอัปเดตข้อมูลกองทุน กรุณาลองใหม่อีกครั้งในอีกสักครู่";
const AIA_STORE_STALE_MESSAGE = "ข้อมูลกองทุนอาจยังไม่อัปเดตล่าสุด";
const AIA_FUND_HIDDEN_WARNING = "กองทุนนี้ยกเลิกหรือควบรวมแล้วตามข้อมูล ก.ล.ต. จึงไม่แสดงในเครื่องมือนี้";
// Marks a catalog cursor issued from the stored catalog; it never reaches SEC.
const STORE_CURSOR = "ccpun-store-v1";

type SecEnvelope = {
  message?: unknown;
  items?: unknown;
  next_cursor?: unknown;
  page_size?: unknown;
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

// SEC numeric facts may arrive as JSON numbers or plain decimal strings.
function asDecimal(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !/^\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)\s*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
  const flag = typeof value === "number" && Number.isInteger(value) ? String(value) : typeof value === "string" ? value.trim() : null;
  return flag === "1" || flag === "2" || flag === "3" || flag === "4" ? flag : null;
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

class UncachedSecEnvelope extends Error {
  constructor(readonly envelope: SecEnvelope) {
    super("sec_projection_exceeds_cache_budget");
  }
}

class InvalidSecJson extends Error {
  readonly httpStatus: number | null;
  readonly contentType: "json" | "html" | "text" | "other" | "missing";

  constructor(status: number, contentType: string | null, readonly emptyBody: boolean) {
    super("sec_invalid_json");
    this.httpStatus = Number.isInteger(status) && status >= 100 && status <= 599 ? status : null;
    const mime = contentType?.split(";", 1)[0]?.trim().toLowerCase();
    this.contentType = !mime ? "missing" : mime === "application/json" || mime.endsWith("+json") ? "json"
      : mime === "text/html" ? "html" : mime === "text/plain" ? "text" : "other";
  }
}

async function readSecEnvelope(path: string, key: string): Promise<SecEnvelope> {
  const response = await fetch(`${SEC_BASE_URL}${path}`, {
    method: "GET",
    headers: { [SEC_HEADER]: key, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`sec_http_${response.status}`);
  if (response.status === 204) return { items: [], next_cursor: null, page_size: null };
  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    // Retain only fixed diagnostic metadata, never the body or parser error.
    throw new InvalidSecJson(response.status, response.headers.get("content-type"), text.length === 0);
  }
  const envelope = asRecord(body);
  if (!envelope) throw new Error("sec_invalid_envelope");
  return {
    items: asItems(envelope).map((value) => {
      const row = asRecord(value);
      if (!row) return null;
      return Object.fromEntries(SEC_PUBLIC_FIELDS.flatMap((field) => {
        const value = row[field];
        return typeof value === "string" || typeof value === "number" || value === null ? [[field, value]] : [];
      }));
    }),
    next_cursor: asString(envelope.next_cursor),
    page_size: asNumber(envelope.page_size),
  };
}

async function secGet(path: string, key: string, revalidate = SEC_REVALIDATE_SECONDS): Promise<SecEnvelope> {
  const params = new URL(path, SEC_BASE_URL).searchParams;
  const projectInfo = params.get("project_info");
  // Free text is transient input. Persist neither it nor its returned search page.
  if ((projectInfo && !/^M\d{4}_\d{4}$/.test(projectInfo)) || params.has("company_info")) {
    return readSecEnvelope(path, key);
  }
  const identity = createHash("sha256").update(path).digest("hex");
  const cached = unstable_cache(async () => {
    const envelope = await readSecEnvelope(path, key);
    if (Buffer.byteLength(JSON.stringify(envelope), "utf8") > SEC_CACHE_MAX_BYTES) {
      // Throwing avoids persisting oversized entries; return the already-fetched
      // projection outside the cache without truncation or a second API request.
      throw new UncachedSecEnvelope(envelope);
    }
    return envelope;
  }, ["ccpun-sec-public-envelope-v1", identity], { revalidate });
  try {
    return await cached();
  } catch (error) {
    if (error instanceof UncachedSecEnvelope) return error.envelope;
    throw error;
  }
}

// Every AMC SEC lists (deduplicated, Thai-sorted). Throws on any upstream failure so a
// partial list is never presented as complete.
async function loadSecAmcs(key: string): Promise<FundAmcOption[]> {
  const items: FundAmcOption[] = [];
  const seen = new Set<string>();
  let cursor = "";
  const startedAt = Date.now();
  for (let page = 0; page < 20; page += 1) {
    if (page > 0 && Date.now() - startedAt > MULTI_PAGE_BUDGET_MS) throw new Error("sec_budget_exceeded");
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
  return items;
}

let aiaAmcIdMemo: { id: string; at: number } | null = null;

/**
 * SEC unique_id of บลจ. เอไอเอ, resolved at runtime from /v2/fund/general-info/amcs by
 * name (isAiaAmcName), never hard-coded. Returns null when SEC is unavailable or the
 * match is missing or ambiguous, so the AIA tool fails closed instead of guessing.
 * UAT/demo mode without a SEC key returns the synthetic AIA AMC id.
 */
export async function getAiaAmcId(): Promise<string | null> {
  const key = getSubscriptionKey();
  if (!key) return isReviewLikeEnvironment() ? UAT_SYNTHETIC_AIA_AMC.id : null;
  if (aiaAmcIdMemo && Date.now() - aiaAmcIdMemo.at < AIA_AMC_ID_TTL_MS) return aiaAmcIdMemo.id;
  try {
    const matches = (await loadSecAmcs(key)).filter((amc) => isAiaAmcName(amc.nameTh, amc.nameEn));
    if (matches.length !== 1) return null;
    aiaAmcIdMemo = { id: matches[0].id, at: Date.now() };
    return matches[0].id;
  } catch {
    return null;
  }
}

export async function listFundAmcs(scope: FundScope = "main"): Promise<FundAmcResponse> {
  const fetchedAt = new Date().toISOString();
  const key = getSubscriptionKey();

  if (!key) {
    if (!isReviewLikeEnvironment()) {
      return { source: "unavailable", state: "unavailable", items: [], fetchedAt, message: "รายชื่อ บลจ. ยังไม่พร้อมใช้งาน" };
    }
    const synthetic: FundAmcOption[] = [
      { id: "UAT-AMC", nameTh: "บลจ. ตัวอย่าง", nameEn: null, lastUpdated: null },
      { id: UAT_SYNTHETIC_AIA_AMC.id, nameTh: UAT_SYNTHETIC_AIA_AMC.nameTh, nameEn: UAT_SYNTHETIC_AIA_AMC.nameEn, lastUpdated: null },
    ];
    return {
      source: "uat_synthetic",
      state: "demo",
      items: synthetic.filter((amc) => amcAllowedInScope(scope, amc.nameTh, amc.nameEn)),
      fetchedAt,
      message: "ใช้รายชื่อจำลองชั่วคราว",
    };
  }

  try {
    const items = (await loadSecAmcs(key)).filter((amc) => amcAllowedInScope(scope, amc.nameTh, amc.nameEn));
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
    const amc = syntheticAmcFor(fund.projectId);
    return {
      projectId: fund.projectId,
      amcId: amc.id,
      amcNameTh: amc.nameTh,
      amcNameEn: amc.nameEn,
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

// ---------- Stored catalog for the บลจ. เอไอเอ tool (Neon ccpun_fund) ----------

type AiaCatalogSnapshot = { fetchedAt: string; amcId: string; items: FundCatalogItem[] };

function activeOrFirst(rows: Record<string, unknown>[]): Record<string, unknown> | undefined {
  return rows.find((row) => row.fund_status === "Registered" || row.fund_status === "IPO") ?? rows[0];
}

function storedProfileRows(projectId: string, rows: unknown[]): Record<string, unknown>[] {
  return rows.map(asRecord).filter((row): row is Record<string, unknown> => Boolean(row) && asString(row!.proj_id) === projectId);
}

function snapshotFromStore(stored: StoredCatalog): AiaCatalogSnapshot {
  const seen = new Set<string>();
  const items = stored.funds.flatMap((fund) => {
    const item = normalizeCatalogItem(activeOrFirst(storedProfileRows(fund.projectId, fund.profileRows)));
    // The stored scope is AIA; the per-row AMC name check still applies.
    if (!item || seen.has(item.projectId) || !amcAllowedInScope("aia", item.amcNameTh, item.amcNameEn)) return [];
    seen.add(item.projectId);
    return [item];
  });
  return { fetchedAt: stored.fetchedAt, amcId: stored.amc.id, items };
}

// Live fallback: the whole current AIA list in one pass (Registered, then IPO), so the
// same local filters and cursor apply as for the stored catalog. Throws on failure.
async function liveAiaSnapshot(key: string): Promise<AiaCatalogSnapshot> {
  const amcId = await getAiaAmcId();
  if (!amcId) throw new Error("aia_amc_unresolved");
  const items: FundCatalogItem[] = [];
  const seen = new Set<string>();
  const startedAt = Date.now();
  for (const status of ACTIVE_STATUSES) {
    let cursor = "";
    for (let page = 0; page < 10; page += 1) {
      if (Date.now() - startedAt > MULTI_PAGE_BUDGET_MS) throw new Error("sec_budget_exceeded");
      const params = new URLSearchParams({ page_size: String(SEC_PAGE_SIZE), fund_status: status, company_info: amcId });
      if (cursor) params.set("next_cursor", cursor);
      const envelope = await secGet(`/v2/fund/general-info/profiles?${params.toString()}`, key);
      for (const raw of asItems(envelope)) {
        const item = normalizeCatalogItem(raw);
        if (!item || seen.has(item.projectId) || !amcAllowedInScope("aia", item.amcNameTh, item.amcNameEn)) continue;
        seen.add(item.projectId);
        items.push(item);
      }
      cursor = asString(envelope.next_cursor) ?? "";
      if (!cursor) break;
    }
  }
  return { fetchedAt: new Date().toISOString(), amcId, items };
}

function pageAiaSnapshot(snapshot: AiaCatalogSnapshot, filters: { query: string; category: FundCatalogCategory | "all"; subcategory: FundCatalogSubcategory; cursor: string | null; limit: number },
  meta: { stale: boolean; origin: "store" | "live" }): FundCatalogResponse {
  const { query, category, subcategory, limit } = filters;
  const needle = query.toLowerCase();
  const matching = snapshot.items.filter((item) =>
    (!needle || `${item.projectId} ${item.abbreviation} ${item.nameTh} ${item.nameEn ?? ""}`.toLowerCase().includes(needle))
    && (category === "all" || item.category === category)
    && matchesGeography(item, subcategory));
  const cursor = filters.cursor ? parseCatalogCursor(filters.cursor) : null;
  const resumeAt = cursor?.secCursor === STORE_CURSOR && cursor.skipProjectId
    ? matching.findIndex((item) => item.projectId === cursor.skipProjectId) + 1
    : 0;
  const items = matching.slice(resumeAt, resumeAt + limit);
  const hasMore = resumeAt + items.length < matching.length && items.length > 0;
  return {
    source: "sec_v2",
    state: meta.stale ? "stale" : items.length ? "fresh" : "unavailable",
    origin: meta.origin,
    items,
    nextCursor: hasMore ? encodeCatalogCursor({ statusIndex: 0, secCursor: STORE_CURSOR, offset: 0, skipProjectId: items[items.length - 1].projectId }) : null,
    hasMore,
    query,
    category,
    subcategory,
    amcId: snapshot.amcId,
    fetchedAt: snapshot.fetchedAt,
    message: meta.stale ? AIA_STORE_STALE_MESSAGE : items.length ? null : "ไม่พบกองทุนที่ตรงกับตัวกรองนี้",
  };
}

/**
 * AIA catalog from the stored snapshot. Returns null when this lane has no store, or
 * when nothing is stored and no SEC key exists, so the existing path still answers.
 */
async function aiaCatalogFromStore(filters: { query: string; category: FundCatalogCategory | "all"; subcategory: FundCatalogSubcategory; cursor: string | null; limit: number },
  key: string | null): Promise<FundCatalogResponse | null> {
  const store = getFundCatalogStore();
  if (!store) return null;
  const result = await readThroughStore<StoredCatalog, AiaCatalogSnapshot>({
    read: () => store.readCatalog("aia"),
    fetchedAt: (stored) => stored.fetchedAt,
    claim: () => store.claimLiveFallback("aia:catalog", FUND_LIVE_FALLBACK_LEASE_SECONDS),
    live: () => (key ? liveAiaSnapshot(key) : Promise.reject(new Error("sec_key_missing"))),
    liveUsable: (snapshot) => snapshot.items.length > 0,
    flightKey: "aia:catalog",
  });
  if (result.kind === "busy") {
    if (!key) return null;
    const { query, category, subcategory } = filters;
    return { source: "unavailable", state: "unavailable", items: [], nextCursor: null, hasMore: false, query, category, subcategory, amcId: null, fetchedAt: new Date().toISOString(), message: AIA_STORE_BUSY_MESSAGE };
  }
  if (result.kind === "live") return pageAiaSnapshot(result.value, filters, { stale: false, origin: "live" });
  return pageAiaSnapshot(snapshotFromStore(result.value), filters, { stale: result.stale, origin: "store" });
}

export async function listFundCatalog(options: {
  query?: string;
  category?: FundCatalogCategory | "all";
  subcategory?: FundCatalogSubcategory;
  amcId?: string | null;
  cursor?: string | null;
  limit?: number;
  scope?: FundScope;
}): Promise<FundCatalogResponse> {
  const fetchedAt = new Date().toISOString();
  const query = options.query?.trim().slice(0, 120) ?? "";
  const category = options.category ?? "all";
  const subcategory = options.subcategory ?? "all";
  const scope = options.scope ?? "main";
  let amcId = options.amcId?.trim() || null;
  const limit = Math.min(40, Math.max(8, options.limit ?? CATALOG_PAGE_SIZE));
  const key = getSubscriptionKey();

  if (scope === "aia") {
    // The AIA tool reads the stored catalog when this Web lane has one (null otherwise).
    const stored = await aiaCatalogFromStore({ query, category, subcategory, cursor: options.cursor ?? null, limit }, key);
    if (stored) return stored;
  }

  if (!key) {
    if (!isReviewLikeEnvironment()) {
      return { source: "unavailable", state: "unavailable", items: [], nextCursor: null, hasMore: false, query, category, subcategory, amcId, fetchedAt, message: "บริการข้อมูลกองทุนยังไม่พร้อมใช้งาน" };
    }
    const normalizedQuery = query.toLowerCase();
    const items = demoCatalogItems().filter((item) => {
      if (normalizedQuery && !`${item.nameTh} ${item.abbreviation}`.toLowerCase().includes(normalizedQuery)) return false;
      if (category !== "all" && item.category !== category) return false;
      if (!matchesGeography(item, subcategory)) return false;
      if (amcId && item.amcId !== amcId) return false;
      return amcAllowedInScope(scope, item.amcNameTh, item.amcNameEn);
    }).slice(0, limit);
    return { source: "uat_synthetic", state: "demo", items, nextCursor: null, hasMore: false, query, category, subcategory, amcId, fetchedAt, message: "กำลังใช้ข้อมูลตัวอย่างชั่วคราว" };
  }

  if (scope === "aia") {
    // The AIA tool is locked to one AMC: the resolved SEC id replaces any client value.
    const aiaAmcId = await getAiaAmcId();
    if (!aiaAmcId) {
      return { source: "unavailable", state: "unavailable", items: [], nextCursor: null, hasMore: false, query, category, subcategory, amcId: null, fetchedAt, message: AIA_UNRESOLVED_MESSAGE };
    }
    amcId = aiaAmcId;
  }

  try {
    // Routes reject malformed cursors; anything else that slips through restarts at page one.
    const parsedCursor = options.cursor ? parseCatalogCursor(options.cursor) : null;
    // A stored-catalog cursor is meaningless to SEC: restart at page one.
    const start = parsedCursor && parsedCursor.secCursor !== STORE_CURSOR ? parsedCursor : INITIAL_CATALOG_CURSOR;
    const results: FundCatalogItem[] = [];
    const seen = new Set<string>();
    let statusIndex: number = start.statusIndex;
    let secCursor = start.secCursor;
    let offset = start.offset;
    const skipProjectId = start.skipProjectId;
    let pagesScanned = 0;
    const startedAt = Date.now();

    while (statusIndex < ACTIVE_STATUSES.length && results.length < limit && pagesScanned < MAX_CATALOG_SEC_PAGES_PER_REQUEST
      && (pagesScanned === 0 || Date.now() - startedAt <= MULTI_PAGE_BUDGET_MS)) {
      const status = ACTIVE_STATUSES[statusIndex];
      const currentCursor = secCursor;
      const params = new URLSearchParams({ page_size: String(SEC_PAGE_SIZE), fund_status: status });
      if (query) params.set("project_info", query);
      if (amcId) params.set("company_info", amcId);
      if (currentCursor) params.set("next_cursor", currentCursor);
      const path = `/v2/fund/general-info/profiles?${params.toString()}`;
      // A client-supplied SEC cursor is never used as a persistent cache key; cursors
      // returned by SEC during this request are trusted and may be cached.
      const clientSuppliedCursor = pagesScanned === 0 && Boolean(start.secCursor);
      const envelope = clientSuppliedCursor ? await readSecEnvelope(path, key) : await secGet(path, key);
      const rawItems = asItems(envelope);
      pagesScanned += 1;

      for (let index = offset; index < rawItems.length; index += 1) {
        const item = normalizeCatalogItem(rawItems[index]);
        if (!item) continue;
        if (skipProjectId && item.projectId === skipProjectId) continue;
        if (seen.has(item.projectId)) continue;
        // Scope by the AMC names on each SEC row (main excludes บลจ. เอไอเอ; aia keeps only it).
        if (!amcAllowedInScope(scope, item.amcNameTh, item.amcNameEn)) continue;
        if (category !== "all" && item.category !== category) continue;
        if (!matchesGeography(item, subcategory)) continue;
        seen.add(item.projectId);
        results.push(item);
        if (results.length >= limit) {
          return {
            source: "sec_v2",
            state: "fresh",
            items: results,
            nextCursor: encodeCatalogCursor({ statusIndex: statusIndex as 0 | 1, secCursor: currentCursor, offset: index + 1, skipProjectId: item.projectId }),
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
      nextCursor: hasMore ? encodeCatalogCursor({ statusIndex: statusIndex as 0 | 1, secCursor, offset: 0, skipProjectId: null }) : null,
      hasMore,
      query,
      category,
      subcategory,
      amcId,
      fetchedAt,
      message: results.length ? null : "ไม่พบกองทุนที่ตรงกับตัวกรองนี้",
    };
  } catch (error) {
    const diagnosticLane = getDeploymentLaneByEnvironment(process.env.CCPUN_APP_ENV);
    if (diagnosticLane?.role === "web" && diagnosticLane.environment === "web-uat"
      && deploymentContractFailures(diagnosticLane, process.env).length === 0) {
      // Only the sealed public Web UAT lane may diagnose. Review flags alone
      // never authorize logging on Production, Admin or local-production.
      // Diagnostic metadata only. Never emit the query, URL, credentials,
      // response body, error message or stack to provider logs.
      const failure = error instanceof Error ? error : null;
      const status = failure?.message.match(/^sec_http_([1-5][0-9]{2})$/)?.[1];
      const reason = status ? "http" : failure?.message === "sec_invalid_envelope" ? "invalid_envelope"
        : failure?.name === "TimeoutError" ? "timeout" : failure?.name === "AbortError" ? "abort"
          : error instanceof InvalidSecJson || failure?.name === "SyntaxError" ? "invalid_json" : "unknown";
      console.warn("ccpun_sec_catalog_unavailable", JSON.stringify({
        reason,
        httpStatus: error instanceof InvalidSecJson ? error.httpStatus : status ? Number(status) : null,
        ...(error instanceof InvalidSecJson ? { contentType: error.contentType, emptyBody: error.emptyBody } : {}),
      }));
    }
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

function outOfScopeDetail(scope: FundScope, fetchedAt: string): FundDetailResponse {
  const warning = scope === "aia" ? "เครื่องมือนี้แสดงเฉพาะกองทุนของ บลจ. เอไอเอ" : "กองทุนนี้ดูได้ในเครื่องมือกองทุน บลจ. เอไอเอ";
  return { source: "unavailable", state: "unavailable", fund: null, classes: [], selectedClassName: null, specifications: [], risk: null, assetAllocation: [], dealing: null, dataDate: null, fetchedAt, warnings: [warning], endpointStates: {} };
}

export async function getFundDetail(projectId: string, requestedClassName?: string | null, scope: FundScope = "main"): Promise<FundDetailResponse> {
  const fetchedAt = new Date().toISOString();
  // Synthetic detail is confined to explicit Web UAT lanes, never a live-data fallback.
  if (IS_REVIEW_ENVIRONMENT && ["web-uat", "local-uat"].includes(process.env.CCPUN_APP_ENV ?? "")) {
    const demo = UAT_SYNTHETIC_FUNDS.find((fund) => fund.projectId === projectId);
    if (demo) {
      const amc = syntheticAmcFor(demo.projectId);
      if (!amcAllowedInScope(scope, amc.nameTh, amc.nameEn)) return outOfScopeDetail(scope, fetchedAt);
      const className = demo.className;
      const selectedClassName = !requestedClassName || requestedClassName === className ? className : null;
      return {
        source: "uat_synthetic", state: "demo",
        fund: demoCatalogItems().find((fund) => fund.projectId === projectId) ?? null,
        classes: className ? [{ name: className, detail: "ชนิดหน่วยตัวอย่างสำหรับ UAT", description: null, taxIncentiveType: null, isin: null }] : [],
        selectedClassName, specifications: [],
        risk: demo.riskSpectrum ? { level: demo.riskSpectrum as FundRiskFact["level"], rawCode: `RS${demo.riskSpectrum}`, description: "ข้อมูลตัวอย่าง UAT", sourceDate: demo.provenance.sourceDate, lastUpdated: null } : null,
        assetAllocation: demo.assetAllocation.map((row) => ({ name: row.label, percentNav: row.percent, sourceDate: row.sourceDate, lastUpdated: null })),
        dealing: selectedClassName ? { className: selectedClassName, subscriptionPeriod: null, subscriptionPeriodOther: null, redemptionPeriod: null, redemptionPeriodOther: null, settlementPeriod: demo.liquidity.rawText, settlementBucket: demo.liquidity.normalized, sourceDate: demo.liquidity.sourceDate, lastUpdated: null } : null,
        dataDate: demo.provenance.sourceDate, fetchedAt,
        warnings: [...demo.provenance.notes], snapshotIds: demo.provenance.snapshotIds,
        endpointStates: { profile: "ok", risk: demo.riskSpectrum ? "ok" : "empty", allocation: demo.assetAllocation.length ? "ok" : "empty", dealing: demo.liquidity.rawText ? "ok" : "empty" },
      };
    }
  }
  const key = getSubscriptionKey();
  if (scope === "aia" && /^M\d{4}_\d{4}$/.test(projectId)) {
    // The AIA tool reads stored facts when this Web lane has a store (null otherwise).
    const stored = await aiaDetailFromStore(projectId, requestedClassName ?? null, key);
    if (stored) return stored;
  }
  if (!key || !/^M\d{4}_\d{4}$/.test(projectId)) {
    return { source: "unavailable", state: "unavailable", fund: null, classes: [], selectedClassName: null, specifications: [], risk: null, assetAllocation: [], dealing: null, dataDate: null, fetchedAt, warnings: ["ข้อมูลรายละเอียดกองทุนยังไม่พร้อมใช้งาน"], endpointStates: {} };
  }
  return liveFundDetail(projectId, requestedClassName ?? null, scope, key);
}

async function liveFundDetail(projectId: string, requestedClassName: string | null, scope: FundScope, key: string): Promise<FundDetailResponse> {
  const fetchedAt = new Date().toISOString();
  const encoded = encodeURIComponent(projectId);
  const [profile, specification, risk, allocation, dealing] = await Promise.all([
    settledEnvelope(`/v2/fund/general-info/profiles?project_info=${encoded}&page_size=100`, key),
    settledEnvelope(`/v2/fund/general-info/specifications?proj_id=${encoded}&page_size=100`, key),
    settledEnvelope(`/v2/fund/factsheet/risk-spectrum?proj_id=${encoded}&latest=true&page_size=100`, key),
    settledEnvelope(`/v2/fund/factsheet/asset-allocation?proj_id=${encoded}&latest=true&page_size=100`, key),
    settledEnvelope(`/v2/fund/factsheet/subscription-redemption-periods?proj_id=${encoded}&latest=true&page_size=100`, key),
  ]);
  return buildFundDetail(projectId, requestedClassName, scope, { profile, specification, risk, allocation, dealing }, { fetchedAt });
}

type EndpointRows = { state: "ok" | "empty" | "unavailable"; items: unknown[] };

// Shared by the live adapter and the stored catalog: both hold the same SEC v2 rows.
function buildFundDetail(projectId: string, requestedClassName: string | null, scope: FundScope,
  results: { profile: EndpointRows; specification: EndpointRows; risk: EndpointRows; allocation: EndpointRows; dealing: EndpointRows },
  meta: { fetchedAt: string; stale?: boolean; origin?: "store" | "live" }): FundDetailResponse {
  const fetchedAt = meta.fetchedAt;
  const { profile: profileResult, specification: specificationResult, risk: riskResult, allocation: allocationResult, dealing: dealingResult } = results;
  // project_info is a search parameter; keep only rows for the exact requested project.
  const profileRows = profileResult.items.map(asRecord)
    .filter((row): row is Record<string, unknown> => Boolean(row) && asString(row!.proj_id) === projectId);
  const activeProfiles = profileRows.filter((row) => row.fund_status === "Registered" || row.fund_status === "IPO");
  const fund = normalizeCatalogItem(activeProfiles[0] ?? profileRows[0]);
  // Each tool shows details only for funds in its own AMC scope.
  if (fund && !amcAllowedInScope(scope, fund.amcNameTh, fund.amcNameEn)) return outOfScopeDetail(scope, fetchedAt);
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
    const percentNav = asDecimal(row.asset_ratio);
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
  const computed = fund && risk && assetAllocation.length ? (Object.values(endpointStates).includes("unavailable") ? "partial" : "fresh") : "partial";
  const state = meta.stale && computed === "fresh" ? "stale" : computed;
  if (meta.stale) warnings.push(AIA_STORE_STALE_MESSAGE);

  return { source: "sec_v2", state, ...(meta.origin ? { origin: meta.origin } : {}), fund, classes, selectedClassName, specifications, risk, assetAllocation, dealing, dataDate, fetchedAt, warnings, endpointStates };
}

function hiddenFundDetail(fetchedAt: string): FundDetailResponse {
  return { source: "unavailable", state: "unavailable", origin: "store", fund: null, classes: [], selectedClassName: null, specifications: [], risk: null, assetAllocation: [], dealing: null, dataDate: null, fetchedAt, warnings: [AIA_FUND_HIDDEN_WARNING], endpointStates: {} };
}

function detailFromStoredFund(projectId: string, requestedClassName: string | null, stored: StoredFund, stale: boolean): FundDetailResponse {
  if (!stored.visible) return hiddenFundDetail(stored.catalogFetchedAt);
  const detail = stored.detail;
  const rows = (items: unknown[] | undefined, state: "ok" | "empty" | undefined): EndpointRows => ({ state: state ?? (items?.length ? "ok" : "empty"), items: items ?? [] });
  return buildFundDetail(projectId, requestedClassName, "aia", {
    profile: { state: "ok", items: stored.profileRows },
    specification: rows(detail?.specification, detail?.endpointStates.specification),
    risk: rows(detail?.risk, detail?.endpointStates.risk),
    allocation: rows(detail?.allocation, detail?.endpointStates.allocation),
    dealing: rows(detail?.dealing, detail?.endpointStates.dealing),
  }, { fetchedAt: stored.detailFetchedAt ?? stored.profileFetchedAt, stale, origin: "store" });
}

/**
 * AIA fund detail from the store. Hidden (cancelled/merged/unlisted) funds answer
 * from the store at once. Returns null when this lane has no store, or when nothing
 * usable is stored and no SEC key exists, so the existing path still answers.
 */
async function aiaDetailFromStore(projectId: string, requestedClassName: string | null, key: string | null): Promise<FundDetailResponse | null> {
  const store = getFundCatalogStore();
  if (!store) return null;
  const now = Date.now();
  const result = await readThroughStore<StoredFund, FundDetailResponse>({
    read: () => store.readFund("aia", projectId),
    // A hidden fund is a definitive stored answer; a visible one needs stored detail.
    fetchedAt: (stored) => (!stored.visible ? new Date(now).toISOString() : stored.detail ? stored.detailFetchedAt : null),
    claim: () => store.claimLiveFallback("aia:detail", FUND_LIVE_FALLBACK_LEASE_SECONDS),
    live: () => (key ? liveFundDetail(projectId, requestedClassName, "aia", key) : Promise.reject(new Error("sec_key_missing"))),
    liveUsable: (detail) => detail.source === "sec_v2" && Boolean(detail.fund),
    flightKey: `aia:detail:${projectId}:${requestedClassName ?? ""}`,
    now,
  });
  if (result.kind === "busy") {
    if (!key) return null;
    return { source: "unavailable", state: "unavailable", fund: null, classes: [], selectedClassName: null, specifications: [], risk: null, assetAllocation: [], dealing: null, dataDate: null, fetchedAt: new Date().toISOString(), warnings: [AIA_STORE_BUSY_MESSAGE], endpointStates: {} };
  }
  if (result.kind === "live") return { ...result.value, origin: "live" };
  return detailFromStoredFund(projectId, requestedClassName, result.value, result.stale);
}

/** Latest stored risk level for a fund, without calling SEC. */
async function storedRisk(projectId: string): Promise<{ level: number | null; sourceDate: string | null; snapshotId: string } | null> {
  const store = getFundCatalogStore();
  if (!store) return null;
  try {
    const stored = await store.readFund("aia", projectId);
    const latest = stored?.detail?.risk.map(normalizeRisk).find((row): row is SecRiskRow => Boolean(row)) ?? null;
    return latest ? { level: riskLevel(latest.risk_spectrum), sourceDate: latest.start_date, snapshotId: `sec-v2:risk-spectrum:${projectId}:${latest.start_date ?? "unknown"}` } : null;
  } catch {
    return null;
  }
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

export async function searchPlanningFunds(query: string, scope: FundScope = "main"): Promise<FundSearchResponse> {
  const normalizedQuery = query.trim().slice(0, 120);
  const fetchedAt = new Date().toISOString();
  const key = getSubscriptionKey();
  if (!normalizedQuery) return { mode: key ? "sec_live" : "uat_demo", state: "unavailable", query: "", funds: [], message: "กรอกชื่อกองหรือชื่อย่อเพื่อค้นหา", fetchedAt };

  if (scope === "aia" && getFundCatalogStore()) {
    // Stored AIA catalog: profiles and risk come from the store; SEC is not called.
    const catalog = await aiaCatalogFromStore({ query: normalizedQuery, category: "all", subcategory: "all", cursor: null, limit: 8 }, key);
    if (catalog && catalog.source !== "sec_v2") return { mode: "sec_live", state: "unavailable", query: normalizedQuery, funds: [], message: catalog.message, fetchedAt };
    if (catalog) {
      const origin = catalog.origin === "store" ? "store" : "live";
      const funds = await Promise.all(catalog.items.map(async (profile) => {
        if (origin === "store" || !key) return profileToPlanningFund(profile, await storedRisk(profile.projectId), catalog.fetchedAt);
        try { return profileToPlanningFund(profile, await loadLatestRisk(profile.projectId, key), catalog.fetchedAt); }
        catch { return profileToPlanningFund(profile, null, catalog.fetchedAt); }
      }));
      return { mode: "sec_live", origin, state: funds.length ? (catalog.state === "stale" ? "stale" : "partial") : "unavailable", query: normalizedQuery, funds,
        message: funds.length ? "ผลค้นหาจากข้อมูลกองทุนของ ก.ล.ต." : "ไม่พบกองทุนจากคำค้นนี้", fetchedAt: catalog.fetchedAt };
    }
  }

  if (!key) {
    if (!isReviewLikeEnvironment()) return { mode: "sec_live", state: "unavailable", query: normalizedQuery, funds: [], message: "บริการค้นหาข้อมูลกองทุนยังไม่พร้อมใช้งาน", fetchedAt };
    return { mode: "uat_demo", state: "demo", query: normalizedQuery, funds: searchDemoFunds(normalizedQuery, scope), message: "กำลังใช้ข้อมูลตัวอย่างชั่วคราว", fetchedAt };
  }

  const catalog = await listFundCatalog({ query: normalizedQuery, limit: 8, scope });
  if (catalog.source !== "sec_v2") return { mode: "sec_live", state: "unavailable", query: normalizedQuery, funds: [], message: catalog.message, fetchedAt };
  const funds = await Promise.all(catalog.items.map(async (profile) => {
    try { return profileToPlanningFund(profile, await loadLatestRisk(profile.projectId, key), fetchedAt); }
    catch { return profileToPlanningFund(profile, null, fetchedAt); }
  }));
  return { mode: "sec_live", state: funds.length ? "partial" : "unavailable", query: normalizedQuery, funds, message: funds.length ? "ผลค้นหาจากข้อมูลกองทุนของ ก.ล.ต." : "ไม่พบกองทุนจากคำค้นนี้", fetchedAt };
}
