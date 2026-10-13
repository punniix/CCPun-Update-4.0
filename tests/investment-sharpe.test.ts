import assert from "node:assert/strict";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";
import test, { before } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { FundDetailResponse } from "../features/investment-allocation/domain/types";

const cssHook = registerHooks({
  load(url, context, nextLoad) {
    return url.endsWith("InvestmentAllocation.module.css")
      ? { format: "module", source: 'export default new Proxy({}, {get: (_, key) => String(key)});', shortCircuit: true }
      : nextLoad(url, context);
  },
});
let FundSharpeFact: typeof import("../features/investment-allocation/FundSharpeFact").default;
before(async () => {
  ({ default: FundSharpeFact } = await import("../features/investment-allocation/FundSharpeFact"));
  cssHook.deregister();
});

function detail(): FundDetailResponse {
  return {
    source: "sec_v2", state: "fresh",
    fund: { projectId: "TEST-FUND" } as FundDetailResponse["fund"],
    classes: [], selectedClassName: "A", specifications: [], risk: null, assetAllocation: [], dealing: null,
    statistics: { projectId: "TEST-FUND", className: "A", sharpeRatio: -0.75, factsheetStartDate: "2026-09-01", factsheetEndDate: null, lastUpdated: "2026-10-01" },
    dataDate: null, fetchedAt: "2026-10-13", warnings: [], endpointStates: {},
  };
}

const render = (value: FundDetailResponse, className: string | null = "A") => renderToStaticMarkup(createElement(FundSharpeFact, { detail: value, projectId: "TEST-FUND", className }));

test("reported negative and zero Sharpe remain values, never percentages, and factsheet dates do not become a measurement horizon", () => {
  const value = detail();
  const negative = render(value);
  assert.match(negative, /<dd>-0\.75<\/dd>/);
  assert.match(negative, /วันที่เริ่มใช้ factsheet/);
  assert.match(negative, /วันที่ factsheet ไม่ใช่ช่วงเวลาวัดผล/);
  assert.match(negative, /getFactsheetStatisticsinfo/);
  value.statistics!.sharpeRatio = 0;
  assert.match(render(value), /<dd>0<\/dd>/);
});

test("missing/nonfinite data and mismatched fund, class or unavailable source never display a numeric Sharpe", () => {
  const variants: FundDetailResponse[] = [
    { ...detail(), statistics: undefined }, { ...detail(), statistics: null },
    { ...detail(), statistics: { ...detail().statistics!, sharpeRatio: null } },
    { ...detail(), statistics: { ...detail().statistics!, sharpeRatio: NaN } },
    { ...detail(), statistics: { ...detail().statistics!, sharpeRatio: Infinity } },
    { ...detail(), statistics: { ...detail().statistics!, projectId: "OTHER" } },
    { ...detail(), statistics: { ...detail().statistics!, className: "B" } },
    { ...detail(), selectedClassName: "B" }, { ...detail(), source: "unavailable" },
    { ...detail(), state: "unavailable" }, { ...detail(), fund: null },
    { ...detail(), fund: { ...detail().fund!, projectId: "OTHER" } },
    { ...detail(), source: "unknown" as FundDetailResponse["source"] },
  ];
  for (const value of variants) {
    assert.match(render(value), /ยังไม่มีข้อมูลที่ยืนยันได้/);
    assert.doesNotMatch(render(value), /<dd>-0\.75<\/dd>/);
  }
  const pending = { ...detail(), classes: [{ name: "A", detail: null, description: null, taxIncentiveType: null, isin: null }], selectedClassName: null };
  assert.match(render(pending, null), /เลือกชนิดหน่วยลงทุนก่อน/);
  assert.doesNotMatch(render(pending, null), /<dd>-0\.75<\/dd>/);
  assert.match(render({ ...detail(), source: "uat_synthetic" }), /ข้อมูลสังเคราะห์สำหรับทดสอบ UAT เท่านั้น/);
});

const secProjectId = "M0001_2567";
const secProfile = {
  proj_id: secProjectId, proj_abbr_name: "TEST", proj_name_th: "Synthetic fund",
  unique_id: "TEST-AMC", comp_name_th: "Synthetic AMC", fund_status: "Registered",
  policy_desc: "ตราสารทุน", fund_class_name: "A",
};

async function secDetail(statistics: unknown[], options: { requested?: string; profiles?: unknown[]; failStatistics?: boolean } = {}) {
  const executable = stripTypeScriptTypes(readFileSync(resolve(process.cwd(), "features/investment-allocation/server/sec-v2.ts"), "utf8"), { mode: "transform" })
    .replace(/^import [\s\S]*?;\n/gm, "").replace(/export /g, "");
  const requests: URL[] = [];
  const api = runInNewContext(executable + "\n({getFundDetail});", {
    Date, Buffer, URL, URLSearchParams, AbortSignal, Error, createHash,
    IS_REVIEW_ENVIRONMENT: false, UAT_SYNTHETIC_FUNDS: [],
    normalizeLiquidity: () => "unknown",
    categoryFromPolicy: (policy: string) => policy === "ตราสารทุน" ? "equity" : "other",
    process: { env: { SEC_API_PRIMARY_KEY: "synthetic-only" } },
    unstable_cache: (read: () => Promise<unknown>) => async () => read(),
    fetch: async (url: string) => {
      const parsed = new URL(url);
      requests.push(parsed);
      const endpoint = parsed.pathname.split("/").at(-1);
      let items: unknown[] = [];
      if (endpoint === "statistics") {
        if (options.failStatistics) throw new Error("synthetic statistics failure");
        items = statistics;
      } else if (endpoint === "profiles") items = options.profiles ?? [secProfile];
      else if (endpoint === "risk-spectrum") items = [{ risk_spectrum: "RS6", start_date: "2026-08-01" }];
      else if (endpoint === "asset-allocation") items = [{ asset_name: "หุ้น", asset_ratio: 100, start_date: "2026-08-02" }];
      return { ok: true, status: 200, text: async () => JSON.stringify({ items }), headers: { get: () => "application/json" } };
    },
  });
  return { detail: await api.getFundDetail(secProjectId, options.requested ?? "A") as FundDetailResponse, requests };
}

const secStatistics = {
  proj_id: secProjectId, fund_class_name: "A", sharpe_ratio: "-0.75",
  start_date: "2026-09-01", end_date: null, last_upd_date: "2026-10-01",
};

test("canonical SEC detail preserves finite signed decimal strings, null/dash values and factsheet dates without changing allocation date", async () => {
  const values: Array<[unknown, number | null]> = [
    ["-0.75", -0.75], ["0", 0], [" .25 ", .25], ["+", null], ["-", null], ["", null],
    ["NaN", null], ["Infinity", null], ["12%", null], ["1e2", null], ["1,000", null],
    ["9".repeat(400), null], [null, null],
  ];
  for (const [raw, expected] of values) {
    const { detail: result, requests } = await secDetail([{ ...secStatistics, sharpe_ratio: raw, unconsumed: "not-a-public-fact" }]);
    assert.equal(result.statistics?.sharpeRatio, expected);
    assert.equal(result.statistics?.projectId, secProjectId);
    assert.equal(result.statistics?.className, "A");
    assert.equal(result.statistics?.factsheetStartDate, "2026-09-01");
    assert.equal(result.statistics?.factsheetEndDate, null);
    assert.equal(result.statistics?.lastUpdated, "2026-10-01");
    assert.equal(result.dataDate, "2026-08-02", "a statistics factsheet date cannot relabel the existing allocation source date");
    assert.equal(requests.length, 6);
    const request = requests.find(url => url.pathname.endsWith("/statistics"))!;
    assert.equal(request.searchParams.get("proj_id"), secProjectId);
    assert.equal(request.searchParams.get("latest"), "true");
    assert.equal(request.searchParams.get("page_size"), "100");
  }
});

test("canonical statistics rejects different projects/classes, main fallback, ambiguous duplicates and non-equity; endpoint failure preserves other facts", async () => {
  for (const rows of [[], [{ ...secStatistics, proj_id: "OTHER" }], [{ ...secStatistics, fund_class_name: "B" }], [{ ...secStatistics, fund_class_name: "main" }], [secStatistics, secStatistics]]) {
    assert.equal((await secDetail(rows)).detail.statistics, null);
  }
  assert.equal((await secDetail([secStatistics], { requested: "B" })).detail.statistics, null);
  assert.equal((await secDetail([secStatistics], { profiles: [{ ...secProfile, proj_id: "OTHER" }] })).detail.statistics, null);
  assert.equal((await secDetail([secStatistics], { profiles: [{ ...secProfile, policy_desc: "ตราสารหนี้" }] })).detail.statistics, null);
  const { detail: failed } = await secDetail([secStatistics], { failStatistics: true });
  assert.equal(failed.statistics, null);
  assert.equal(failed.endpointStates.statistics, "unavailable");
  assert.equal(failed.state, "partial");
  assert.equal(failed.assetAllocation.length, 1);
  assert.equal(failed.risk?.level, 6);
});
