// Integration tests for /api/investment-allocation/{amcs,catalog,detail,funds}.
// Each test executes the real route body, the real rate limiter and the real SEC v2
// adapter (with the real domain helpers) against SEC v2 contract fixtures in
// tests/fixtures/investment-allocation/sec-v2. Only fetch and unstable_cache are
// replaced; no network or SEC traffic happens.
import assert from "node:assert/strict";
import test from "node:test";
import { RATE_LIMIT_MESSAGE } from "../features/investment-allocation/domain/copy";
import { parseCatalogCursor } from "../features/investment-allocation/server/catalog-cursor";
import { UAT_SYNTHETIC_FUNDS } from "../features/investment-allocation/server/demo-funds";
import { InvestmentApiRateLimiter } from "../features/investment-allocation/server/rate-limit";
import { AIA_FIXTURE_AMC, fixtureSec, route, type Json } from "./fixtures/investment-allocation/harness";

// ---------- /amcs ----------

test("amcs: pages through SEC, drops invalid and duplicate AMCs and sorts by Thai name", async () => {
  const sec = fixtureSec();
  const { response, body } = await route("amcs", sec)();
  assert.equal(response.status, 200);
  assert.equal(body.source, "sec_v2");
  // SEC order is C0002, C0001, C0003; Thai alphabetical order is ก < ข < ฅ.
  assert.deepEqual(body.items.map((item: Json) => item.nameTh), ["บลจ. กรุงสยาม จำกัด", "บลจ. ข้าวหอม จำกัด", "บลจ. ฅนไทย จำกัด"]);
  assert.deepEqual(body.items.map((item: Json) => item.id), ["C0001", "C0002", "C0003"]);
  assert.equal(body.items.find((item: Json) => item.id === "C0001").nameTh, "บลจ. กรุงสยาม จำกัด", "first occurrence wins");
  assert.equal(sec.calls.length, 2);
  assert.equal(sec.calls[0].searchParams.get("page_size"), "100");
  assert.equal(response.headers.get("Cache-Control"), "private, max-age=0, must-revalidate");
  assert.equal(JSON.stringify(body).includes("fixture-key"), false, "the SEC key never reaches the response");
});

test("amcs: SEC failure, timeout, missing key and UAT fallback are explicit, uncached states", async () => {
  for (const fail of [() => 500, () => Object.assign(new Error("timeout"), { name: "TimeoutError" })]) {
    const { response, body } = await route("amcs", fixtureSec({ fail }))();
    assert.equal(response.status, 200);
    assert.equal(body.source, "unavailable");
    assert.deepEqual(body.items, []);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
  const noKey = await route("amcs", fixtureSec(), { key: null })();
  assert.equal(noKey.body.source, "unavailable");
  const uat = await route("amcs", fixtureSec(), { key: null, lane: "web-uat" })();
  assert.equal(uat.body.source, "uat_synthetic");
  assert.equal(uat.body.state, "demo");
});

test("amcs: a slow multi-page scan stops at the request budget instead of hanging", async () => {
  let now = 0;
  const sec = fixtureSec({ fail: () => { now += 25_000; return null; } });
  const { body } = await route("amcs", sec, { now: () => now })();
  assert.equal(body.source, "unavailable", "a partial AMC list is never presented as complete");
  assert.equal(sec.calls.length, 1);
});

// ---------- /catalog ----------

test("catalog: browses Registered then IPO, keeps one entry per active project and drops invalid rows", async () => {
  const sec = fixtureSec();
  const { response, body } = await route("catalog", sec)("?limit=40");
  assert.equal(response.status, 200);
  assert.equal(body.source, "sec_v2");
  assert.deepEqual(body.items.map((item: Json) => item.projectId), ["M0001_2567", "M0002_2567", "M0003_2567", "M0004_2567", "M0005_2567", "M0008_2567"]);
  assert.equal(body.hasMore, false);
  assert.equal(body.nextCursor, null);
  assert.deepEqual(sec.calls.map((url) => url.searchParams.get("fund_status")), ["Registered", "IPO"]);
  const global = body.items.find((item: Json) => item.projectId === "M0002_2567");
  assert.equal(global.investCountryFlag, "1", "numeric SEC flags normalize to the documented codes");
  assert.equal(global.category, "equity");
  assert.equal(JSON.stringify(body).includes("raw_unused_field"), false, "raw SEC fields are not forwarded");
});

test("catalog: category, geography and AMC filters follow SEC fields", async () => {
  const run = route("catalog", fixtureSec());
  const ids = async (query: string) => (await run(query)).body.items.map((item: Json) => item.projectId);
  assert.deepEqual(await ids("?category=equity&subcategory=domestic"), ["M0001_2567", "M0008_2567"]);
  assert.deepEqual(await ids("?category=equity&subcategory=foreign"), ["M0002_2567"]);
  assert.deepEqual(await ids("?category=mixed&subcategory=domestic_foreign"), ["M0003_2567"]);
  assert.deepEqual(await ids("?category=fixed_income"), ["M0004_2567"]);
  assert.deepEqual(await ids("?category=alternative&subcategory=foreign"), ["M0005_2567"]);
  assert.deepEqual(await ids("?amc=C0002"), ["M0003_2567", "M0004_2567", "M0005_2567"]);
  const sec = fixtureSec();
  await route("catalog", sec)("?amc=C0002&q=" + encodeURIComponent("ผสม"));
  assert.equal(sec.calls[0].searchParams.get("company_info"), "C0002");
  assert.equal(sec.calls[0].searchParams.get("project_info"), "ผสม", "Thai search text reaches SEC intact");
});

test("catalog: empty results and Thai search text return a clear unavailable state", async () => {
  const { response, body } = await route("catalog", fixtureSec())("?q=" + encodeURIComponent("ไม่มีกองนี้"));
  assert.equal(response.status, 200);
  assert.equal(body.state, "unavailable");
  assert.deepEqual(body.items, []);
  assert.equal(body.message, "ไม่พบกองทุนที่ตรงกับตัวกรองนี้");
  assert.equal(body.query, "ไม่มีกองนี้");
});

test("catalog: pagination continues from the issued cursor without duplicates or gaps", async () => {
  const run = route("catalog", fixtureSec());
  const seen: string[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 5; page += 1) {
    const { body } = await run(`?limit=8${cursor ? `&cursor=${cursor}` : ""}`);
    seen.push(...body.items.map((item: Json) => item.projectId));
    cursor = body.nextCursor;
    if (!cursor) break;
  }
  assert.deepEqual(seen, ["M0001_2567", "M0002_2567", "M0003_2567", "M0004_2567", "M0005_2567", "M0008_2567"]);
});

test("catalog: invalid input is rejected with uncached 400s before SEC is called", async () => {
  const sec = fixtureSec();
  const run = route("catalog", sec);
  for (const [query, error] of [
    ["?category=crypto", "category_invalid"], ["?subcategory=moon", "subcategory_invalid"], ["?amc=" + encodeURIComponent("C0001;DROP"), "amc_invalid"],
    ["?q=" + "ก".repeat(121), "query_too_long"], ["?cursor=not-a-cursor!", "cursor_invalid"],
  ]) {
    const { response, body } = await run(query);
    assert.equal(response.status, 400, query);
    assert.equal(body.error, error, query);
    assert.equal(response.headers.get("Cache-Control"), "no-store", query);
  }
  assert.equal(sec.calls.length, 0);
});

test("catalog: upstream errors become an unavailable result; a slow scan returns a resume cursor", async () => {
  const failed = await route("catalog", fixtureSec({ fail: () => 503 }))();
  assert.equal(failed.response.status, 200);
  assert.equal(failed.body.source, "unavailable");
  assert.equal(failed.response.headers.get("Cache-Control"), "no-store");
  let now = 0;
  const sec = fixtureSec({ fail: () => { now += 25_000; return null; } });
  const slow = await route("catalog", sec, { now: () => now })("?category=other&limit=8");
  assert.equal(sec.calls.length, 1, "no further SEC pages after the budget is spent");
  assert.equal(slow.body.hasMore, true);
  assert.deepEqual(parseCatalogCursor(slow.body.nextCursor), { statusIndex: 1, secCursor: "", offset: 0, skipProjectId: null });
});

// ---------- /detail ----------

test("detail: maps profile, classes, risk, allocation and class dealing from all five SEC endpoints", async () => {
  const sec = fixtureSec();
  const { response, body } = await route("detail", sec)("?proj_id=M0001_2567&class_name=A");
  assert.equal(response.status, 200);
  assert.deepEqual(sec.calls.map((url) => url.pathname).sort(), [
    "/v2/fund/factsheet/asset-allocation", "/v2/fund/factsheet/risk-spectrum", "/v2/fund/factsheet/subscription-redemption-periods",
    "/v2/fund/general-info/profiles", "/v2/fund/general-info/specifications",
  ]);
  assert.equal(body.source, "sec_v2");
  assert.equal(body.state, "fresh");
  assert.equal(body.fund.projectId, "M0001_2567");
  assert.equal(body.fund.abbreviation, "KS-EQ", "a similar project returned by the search never replaces the requested one");
  assert.deepEqual(body.classes.map((row: Json) => row.name), ["A", "D"]);
  assert.equal(body.selectedClassName, "A");
  assert.deepEqual(body.risk, { level: 6, rawCode: "RS6", description: "เสี่ยงสูง", sourceDate: "2026-08-31", lastUpdated: "2026-09-05" });
  assert.deepEqual(body.assetAllocation.map((row: Json) => [row.name, row.percentNav]), [["ตราสารทุน", 95.25], ["เงินฝาก", 4.75]], "decimal strings parse; rows without a ratio are dropped");
  assert.deepEqual(body.specifications.map((row: Json) => row.code), ["DIV", "EQ"], "selected class plus main specifications only");
  assert.equal(body.dealing.className, "A");
  assert.equal(body.dealing.subscriptionPeriod, "ทุกวันทำการ");
  assert.equal(body.dealing.settlementPeriod, "T+2");
  assert.equal(body.dealing.settlementBucket, "T+2");
  assert.equal(body.dealing.sourceDate, "2026-09-01");
  assert.equal(body.dataDate, "2026-09-01");
  assert.deepEqual(body.endpointStates, { profile: "ok", specification: "ok", risk: "ok", allocation: "ok", dealing: "ok" });
  assert.deepEqual(body.warnings, []);
  assert.equal(response.headers.get("Cache-Control"), "private, max-age=0, must-revalidate");
});

test("detail: multi-class funds require a class choice; other classes keep their own dealing terms", async () => {
  const run = route("detail", fixtureSec());
  const none = (await run("?proj_id=M0001_2567")).body;
  assert.equal(none.selectedClassName, null);
  assert.equal(none.dealing, null);
  assert.ok(none.warnings.some((warning: string) => warning.includes("หลายชนิดหน่วย")));
  const d = (await run("?proj_id=M0001_2567&class_name=D")).body;
  assert.equal(d.dealing.settlementPeriod, "T+5");
  assert.equal(d.dealing.settlementBucket, "other");
  assert.equal(d.dealing.redemptionPeriodOther, "ภายใน 5 วันทำการ");
  assert.equal(d.dealing.subscriptionPeriod, null, "no subscription row for class D is reported as missing, not borrowed");
  const unknownClass = (await run("?proj_id=M0001_2567&class_name=Z")).body;
  assert.equal(unknownClass.selectedClassName, null, "an unknown class is never silently substituted");
});

test("detail: partial upstream failure keeps available facts and flags the gap", async () => {
  const sec = fixtureSec({ fail: (url) => url.pathname.endsWith("risk-spectrum") ? 503 : null });
  const { response, body } = await route("detail", sec)("?proj_id=M0001_2567&class_name=A");
  assert.equal(response.status, 200);
  assert.equal(body.state, "partial");
  assert.equal(body.risk, null);
  assert.equal(body.endpointStates.risk, "unavailable");
  assert.equal(body.assetAllocation.length, 2);
  assert.ok(body.warnings.includes("ข้อมูลบางส่วนจาก ก.ล.ต. ไม่พร้อมใช้งานชั่วคราว"));
  assert.ok(body.warnings.includes("ยังไม่มีข้อมูลระดับความเสี่ยงที่แสดงได้ในตอนนี้"));
});

test("detail: unknown project, total outage and invalid input", async () => {
  const unknown = (await route("detail", fixtureSec())("?proj_id=M9999_2567")).body;
  assert.equal(unknown.fund, null);
  assert.equal(unknown.state, "partial");
  assert.ok(unknown.warnings.includes("ยังไม่พบข้อมูลพื้นฐานของกองทุนนี้"));
  const outage = (await route("detail", fixtureSec({ fail: () => Object.assign(new Error("t"), { name: "TimeoutError" }) }))("?proj_id=M0001_2567")).body;
  assert.equal(outage.fund, null);
  assert.deepEqual(Object.values(outage.endpointStates), ["unavailable", "unavailable", "unavailable", "unavailable", "unavailable"]);
  const sec = fixtureSec();
  const run = route("detail", sec);
  for (const query of ["", "?proj_id=M1_2567", "?proj_id=" + encodeURIComponent("M0001_2567' OR 1=1"), "?proj_id=UAT-MIXED-01"]) {
    const { response, body } = await run(query);
    assert.equal(response.status, 400, query);
    assert.equal(body.error, "proj_id_invalid", query);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
  const longClass = await run("?proj_id=M0001_2567&class_name=" + "x".repeat(121));
  assert.equal(longClass.body.error, "class_name_invalid");
  assert.equal(sec.calls.length, 0);
  const noKey = await route("detail", fixtureSec(), { key: null })("?proj_id=M0001_2567");
  assert.equal(noKey.body.source, "unavailable");
  assert.equal(noKey.response.headers.get("Cache-Control"), "no-store", "unavailable detail is not cacheable");
});

// ---------- /funds ----------

test("funds: search returns planning funds with SEC risk levels and project-level provenance", async () => {
  const sec = fixtureSec();
  const { response, body } = await route("funds", sec)("?q=" + encodeURIComponent("กรุงสยาม"));
  assert.equal(response.status, 200);
  assert.equal(body.mode, "sec_live");
  assert.equal(body.state, "partial");
  assert.deepEqual(body.funds.map((fund: Json) => fund.projectId), ["M0001_2567", "M0002_2567", "M0008_2567"]);
  assert.deepEqual(body.funds.map((fund: Json) => fund.riskSpectrum), [6, 8, null]);
  assert.equal(body.funds[0].constructionBucket, "equity");
  assert.equal(body.funds[0].className, null, "class is chosen later by the customer");
  assert.deepEqual(body.funds[0].assetAllocation, [], "allocation loads only after selection");
  assert.equal(body.funds[0].provenance.source, "sec_v2");
  assert.equal(response.headers.get("Cache-Control"), "private, max-age=0, must-revalidate");
});

test("funds: missing/long query, no match and SEC outage", async () => {
  const sec = fixtureSec();
  const run = route("funds", sec);
  assert.equal((await run("")).response.status, 400);
  assert.equal((await run("?q=%20%20")).body.error, "query_required");
  assert.equal((await run("?q=" + "a".repeat(121))).body.error, "query_too_long");
  assert.equal(sec.calls.length, 0);
  const none = (await run("?q=" + encodeURIComponent("ไม่มีกองนี้"))).body;
  assert.equal(none.state, "unavailable");
  assert.deepEqual(none.funds, []);
  const down = await route("funds", fixtureSec({ fail: () => 500 }))("?q=KS");
  assert.equal(down.body.state, "unavailable");
  assert.equal(down.response.headers.get("Cache-Control"), "no-store");
  const uat = (await route("funds", fixtureSec(), { key: null, lane: "web-uat" })("?q=uat")).body;
  assert.equal(uat.mode, "uat_demo");
  assert.equal(uat.funds.length, UAT_SYNTHETIC_FUNDS.length - 2, "the two synthetic บลจ. เอไอเอ funds stay out of the main tool");
});

// ---------- cross-cutting ----------

test("rate limit: a client over budget gets 429 with Retry-After and no further SEC calls", async () => {
  const sec = fixtureSec();
  const limiter = new InvestmentApiRateLimiter({ capacity: 6, refillPerSecond: 0.1 }, { capacity: 100, refillPerSecond: 1 });
  const run = route("detail", sec, { limiter });
  assert.equal((await run("?proj_id=M0001_2567")).response.status, 200);
  assert.equal((await run("?proj_id=M0001_2567")).response.status, 200);
  const callsBefore = sec.calls.length;
  const { response, body } = await run("?proj_id=M0001_2567");
  assert.equal(response.status, 429);
  assert.deepEqual(body, { error: "rate_limited", message: RATE_LIMIT_MESSAGE });
  assert.ok(Number(response.headers.get("Retry-After")) >= 1);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(sec.calls.length, callsBefore);
  const other = await run("?proj_id=M0001_2567", { "x-forwarded-for": "198.51.100.20" });
  assert.equal(other.response.status, 200, "another client is unaffected");
});

test("flag off: every route is an uncached 404 and never touches SEC", async () => {
  for (const name of ["amcs", "catalog", "detail", "funds"] as const) {
    const sec = fixtureSec();
    const { response, body } = await route(name, sec, { enabled: false })("?q=x&proj_id=M0001_2567");
    assert.equal(response.status, 404, name);
    assert.deepEqual(body, { error: "not_found" }, name);
    assert.equal(response.headers.get("Cache-Control"), "no-store", name);
    assert.equal(sec.calls.length, 0, name);
  }
});

test("every SEC request carries the server-side key header and a timeout, never the key in the URL", async () => {
  const seen: Array<{ url: string; init: RequestInit }> = [];
  const sec = fixtureSec();
  const wrapped = { calls: sec.calls, fetch: async (url: string, init: RequestInit) => { seen.push({ url, init }); return sec.fetch(url); } };
  await route("detail", wrapped as never)("?proj_id=M0001_2567");
  await route("catalog", wrapped as never)("");
  assert.ok(seen.length >= 6);
  for (const { url, init } of seen) {
    assert.equal(url.includes("fixture-key"), false);
    assert.equal((init.headers as Record<string, string>)["Ocp-Apim-Subscription-Key"], "fixture-key");
    assert.ok(init.signal, "each upstream call has an abort/timeout signal");
    assert.equal(init.cache, "no-store");
  }
});

// ---------- บลจ. เอไอเอ scope (owner request 2026-10-26) ----------

test("AIA scope: the main tool excludes บลจ. เอไอเอ from AMCs, catalog, search and detail", async () => {
  const sec = fixtureSec({ aia: true });
  const amcs = (await route("amcs", sec)()).body;
  assert.deepEqual(amcs.items.map((item: Json) => item.id), ["C0001", "C0002", "C0003"], "AIA is not in the main AMC filter");
  const catalog = (await route("catalog", sec)("?limit=40")).body;
  assert.deepEqual(catalog.items.map((item: Json) => item.projectId), ["M0001_2567", "M0002_2567", "M0003_2567", "M0004_2567", "M0005_2567", "M0008_2567"]);
  const paged: string[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 6; page += 1) {
    const { body } = await route("catalog", sec)(`?limit=8${cursor ? `&cursor=${cursor}` : ""}`);
    paged.push(...body.items.map((item: Json) => item.projectId));
    cursor = body.nextCursor;
    if (!cursor) break;
  }
  assert.ok(!paged.some((id) => id.startsWith("M090")), "paging never surfaces AIA rows");
  const byAmc = (await route("catalog", sec)(`?amc=${AIA_FIXTURE_AMC.unique_id}`)).body;
  assert.deepEqual(byAmc.items, [], "an AIA amc filter on the main tool returns nothing");
  const search = (await route("funds", sec)("?q=AIA")).body;
  assert.deepEqual(search.funds, []);
  const detail = (await route("detail", sec)("?proj_id=M0901_2567")).body;
  assert.equal(detail.source, "unavailable");
  assert.equal(detail.fund, null);
  assert.deepEqual(detail.warnings, ["กองทุนนี้ดูได้ในเครื่องมือกองทุน บลจ. เอไอเอ"]);
});

test("AIA scope: the AIA tool resolves the AMC id by name at runtime and shows only its funds", async () => {
  const sec = fixtureSec({ aia: true });
  const catalog = (await route("catalog", sec)("?scope=aia&limit=40")).body;
  assert.equal(catalog.source, "sec_v2");
  assert.deepEqual(catalog.items.map((item: Json) => item.projectId), ["M0901_2567", "M0902_2567"]);
  assert.equal(catalog.amcId, AIA_FIXTURE_AMC.unique_id);
  const profileCalls = sec.calls.filter((url) => url.pathname === "/v2/fund/general-info/profiles");
  assert.ok(profileCalls.length > 0 && profileCalls.every((url) => url.searchParams.get("company_info") === AIA_FIXTURE_AMC.unique_id), "SEC is queried with the resolved AIA id");
  // A client amc value cannot widen the AIA tool.
  const forced = (await route("catalog", sec)("?scope=aia&amc=C0001&limit=40")).body;
  assert.deepEqual(forced.items.map((item: Json) => item.projectId), ["M0901_2567", "M0902_2567"]);
  const equity = (await route("catalog", sec)("?scope=aia&category=equity")).body;
  assert.deepEqual(equity.items.map((item: Json) => item.projectId), ["M0901_2567"]);
  const amcs = (await route("amcs", sec)("?scope=aia")).body;
  assert.deepEqual(amcs.items.map((item: Json) => item.id), [AIA_FIXTURE_AMC.unique_id]);
  const search = (await route("funds", sec)("?scope=aia&q=AIA")).body;
  assert.deepEqual(search.funds.map((fund: Json) => fund.projectId), ["M0901_2567", "M0902_2567"]);
  const detail = (await route("detail", sec)("?scope=aia&proj_id=M0901_2567")).body;
  assert.equal(detail.fund.amcId, AIA_FIXTURE_AMC.unique_id);
  const other = (await route("detail", sec)("?scope=aia&proj_id=M0001_2567&class_name=A")).body;
  assert.equal(other.source, "unavailable");
  assert.deepEqual(other.warnings, ["เครื่องมือนี้แสดงเฉพาะกองทุนของ บลจ. เอไอเอ"]);
});

test("AIA scope: missing, ambiguous or unavailable AMC data fails closed; scope values are validated", async () => {
  for (const sec of [fixtureSec(), fixtureSec({ aia: "ambiguous" }), fixtureSec({ fail: (url) => url.pathname.endsWith("/amcs") ? 503 : null })]) {
    const { body } = await route("catalog", sec)("?scope=aia");
    assert.equal(body.source, "unavailable");
    assert.deepEqual(body.items, []);
    assert.equal(body.message, "ยังระบุ บลจ. เอไอเอ จากข้อมูล ก.ล.ต. ไม่ได้ชั่วคราว");
    assert.ok(!sec.calls.some((url) => url.pathname === "/v2/fund/general-info/profiles"), "no unscoped profile scan");
  }
  for (const name of ["amcs", "catalog", "detail", "funds"] as const) {
    const sec = fixtureSec();
    const { response, body } = await route(name, sec)(`?scope=all&q=KS&proj_id=M0001_2567`);
    assert.equal(response.status, 400, name);
    assert.equal(body.error, "scope_invalid", name);
    assert.equal(response.headers.get("Cache-Control"), "no-store", name);
    assert.equal(sec.calls.length, 0, name);
  }
});

test("AIA scope: UAT synthetic mode has a clearly synthetic AIA AMC and keeps the two catalogs apart", async () => {
  const options = { key: null, lane: "web-uat" } as const;
  const main = (await route("catalog", fixtureSec(), options)("?limit=40")).body;
  const aia = (await route("catalog", fixtureSec(), options)("?scope=aia&limit=40")).body;
  assert.equal(aia.source, "uat_synthetic");
  assert.deepEqual(aia.items.map((item: Json) => item.projectId), ["UAT-AIA-EQUITY-01", "UAT-AIA-FIXED-01"]);
  assert.ok(aia.items.every((item: Json) => item.amcId === "UAT-AIA-AMC" && /ข้อมูลสังเคราะห์/.test(item.amcNameTh)));
  assert.ok(main.items.length > 0 && main.items.every((item: Json) => item.amcId === "UAT-AMC"));
  assert.deepEqual((await route("amcs", fixtureSec(), options)("?scope=aia")).body.items.map((item: Json) => item.id), ["UAT-AIA-AMC"]);
  assert.ok(!(await route("amcs", fixtureSec(), options)()).body.items.some((item: Json) => item.id === "UAT-AIA-AMC"));
  assert.equal((await route("detail", fixtureSec(), options)("?scope=aia&proj_id=UAT-AIA-EQUITY-01")).body.source, "uat_synthetic");
  assert.equal((await route("detail", fixtureSec(), options)("?proj_id=UAT-AIA-EQUITY-01")).body.source, "unavailable");
});
