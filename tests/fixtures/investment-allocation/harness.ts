// Offline harness for the Investment Allocation API: runs the real route bodies,
// rate limiter and SEC v2 adapter against the contract fixtures in this folder.
// Shared by tests/investment-allocation-api.test.ts and the live-script self-test.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { categoryFromPolicy, matchesGeography } from "../../../features/investment-allocation/domain/catalog";
import { normalizeLiquidity } from "../../../features/investment-allocation/domain/calculation";
import { encodeCatalogCursor, INITIAL_CATALOG_CURSOR, parseCatalogCursor } from "../../../features/investment-allocation/server/catalog-cursor";
import { amcAllowedInScope, isAiaAmcName } from "../../../features/investment-allocation/domain/fund-scope";
import { searchDemoFunds, syntheticAmcFor, UAT_SYNTHETIC_AIA_AMC, UAT_SYNTHETIC_FUNDS } from "../../../features/investment-allocation/server/demo-funds";
import { enforceInvestmentApiRateLimit, InvestmentApiRateLimiter, type InvestmentApiRoute } from "../../../features/investment-allocation/server/rate-limit";
import { deploymentContractFailures, getDeploymentLaneByEnvironment } from "../../../lib/runtime/deployment-contract";

// Parsed JSON response bodies are inspected loosely by the tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = Record<string, any>;
export type Route = "amcs" | "catalog" | "detail" | "funds";

const FIXTURES = resolve(process.cwd(), "tests/fixtures/investment-allocation/sec-v2");
const fixture = (name: string): Json => JSON.parse(readFileSync(resolve(FIXTURES, name), "utf8"));
const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const executable = (path: string) => stripTypeScriptTypes(source(path), { mode: "transform" }).replace(/^import [\s\S]*?;\n/gm, "").replace(/export /g, "");

// Synthetic บลจ. เอไอเอ rows (names shaped like SEC's, values invented) for the AIA-scope tests.
export const AIA_FIXTURE_AMC = { unique_id: "C0900", comp_name_th: "บริษัทหลักทรัพย์จัดการกองทุน เอไอเอ (ประเทศไทย) จำกัด", comp_name_en: "AIA Investment Management (Thailand) Limited", last_upd_date: "2026-09-02" };
const aiaProfile = (projectId: string, abbreviation: string, policy: string) => ({
  proj_id: projectId, proj_abbr_name: abbreviation, proj_name_th: `กองทุนเปิด ${abbreviation} (fixture)`, proj_name_en: `${abbreviation} Fund`,
  unique_id: AIA_FIXTURE_AMC.unique_id, comp_name_th: AIA_FIXTURE_AMC.comp_name_th, comp_name_en: AIA_FIXTURE_AMC.comp_name_en,
  fund_status: "Registered", policy_desc: policy, invest_country_flag: "1", management_style: "AN",
  feederfund_master_fund: null, feederfund_country: null, last_upd_date: "2026-09-30",
  fund_class_name: "main", fund_class_detail: null, fund_class_description: null, fund_class_tax_incentive_type: null, fund_class_isin_code: null,
});
export const AIA_FIXTURE_PROFILES = [aiaProfile("M0901_2567", "AIA-FX-EQ", "ตราสารทุน"), aiaProfile("M0902_2567", "AIA-FX-FI", "ตราสารหนี้")];

/** Fixture-backed SEC v2: answers by path and query like the real API. `aia` adds a synthetic บลจ. เอไอเอ. */
export function fixtureSec(overrides: { fail?: (url: URL) => number | Error | null; aia?: boolean | "ambiguous" } = {}) {
  const calls: URL[] = [];
  const respond = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body), headers: { get: () => "application/json" } });
  const fetch = async (raw: string) => {
    const url = new URL(raw);
    calls.push(url);
    const failure = overrides.fail?.(url);
    if (failure instanceof Error) throw failure;
    if (typeof failure === "number") return respond({ error: "upstream" }, failure);
    const p = url.searchParams;
    const path = url.pathname;
    if (path === "/v2/fund/general-info/amcs") {
      const page = fixture(p.get("next_cursor") === "amc-page-2" ? "amcs-page-2.json" : "amcs-page-1.json");
      if (overrides.aia && p.get("next_cursor") === "amc-page-2") page.items.push(AIA_FIXTURE_AMC);
      if (overrides.aia === "ambiguous" && p.get("next_cursor") === "amc-page-2") page.items.push({ ...AIA_FIXTURE_AMC, unique_id: "C0901", comp_name_th: "บลจ. เอไอเอ อีกแห่ง (fixture)" });
      return respond(page);
    }
    if (path === "/v2/fund/general-info/profiles") {
      const projectInfo = p.get("project_info");
      if (projectInfo && /^M\d{4}_\d{4}$/.test(projectInfo) && !p.get("fund_status")) {
        const aiaRow = overrides.aia ? AIA_FIXTURE_PROFILES.find((row) => row.proj_id === projectInfo) : undefined;
        if (aiaRow) return respond({ items: [aiaRow], next_cursor: null });
        try { return respond(fixture(`profiles-detail-${projectInfo}.json`)); } catch { return respond({ items: [], next_cursor: null }); }
      }
      const page = fixture(p.get("fund_status") === "IPO" ? "profiles-ipo.json" : "profiles-registered.json");
      if (overrides.aia && p.get("fund_status") !== "IPO") page.items.splice(1, 0, ...AIA_FIXTURE_PROFILES);
      const text = projectInfo?.toLowerCase();
      page.items = page.items.filter((row: Json) =>
        (!text || `${row.proj_id} ${row.proj_abbr_name} ${row.proj_name_th}`.toLowerCase().includes(text))
        && (!p.get("company_info") || row.unique_id === p.get("company_info")));
      return respond(page);
    }
    const name = path.split("/").pop();
    const id = p.get("proj_id");
    try { return respond(fixture(`${name}-${id}.json`)); } catch { return { ok: true, status: 204, text: async () => "", headers: { get: () => null } }; }
  };
  return { fetch, calls };
}

export function adapter(sec: ReturnType<typeof fixtureSec>, options: { key?: string | null; lane?: "production" | "web-uat"; now?: () => number } = {}) {
  const lane = options.lane ?? "production";
  const review = lane === "web-uat";
  const now = options.now;
  // Controllable clock for budget tests; everything else behaves like Date.
  class ClockDate extends Date { static now() { return now ? now() : Date.now(); } }
  return runInNewContext(`${executable("features/investment-allocation/server/sec-v2.ts")}\n({ listFundAmcs, listFundCatalog, getFundDetail, searchPlanningFunds, getAiaAmcId });`, {
    Date: now ? ClockDate : Date, Buffer, URL, URLSearchParams, AbortSignal, Error, createHash,
    categoryFromPolicy, matchesGeography, normalizeLiquidity,
    amcAllowedInScope, isAiaAmcName, syntheticAmcFor, UAT_SYNTHETIC_AIA_AMC,
    encodeCatalogCursor, INITIAL_CATALOG_CURSOR, parseCatalogCursor,
    deploymentContractFailures, getDeploymentLaneByEnvironment,
    IS_REVIEW_ENVIRONMENT: review, UAT_SYNTHETIC_FUNDS, searchDemoFunds,
    console: { warn: () => {} },
    process: { env: {
      SEC_API_PRIMARY_KEY: options.key === undefined ? "fixture-key" : options.key ?? undefined,
      CCPUN_APP_ENV: lane, CCPUN_UAT_MODE: review ? "1" : "0",
    } },
    fetch: sec.fetch,
    unstable_cache: (read: () => Promise<unknown>) => read,
  });
}

export function routeHandler(name: Route, sec: ReturnType<typeof fixtureSec>, options: { enabled?: boolean; lane?: "production" | "web-uat"; key?: string | null; limiter?: InvestmentApiRateLimiter; now?: () => number } = {}) {
  const limiter = options.limiter ?? new InvestmentApiRateLimiter();
  const text = executable(`apps/web/app/api/investment-allocation/${name}/route.ts`)
    .replace('await import("@/features/investment-allocation/server/sec-v2")', "__loadSEC()");
  const lane = options.lane ?? "production";
  const GET = runInNewContext(`${text}\nGET;`, {
    INVESTMENT_ALLOCATION_ENABLED: options.enabled ?? true,
    IS_REVIEW_ENVIRONMENT: lane === "web-uat",
    process: { env: { CCPUN_APP_ENV: lane } },
    Response, Request, URL, Number, parseCatalogCursor,
    enforceInvestmentApiRateLimit: (request: Request, routeName: InvestmentApiRoute) => enforceInvestmentApiRateLimit(request, routeName, limiter),
    __loadSEC: () => adapter(sec, { key: options.key, lane, now: options.now }),
  });
  return GET as (request: Request) => Promise<Response>;
}

export function route(name: Route, sec: ReturnType<typeof fixtureSec>, options: Parameters<typeof routeHandler>[2] = {}) {
  const GET = routeHandler(name, sec, options);
  return async (query = "", headers: Record<string, string> = { "x-forwarded-for": "203.0.113.10" }) => {
    const response: Response = await GET(new Request(`https://test.ccpun.com/api/investment-allocation/${name}${query}`, { headers }));
    const body = JSON.parse(await response.text());
    return { response, body };
  };
}

