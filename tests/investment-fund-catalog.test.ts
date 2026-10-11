import "./investment-availability.test.mjs";
import "./investment-interaction-regression.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import {
  categoryFromPolicy,
  equitySubcategoryLabel,
  geographyLabel,
  matchesGeography,
  subcategoryOptions,
} from "../features/investment-allocation/domain/catalog";
import type { FundCatalogItem } from "../features/investment-allocation/domain/types";

function secAdapter(reply: (url: URL) => unknown, options: { key?: string | null; fail?: boolean; status?: number; review?: boolean; error?: Error } = {}) {
  const adapter = readFileSync(resolve(process.cwd(), "features/investment-allocation/server/sec-v2.ts"), "utf8");
  const executable = stripTypeScriptTypes(adapter, { mode: "transform" })
    .replace(/^import [\s\S]*?;\n/gm, "").replace(/export /g, "");
  const entries = new Map<string, unknown>();
  const cacheCalls: Array<{ parts: string[]; args: unknown[]; ttl: number; bytes?: number }> = [];
  const requests: Array<{ url: URL; init: RequestInit }> = [];
  const warnings: unknown[][] = [];
  const api = runInNewContext(`${executable}\n({listFundCatalog, listFundAmcs, getFundDetail, searchPlanningFunds});`, {
    Date, Buffer, URL, URLSearchParams, AbortSignal, Error, createHash, categoryFromPolicy, matchesGeography,
    console: { warn: (...args: unknown[]) => warnings.push(args) },
    IS_REVIEW_ENVIRONMENT: options.review ?? false, UAT_SYNTHETIC_FUNDS: [], searchDemoFunds: () => [],
    normalizeLiquidity: () => "unknown",
    process: { env: { SEC_API_PRIMARY_KEY: options.key === undefined ? "synthetic-test-key" : options.key } },
    fetch: async (url: string, init: RequestInit) => {
      const parsed = new URL(url);
      requests.push({ url: parsed, init });
      if (options.error) throw options.error;
      return { ok: !options.fail, status: options.status ?? (options.fail ? 503 : 200), json: async () => reply(parsed) };
    },
    unstable_cache: (read: () => Promise<unknown>, parts: string[], config: { revalidate: number }) => async (...args: unknown[]) => {
      const call = { parts: [...parts], args, ttl: config.revalidate, bytes: undefined as number | undefined };
      cacheCalls.push(call);
      const id = JSON.stringify([parts, args]);
      if (entries.has(id)) return entries.get(id);
      const value = await read();
      call.bytes = Buffer.byteLength(JSON.stringify(value), "utf8");
      entries.set(id, JSON.parse(JSON.stringify(value)));
      return value;
    },
  });
  return { api, entries, cacheCalls, requests, warnings };
}

function secProfile(index: number, extra: Record<string, unknown> = {}) {
  return {
    proj_id: `M${String(index).padStart(4, "0")}_2567`, proj_abbr_name: `TEST${index}`,
    proj_name_th: `กองทุนตัวอย่าง ${index}`, unique_id: "TEST-AMC", comp_name_th: "บลจ. ตัวอย่าง",
    fund_status: "Registered", policy_desc: "ตราสารทุน", invest_country_flag: "3",
    fund_class_name: "main", fund_class_detail: "ชนิดหน่วยหลัก", fund_class_isin_code: "TEST-ISIN", ...extra,
  };
}

test("SEC caches only bounded public projections while preserving original catalog offsets and filters", async () => {
  const rows = [null, ...Array.from({ length: 18 }, (_, i) => secProfile(i + 1))];
  const adapter = secAdapter(() => ({ items: rows, next_cursor: "public-next-page", ignored_blob: "x".repeat(5_355_931) }));
  const first = await adapter.api.listFundCatalog({ limit: 8, category: "equity" });
  const cursor = JSON.parse(Buffer.from(first.nextCursor, "base64url").toString("utf8"));
  assert.equal(cursor.offset, 9, "invalid rows still occupy upstream cursor positions");
  const next = await adapter.api.listFundCatalog({ limit: 8, cursor: first.nextCursor });
  assert.deepEqual(Array.from(next.items, (item: FundCatalogItem) => item.projectId), rows.slice(9, 17).map((row) => row!.proj_id));
  assert.equal(adapter.requests.length, 1, "same upstream page is reused across filters and offsets");
  assert.equal(adapter.entries.size, 1);
  assert.ok(adapter.cacheCalls[0].bytes! < 1024 * 1024);
  assert.equal(JSON.stringify([...adapter.entries.values()]).includes("ignored_blob"), false);
  for (const { init } of adapter.requests) {
    assert.equal(init.cache, "no-store", "raw response must never enter the Next fetch cache");
    assert.equal("next" in init, false);
  }
  for (const call of adapter.cacheCalls) {
    assert.equal(call.ttl, 6 * 60 * 60);
    assert.deepEqual(call.args, [], "credentials and user inputs must not be cache arguments");
    assert.match(call.parts[1], /^[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(call.parts).includes("synthetic-test-key"), false);
  }
});

test("oversized public projections return intact without cache insertion, truncation or duplicate fetch", async () => {
  const adapter = secAdapter(() => ({ items: Array.from({ length: 8 }, (_, i) => secProfile(i + 1, { proj_name_th: "ก".repeat(150_000) })) }));
  const result = await adapter.api.listFundCatalog({ limit: 8 });
  assert.equal(result.state, "fresh");
  assert.equal(result.items[0].nameTh.length, 150_000);
  assert.equal(adapter.requests.length, 1);
  assert.equal(adapter.entries.size, 0);
});

test("free text and AMC search inputs are not retained in persistent cache; upstream failures remain retryable", async () => {
  const adapter = secAdapter(() => ({ items: Array.from({ length: 8 }, (_, i) => secProfile(i + 1)) }));
  await adapter.api.listFundCatalog({ query: "private synthetic query", limit: 8 });
  await adapter.api.listFundCatalog({ query: "private synthetic query", limit: 8 });
  await adapter.api.listFundCatalog({ amcId: "private synthetic input", limit: 8 });
  assert.equal(adapter.requests.length, 3);
  assert.equal(adapter.cacheCalls.length, 0);
  const failed = secAdapter(() => ({}), { fail: true });
  for (let i = 0; i < 2; i++) assert.equal((await failed.api.listFundCatalog({})).source, "unavailable");
  assert.equal(failed.requests.length, 2);
  assert.equal(failed.entries.size, 0);
  const noKey = secAdapter(() => { throw new Error("no-key must not fetch"); }, { key: null });
  assert.equal((await noKey.api.listFundCatalog({})).source, "unavailable");
  assert.equal(noKey.cacheCalls.length, 0);
  assert.equal(noKey.requests.length, 0);
});

test("catalog diagnostics are review-only, allowlisted and redact all search/key/error details", async () => {
  const privateText = "private-customer-query https://private.invalid/?token=secret headers=secret stack=secret";
  for (const status of [401, 403, 404, 429, 503]) {
    for (const review of [false, true]) {
      const adapter = secAdapter(() => ({}), { fail: true, status, review, key: "private-synthetic-key" });
      const result = await adapter.api.listFundCatalog({ query: privateText, amcId: "private-amc" });
      assert.equal(result.state, "unavailable");
      assert.deepEqual(JSON.parse(JSON.stringify(adapter.warnings)), review
        ? [["ccpun_sec_catalog_unavailable", { reason: "http", httpStatus: status }]] : []);
      assert.equal(JSON.stringify(adapter.warnings).includes("private"), false);
      assert.equal("reason" in result, false, "diagnostics must not alter the public catalog contract");
    }
  }
  const cases: Array<[Error, string]> = [
    [Object.assign(new Error(privateText), { name: "TimeoutError" }), "timeout"],
    [Object.assign(new Error(privateText), { name: "AbortError" }), "abort"],
    [Object.assign(new Error(privateText), { name: "SyntaxError" }), "invalid_json"],
    [Object.assign(new Error(privateText), { name: privateText }), "unknown"],
    [new Error("sec_http_503 " + privateText), "unknown"],
    [new Error("sec_http_999"), "unknown"],
  ];
  for (const [error, reason] of cases) {
    for (const review of [false, true]) {
      const adapter = secAdapter(() => ({}), { review, error });
      assert.equal((await adapter.api.listFundCatalog({ query: privateText })).state, "unavailable");
      assert.deepEqual(JSON.parse(JSON.stringify(adapter.warnings)), review
        ? [["ccpun_sec_catalog_unavailable", { reason, httpStatus: null }]] : []);
    }
  }
  const malformed = secAdapter(() => null, { review: true });
  await malformed.api.listFundCatalog({ query: privateText });
  assert.deepEqual(JSON.parse(JSON.stringify(malformed.warnings)), [["ccpun_sec_catalog_unavailable", { reason: "invalid_envelope", httpStatus: null }]]);
  const good = secAdapter(() => ({ items: Array.from({ length: 8 }, (_, i) => secProfile(i + 1)) }), { review: true });
  assert.equal((await good.api.listFundCatalog({ query: privateText })).state, "fresh");
  assert.deepEqual(good.warnings, []);
});

test("project detail projection preserves all existing consumed facts and public source dates", async () => {
  const adapter = secAdapter((url) => {
    const endpoint = url.pathname.split("/").at(-1);
    const items = endpoint === "profiles" ? [secProfile(1)]
      : endpoint === "specifications" ? [{ spec_code: "A", spec_desc: "ข้อกำหนด", fund_class_name: "main", last_upd_date: "2026-10-01" }]
      : endpoint === "risk-spectrum" ? [{ risk_spectrum: "RS5", risk_spectrum_desc: "เสี่ยงปานกลาง", start_date: "2026-10-02" }]
      : endpoint === "asset-allocation" ? [{ asset_name: "หุ้น", asset_ratio: 60, start_date: "2026-10-03" }, { asset_name: "ตราสารหนี้", asset_ratio: 40 }]
      : [{ fund_class_name: "main", type: "subscription", period: "ทุกวัน", redemp_period_oth: "หมายเหตุซื้อ" }, { fund_class_name: "main", type: "redemption", period: "ทุกวัน", redemp_period_oth: "หมายเหตุขาย", settlement_period: "T+2", start_date: "2026-10-04" }];
    return { items, unused: "x".repeat(5_355_931) };
  });
  const detail = await adapter.api.getFundDetail("M0001_2567");
  assert.equal(detail.state, "fresh");
  assert.equal(detail.classes[0].isin, "TEST-ISIN");
  assert.equal(detail.specifications[0].description, "ข้อกำหนด");
  assert.equal(detail.risk.level, 5);
  assert.deepEqual(Array.from(detail.assetAllocation, (item: { percentNav: number }) => item.percentNav), [60, 40]);
  assert.equal(detail.dealing.settlementBucket, "T+2");
  assert.equal(detail.dealing.subscriptionPeriodOther, "หมายเหตุซื้อ");
  assert.equal(detail.dealing.redemptionPeriodOther, "หมายเหตุขาย");
  assert.equal(detail.dataDate, "2026-10-04");
  await adapter.api.getFundDetail("M0001_2567");
  assert.equal(adapter.requests.length, 5, "five project-specific projections are reused");
  assert.equal(adapter.entries.size, 5);
});

test("AMC public projections retain the original daily TTL and reuse without another upstream call", async () => {
  const adapter = secAdapter(() => ({ items: [{ unique_id: "TEST-AMC", comp_name_th: "บลจ. ตัวอย่าง", comp_name_en: "Example", last_upd_date: "2026-10-01" }] }));
  const first = await adapter.api.listFundAmcs();
  const second = await adapter.api.listFundAmcs();
  assert.equal(first.items[0].nameEn, "Example");
  assert.equal(second.items[0].lastUpdated, "2026-10-01");
  assert.equal(adapter.requests.length, 1);
  assert.equal(adapter.cacheCalls[0].ttl, 24 * 60 * 60);
});

function catalogItem(flag: FundCatalogItem["investCountryFlag"]): Pick<FundCatalogItem, "investCountryFlag"> {
  return { investCountryFlag: flag };
}

test("SEC policy_desc maps only to documented broad CCPun catalog categories", () => {
  assert.equal(categoryFromPolicy("ตราสารทุน"), "equity");
  assert.equal(categoryFromPolicy("ผสม"), "mixed");
  assert.equal(categoryFromPolicy("ตราสารหนี้"), "fixed_income");
  assert.equal(categoryFromPolicy("ทรัพย์สินทางเลือก"), "alternative");
  assert.equal(categoryFromPolicy("อื่น ๆ"), "other");
  assert.equal(categoryFromPolicy("unknown future SEC value"), "other");
});

test("country subcategories follow SEC invest_country_flag rather than fund names", () => {
  assert.equal(matchesGeography(catalogItem("3"), "domestic"), true);
  assert.equal(matchesGeography(catalogItem("1"), "foreign"), true);
  assert.equal(matchesGeography(catalogItem("2"), "foreign"), true);
  assert.equal(matchesGeography(catalogItem("4"), "domestic_foreign"), true);
  assert.equal(matchesGeography(catalogItem("3"), "foreign"), false);
  assert.equal(matchesGeography(catalogItem(null), "domestic"), false);
});

test("equity geography uses plain-language labels while preserving SEC field semantics", () => {
  assert.equal(geographyLabel("3", "equity"), "หุ้นไทย");
  assert.equal(geographyLabel("1", "equity"), "หุ้นต่างประเทศ");
  assert.equal(geographyLabel("2", "equity"), "หุ้นต่างประเทศ");
  assert.equal(geographyLabel("4", "equity"), "หุ้นไทย + ต่างประเทศ");
  assert.equal(equitySubcategoryLabel("domestic"), "หุ้นไทย");
  assert.equal(equitySubcategoryLabel("foreign"), "หุ้นต่างประเทศ");
  assert.equal(equitySubcategoryLabel("domestic_foreign"), "หุ้นไทย + ต่างประเทศ");
});

test("money market stays under the fixed-income family and is not exposed as a slow catalog filter before ingestion cache exists", () => {
  assert.deepEqual(subcategoryOptions("fixed_income"), ["all", "domestic", "foreign", "domestic_foreign"]);
  assert.equal(subcategoryOptions("equity").includes("money_market"), false);
  assert.equal(subcategoryOptions("mixed").includes("money_market"), false);
  const catalogRoute = readFileSync(resolve(process.cwd(), "apps/web/app/api/investment-allocation/catalog/route.ts"), "utf8");
  assert.doesNotMatch(catalogRoute, /SUBCATEGORIES[^\n]*"money_market"/, "the public API must not trigger a cold specification scan");
});


test("customer-facing investment UI does not expose internal SEC/dev terminology", () => {
  const root = process.cwd();
  const customerFiles = [
    "features/investment-allocation/SingleFundBuilder.tsx",
    "features/investment-allocation/PortfolioBuilder.tsx",
    "features/investment-allocation/InvestmentAllocationTool.tsx",
    "features/investment-allocation/page.tsx",
    "components/layout/website-43/Website43Navbar.tsx",
    "components/layout/website-43/Website43Shared.tsx",
  ].map((file) => readFileSync(resolve(root, file), "utf8")).join("\n");

  for (const forbidden of [
    "SEC policy_desc:",
    "Fund Specification:",
    "SEC v2",
    "UAT SYNTHETIC",
    "selection: customer",
    "Target Asset Allocation",
    "Known coverage",
    "Snapshot references",
    "Public Web",
    "Admin/Neon",
    "data-feasibility",
    "normalization สำหรับ UAT",
    "Portfolio Risk Score",
  ]) {
    assert.equal(customerFiles.includes(forbidden), false, `customer UI leaked internal term: ${forbidden}`);
  }
  assert.equal(customerFiles.includes("{fund.abbreviation} · {fund.projectId}"), false, "fund cards must not expose SEC project ids");
});

test("fund catalog supports optional AMC filtering through the normalized planning API", () => {
  const root = process.cwd();
  const server = readFileSync(resolve(root, "features/investment-allocation/server/sec-v2.ts"), "utf8");
  const catalogRoute = readFileSync(resolve(root, "apps/web/app/api/investment-allocation/catalog/route.ts"), "utf8");
  const amcRoute = readFileSync(resolve(root, "apps/web/app/api/investment-allocation/amcs/route.ts"), "utf8");
  assert.match(server, /params\.set\("company_info", amcId\)/);
  assert.match(server, /export async function listFundAmcs/);
  assert.match(catalogRoute, /searchParams\.get\("amc"\)/);
  assert.match(amcRoute, /listFundAmcs/);
});
