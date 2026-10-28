// Stored fund catalog for the บลจ. เอไอเอ tool (owner decision 2026-10-26):
// the sync job, the Web read-through policy, the AMC scopes, the Neon migration and
// the credential boundary. Offline: SEC is the contract fixture, Neon is a fake.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { INVESTMENT_COPY_DEFAULTS, investmentValue } from "../lib/content/investment-copy-defaults";
import { hiddenReasonForStatus, runFundCatalogSync, type FundSyncStore, type StoredFundDetail } from "../features/investment-allocation/server/catalog-sync";
import { validateFundCatalogConnection } from "../features/investment-allocation/server/fund-catalog-lanes";
import { createSecReader, projectSecRow, type SecPage, type SecPublicRow } from "../features/investment-allocation/server/sec-projection";
import { readThroughStore, singleFlight } from "../features/investment-allocation/server/store-fallback";
import type { FundCatalogStoreReader, StoredCatalog, StoredFund } from "../features/investment-allocation/server/fund-catalog-store";
import { runFundCatalogSyncCli, validateFundCatalogSync } from "../scripts/investment-fund-catalog-sync";
import { AIA_FIXTURE_AMC, AIA_FIXTURE_PROFILES, fixtureSec, route, type Json } from "./fixtures/investment-allocation/harness";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const HOURS = 60 * 60 * 1000;
const NON_AIA_ROW = JSON.parse(read("tests/fixtures/investment-allocation/sec-v2/profiles-registered.json")).items[0];

const storedDetail = (riskCode = "RS6"): StoredFundDetail => ({
  specification: [],
  risk: [{ risk_spectrum: riskCode, risk_spectrum_desc: "fixture", start_date: "2026-09-01", end_date: null, prospectus_type: "F", last_upd_date: "2026-09-02" }],
  allocation: [{ asset_name: "หุ้น", asset_ratio: "95.5", start_date: "2026-09-30", last_upd_date: "2026-10-01" }, { asset_name: "เงินฝาก", asset_ratio: "4.5", start_date: "2026-09-30", last_upd_date: "2026-10-01" }],
  dealing: [
    { fund_class_name: "main", type: "subscription", period: "ทุกวันทำการ", redemp_period_oth: null, settlement_period: null, start_date: "2026-09-01", last_upd_date: "2026-09-02" },
    { fund_class_name: "main", type: "redemption", period: "ทุกวันทำการ", redemp_period_oth: null, settlement_period: "T+3", start_date: "2026-09-01", last_upd_date: "2026-09-02" },
  ],
  endpointStates: { profile: "ok", specification: "empty", risk: "ok", allocation: "ok", dealing: "ok" },
});

function storedCatalog(ageMs: number, extraRows: Json[] = []): StoredCatalog {
  const fetchedAt = new Date(Date.now() - ageMs).toISOString();
  return {
    amc: { id: AIA_FIXTURE_AMC.unique_id, nameTh: AIA_FIXTURE_AMC.comp_name_th, nameEn: AIA_FIXTURE_AMC.comp_name_en },
    fetchedAt,
    funds: [...AIA_FIXTURE_PROFILES, ...extraRows].map((row, index) => ({ projectId: row.proj_id, listPosition: index, profileRows: [row], profileFetchedAt: fetchedAt })),
  };
}

function storedFund(projectId: string, ageMs: number, overrides: Partial<StoredFund> = {}): StoredFund {
  const at = new Date(Date.now() - ageMs).toISOString();
  return {
    visible: true, hiddenReason: null, secStatus: "Registered",
    profileRows: AIA_FIXTURE_PROFILES.filter((row) => row.proj_id === projectId), detail: storedDetail(),
    profileFetchedAt: at, detailFetchedAt: at, amcId: AIA_FIXTURE_AMC.unique_id, catalogFetchedAt: at, ...overrides,
  };
}

function fakeStore(options: { catalog?: StoredCatalog | null | Error; funds?: Record<string, StoredFund>; claim?: () => boolean } = {}) {
  const calls = { readCatalog: 0, readFund: 0, claim: [] as string[] };
  const store: FundCatalogStoreReader = {
    async readCatalog() {
      calls.readCatalog += 1;
      if (options.catalog instanceof Error) throw options.catalog;
      return options.catalog ?? null;
    },
    async readFund(_scope, projectId) {
      calls.readFund += 1;
      return options.funds?.[projectId] ?? null;
    },
    async claimLiveFallback(key) {
      calls.claim.push(key);
      return options.claim ? options.claim() : true;
    },
  };
  return { store, calls };
}

// ---------- AMC scopes ----------

test("AIA tool shows only บลจ. เอไอเอ funds from the store; the main tool never reads the store and excludes AIA", async () => {
  const { store, calls } = fakeStore({ catalog: storedCatalog(HOURS, [NON_AIA_ROW]) });
  const sec = fixtureSec({ aia: true });
  const aia = (await route("catalog", sec, { store })("?scope=aia&limit=40")).body;
  assert.equal(aia.origin, "store");
  assert.deepEqual(aia.items.map((item: Json) => item.projectId), ["M0901_2567", "M0902_2567"], "a non-AIA row in the store is still filtered out");
  assert.ok(aia.items.every((item: Json) => item.amcNameTh.includes("เอไอเอ")));

  const readsBefore = calls.readCatalog;
  const main = (await route("catalog", sec, { store })("?limit=40")).body;
  assert.equal(calls.readCatalog, readsBefore, "the main tool does not read the AIA store");
  assert.equal(main.origin, undefined);
  assert.equal(main.items.some((item: Json) => item.amcNameTh.includes("เอไอเอ")), false, "AIA funds stay out of the main tool");
  assert.ok(main.items.length > 0);
});

test("a stored AIA project is out of scope in the main tool detail", async () => {
  const { store } = fakeStore({ catalog: storedCatalog(HOURS), funds: { M0901_2567: storedFund("M0901_2567", HOURS) } });
  const main = (await route("detail", fixtureSec({ aia: true }), { store })("?proj_id=M0901_2567")).body;
  assert.equal(main.fund, null);
  assert.deepEqual(main.warnings, ["กองทุนนี้ดูได้ในเครื่องมือกองทุน บลจ. เอไอเอ"]);
});

// ---------- cache hit ----------

test("cache hit: fresh stored catalog, detail and search answer without any SEC call or lease", async () => {
  const { store, calls } = fakeStore({ catalog: storedCatalog(2 * HOURS), funds: { M0901_2567: storedFund("M0901_2567", 2 * HOURS), M0902_2567: storedFund("M0902_2567", 2 * HOURS) } });
  const sec = fixtureSec({ aia: true });
  const catalog = (await route("catalog", sec, { store })("?scope=aia&category=equity")).body;
  assert.deepEqual(catalog.items.map((item: Json) => item.projectId), ["M0901_2567"]);
  assert.equal(catalog.state, "fresh");
  assert.ok(Math.abs(Date.parse(catalog.fetchedAt) - (Date.now() - 2 * HOURS)) < 60_000, "fetchedAt is the stored SEC fetch time, not the request time");

  const detail = (await route("detail", sec, { store })("?scope=aia&proj_id=M0901_2567")).body;
  assert.equal(detail.origin, "store");
  assert.equal(detail.source, "sec_v2");
  assert.equal(detail.state, "fresh");
  assert.equal(detail.risk.level, 6);
  assert.deepEqual(detail.assetAllocation.map((row: Json) => row.percentNav), [95.5, 4.5]);
  assert.equal(detail.selectedClassName, "main");
  assert.equal(detail.dealing.settlementBucket, "T+3");

  const search = (await route("funds", sec, { store })("?scope=aia&q=AIA-FX")).body;
  assert.equal(search.origin, "store");
  assert.deepEqual(search.funds.map((fund: Json) => [fund.projectId, fund.riskSpectrum]), [["M0901_2567", 6], ["M0902_2567", 6]]);

  assert.equal(sec.calls.length, 0, "no SEC request on the cache-hit path");
  assert.deepEqual(calls.claim, [], "no lease is taken when the store is fresh");
});

test("stored catalog pages with its own cursor and never forwards it to SEC", async () => {
  const many = Array.from({ length: 12 }, (_, index) => ({ ...AIA_FIXTURE_PROFILES[0], proj_id: `M09${String(10 + index)}_2567`, proj_abbr_name: `AIA-P${index}` }));
  const { store } = fakeStore({ catalog: storedCatalog(HOURS, many) });
  const sec = fixtureSec({ aia: true });
  const run = route("catalog", sec, { store });
  const first = (await run("?scope=aia&limit=8")).body;
  assert.equal(first.items.length, 8);
  assert.equal(first.hasMore, true);
  const second = (await run(`?scope=aia&limit=8&cursor=${first.nextCursor}`)).body;
  assert.equal(second.items.length, 6);
  assert.equal(second.hasMore, false);
  assert.equal(new Set([...first.items, ...second.items].map((item: Json) => item.projectId)).size, 14);
  // The same cursor sent to the main (live SEC) tool restarts at page one instead of reaching SEC.
  await route("catalog", sec)(`?limit=8&cursor=${first.nextCursor}`);
  assert.equal(sec.calls.some((url) => url.searchParams.get("next_cursor") === "ccpun-store-v1"), false);
});

// ---------- stale fallback and lock ----------

test("stale store: the lease holder refreshes live from SEC; others get the stale copy without SEC", async () => {
  const stale = storedCatalog(40 * HOURS);
  const holder = fakeStore({ catalog: stale, claim: () => true });
  const secA = fixtureSec({ aia: true });
  const live = (await route("catalog", secA, { store: holder.store })("?scope=aia")).body;
  assert.equal(live.origin, "live");
  assert.equal(live.state, "fresh");
  assert.ok(secA.calls.length > 0);
  assert.deepEqual(holder.calls.claim, ["aia:catalog"]);

  const waiter = fakeStore({ catalog: stale, claim: () => false });
  const secB = fixtureSec({ aia: true });
  const served = (await route("catalog", secB, { store: waiter.store })("?scope=aia")).body;
  assert.equal(served.origin, "store");
  assert.equal(served.state, "stale");
  assert.equal(served.message, "ข้อมูลกองทุนอาจยังไม่อัปเดตล่าสุด");
  assert.equal(served.items.length, 2);
  assert.equal(secB.calls.length, 0);
});

test("empty store: without the lease the visitor gets a busy answer, never a SEC call; a failed live call keeps the stale copy", async () => {
  const empty = fakeStore({ catalog: null, claim: () => false });
  const sec = fixtureSec({ aia: true });
  const busy = (await route("catalog", sec, { store: empty.store })("?scope=aia")).body;
  assert.equal(busy.source, "unavailable");
  assert.equal(busy.message, "กำลังอัปเดตข้อมูลกองทุน กรุณาลองใหม่อีกครั้งในอีกสักครู่");
  assert.equal(sec.calls.length, 0);

  const failing = fakeStore({ catalog: storedCatalog(40 * HOURS), claim: () => true });
  const down = (await route("catalog", fixtureSec({ aia: true, fail: () => 503 }), { store: failing.store })("?scope=aia")).body;
  assert.equal(down.state, "stale");
  assert.equal(down.items.length, 2);
});

test("lock: concurrent visitors on a stale store trigger at most one live SEC listing", async () => {
  let leases = 0;
  const { store } = fakeStore({ catalog: storedCatalog(40 * HOURS), claim: () => (leases += 1) === 1 });
  const sec = fixtureSec({ aia: true });
  const run = route("catalog", sec, { store });
  const bodies = await Promise.all(Array.from({ length: 6 }, (_, index) => run("?scope=aia", { "x-forwarded-for": `203.0.113.${20 + index}` }).then((result) => result.body)));
  const listings = sec.calls.filter((url) => url.pathname === "/v2/fund/general-info/profiles" && url.searchParams.get("fund_status") === "Registered");
  assert.equal(listings.length, 1, "one live listing for six visitors");
  assert.ok(bodies.every((body) => body.items.length === 2), "every visitor still sees the AIA funds");
  assert.ok(bodies.every((body) => body.origin === "live" || body.state === "stale"));
});

test("read-through policy: Neon unreachable falls back to live with single-flight only", async () => {
  let liveCalls = 0;
  const live = async () => { liveCalls += 1; await new Promise((done) => setTimeout(done, 5)); return "live"; };
  const results = await Promise.all(Array.from({ length: 4 }, () => readThroughStore<string, string>({
    read: async () => { throw new Error("neon_down"); }, fetchedAt: () => null,
    claim: async () => { throw new Error("must not be called"); }, live, liveUsable: () => true, flightKey: "test:neon-down",
  })));
  assert.deepEqual(results.map((result) => result.kind), ["live", "live", "live", "live"]);
  assert.equal(liveCalls, 1);
  assert.equal(await singleFlight("test:after", async () => 1), 1);
});

test("detail: stale stored detail is served marked stale when another instance holds the lease", async () => {
  const { store } = fakeStore({ funds: { M0901_2567: storedFund("M0901_2567", 40 * HOURS) }, claim: () => false });
  const sec = fixtureSec({ aia: true });
  const detail = (await route("detail", sec, { store })("?scope=aia&proj_id=M0901_2567")).body;
  assert.equal(detail.state, "stale");
  assert.ok(detail.warnings.includes("ข้อมูลกองทุนอาจยังไม่อัปเดตล่าสุด"));
  assert.equal(sec.calls.length, 0);
});

// ---------- cancelled / merged funds ----------

test("a cancelled or merged stored fund is hidden: absent from the catalog, detail explains, no SEC call", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
  const catalog = storedCatalog(HOURS);
  catalog.funds = catalog.funds.filter((fund) => fund.projectId !== "M0902_2567");
  const { store } = fakeStore({ catalog, funds: { M0902_2567: storedFund("M0902_2567", 30 * HOURS, { visible: false, hiddenReason: "cancelled", secStatus: "Cancelled" }) } });
  // A definitive hidden record stays hidden when its awaited read crosses a clock tick.
  const readFund = store.readFund;
  store.readFund = async (...args) => {
    t.mock.timers.tick(20);
    return readFund(...args);
  };
  const sec = fixtureSec({ aia: true });
  const list = (await route("catalog", sec, { store })("?scope=aia")).body;
  assert.deepEqual(list.items.map((item: Json) => item.projectId), ["M0901_2567"]);
  const detail = (await route("detail", sec, { store })("?scope=aia&proj_id=M0902_2567")).body;
  assert.equal(detail.fund, null);
  assert.deepEqual(detail.warnings, ["กองทุนนี้ยกเลิกหรือควบรวมแล้วตามข้อมูล ก.ล.ต. จึงไม่แสดงในเครื่องมือนี้"]);
  assert.equal(sec.calls.length, 0);
});

// In-memory store with the same rules as the ccpun_fund sync_* functions.
function memoryStore() {
  const funds = new Map<string, { visible: boolean; hiddenReason: string | null; secStatus: string; detail: StoredFundDetail | null; profileRows: SecPublicRow[] }>();
  const runs: Array<Record<string, unknown>> = [];
  const changes: Array<{ runId: string; projectId: string; change: string; reason?: string; secStatus?: string | null }> = [];
  let running: string | null = null;
  const store: FundSyncStore = {
    async begin() {
      if (running) return null;
      running = `run-${runs.length + 1}`;
      runs.push({ runId: running, status: "running" });
      return running;
    },
    async visibleProjects() { return [...funds].filter(([, fund]) => fund.visible).map(([id]) => id).sort(); },
    async upsertFund(input) {
      const previous = funds.get(input.projectId);
      const outcome = !previous ? "added" : previous.visible ? "updated" : "restored";
      funds.set(input.projectId, { visible: true, hiddenReason: null, secStatus: input.secStatus, profileRows: input.profileRows, detail: input.detail ?? previous?.detail ?? null });
      if (outcome !== "updated") changes.push({ runId: input.runId, projectId: input.projectId, change: outcome });
      return outcome;
    },
    async hideFund(runId, projectId, reason, secStatus) {
      const fund = funds.get(projectId);
      if (!fund?.visible) return false;
      Object.assign(fund, { visible: false, hiddenReason: reason, secStatus: secStatus ?? fund.secStatus });
      changes.push({ runId, projectId, change: "hidden", reason, secStatus });
      return true;
    },
    async finish(input) {
      Object.assign(runs.find((run) => run.runId === input.runId)!, input);
      running = null;
    },
  };
  return { store, funds, runs, changes };
}

function syncSec(state: { listed: Json[]; lookups?: Record<string, Json[] | Error>; amcs?: Json[] }) {
  const calls: string[] = [];
  const readSec = async (path: string): Promise<SecPage> => {
    calls.push(path);
    const url = new URL(path, "https://api.sec.or.th");
    const p = url.searchParams;
    if (url.pathname === "/v2/fund/general-info/amcs") {
      return { items: (state.amcs ?? [{ unique_id: "C0001", comp_name_th: "บลจ. กรุงสยาม จำกัด", comp_name_en: "Krungsiam" }, AIA_FIXTURE_AMC]).map((row) => projectSecRow(row)!), nextCursor: null };
    }
    if (url.pathname === "/v2/fund/general-info/profiles" && p.get("fund_status")) {
      return { items: state.listed.filter((row) => row.fund_status === p.get("fund_status") && row.unique_id === p.get("company_info")).map((row) => projectSecRow(row)!), nextCursor: null };
    }
    if (url.pathname === "/v2/fund/general-info/profiles") {
      const id = p.get("project_info")!;
      const lookup = state.lookups?.[id];
      if (lookup instanceof Error) throw lookup;
      return { items: (lookup ?? state.listed.filter((row) => row.proj_id === id)).map((row) => projectSecRow(row)!), nextCursor: null };
    }
    if (url.pathname.endsWith("/risk-spectrum")) return { items: storedDetail().risk, nextCursor: null };
    return { items: [], nextCursor: null };
  };
  return { readSec, calls };
}

test("sync: lists the AIA AMC's current funds, stores their SEC facts and logs new funds", async () => {
  const memory = memoryStore();
  const sec = syncSec({ listed: [...AIA_FIXTURE_PROFILES, { ...NON_AIA_ROW }] });
  const summary = await runFundCatalogSync({ readSec: sec.readSec, store: memory.store, requestGapMs: 0 });
  assert.equal(summary.status, "succeeded");
  assert.equal(summary.fundsListed, 2);
  assert.equal(summary.added, 2);
  assert.deepEqual([...memory.funds.keys()], ["M0901_2567", "M0902_2567"]);
  assert.equal(memory.funds.get("M0901_2567")!.detail!.risk[0].risk_spectrum, "RS6");
  assert.ok(sec.calls.every((path) => !path.includes("company_info=C0001")), "only the AIA AMC is listed");
  assert.deepEqual(memory.changes.map((change) => change.change), ["added", "added"]);
  assert.equal(memory.runs[0].status, "succeeded");
  assert.deepEqual((memory.runs[0].amc as Json).id, AIA_FIXTURE_AMC.unique_id);
});

test("sync: a fund SEC marks cancelled or merged is hidden, not deleted; a fund that returns is restored", async () => {
  const memory = memoryStore();
  await runFundCatalogSync({ readSec: syncSec({ listed: AIA_FIXTURE_PROFILES }).readSec, store: memory.store, requestGapMs: 0 });

  const cancelled = { ...AIA_FIXTURE_PROFILES[1], fund_status: "Cancelled" };
  const second = await runFundCatalogSync({ readSec: syncSec({ listed: [AIA_FIXTURE_PROFILES[0]], lookups: { M0902_2567: [cancelled] } }).readSec, store: memory.store, requestGapMs: 0 });
  assert.equal(second.hidden, 1);
  assert.equal(memory.funds.has("M0902_2567"), true, "never deleted");
  assert.equal(memory.funds.get("M0902_2567")!.visible, false);
  assert.equal(memory.funds.get("M0902_2567")!.hiddenReason, "cancelled");
  assert.deepEqual(memory.changes.at(-1), { runId: "run-2", projectId: "M0902_2567", change: "hidden", reason: "cancelled", secStatus: "Cancelled" });

  const third = await runFundCatalogSync({ readSec: syncSec({ listed: AIA_FIXTURE_PROFILES }).readSec, store: memory.store, requestGapMs: 0 });
  assert.equal(third.restored, 1);
  assert.equal(memory.funds.get("M0902_2567")!.visible, true);

  assert.equal(hiddenReasonForStatus("Merged"), "merged");
  assert.equal(hiddenReasonForStatus("Cancelled"), "cancelled");
  assert.equal(hiddenReasonForStatus("Liquidated"), "cancelled");
  assert.equal(hiddenReasonForStatus("Suspended"), "inactive");
  assert.equal(hiddenReasonForStatus(null), "not_listed");
});

test("sync: unknown status keeps a fund visible; an empty listing hides nothing; a failed detail keeps the old facts", async () => {
  const memory = memoryStore();
  await runFundCatalogSync({ readSec: syncSec({ listed: AIA_FIXTURE_PROFILES }).readSec, store: memory.store, requestGapMs: 0 });

  const lookupFails = await runFundCatalogSync({ readSec: syncSec({ listed: [AIA_FIXTURE_PROFILES[0]], lookups: { M0902_2567: new Error("sec_http_503") } }).readSec, store: memory.store, requestGapMs: 0 });
  assert.equal(lookupFails.status, "partial");
  assert.equal(memory.funds.get("M0902_2567")!.visible, true, "unknown is not closed");

  const empty = await runFundCatalogSync({ readSec: syncSec({ listed: [] }).readSec, store: memory.store, requestGapMs: 0 });
  assert.equal(empty.status, "failed");
  assert.equal(empty.errorCode, "empty_active_listing");
  assert.ok([...memory.funds.values()].every((fund) => fund.visible));

  const before = memory.funds.get("M0901_2567")!.detail;
  const flaky = syncSec({ listed: AIA_FIXTURE_PROFILES });
  const failingDetail = async (path: string) => {
    if (path.includes("asset-allocation") && path.includes("M0901_2567")) throw new Error("sec_http_500");
    return flaky.readSec(path);
  };
  const partial = await runFundCatalogSync({ readSec: failingDetail, store: memory.store, requestGapMs: 0 });
  assert.equal(partial.status, "partial");
  assert.equal(partial.detailFailures, 1);
  assert.deepEqual(memory.funds.get("M0901_2567")!.detail, before);
});

test("sync: AMC must resolve to exactly one บลจ. เอไอเอ; a running sync is not doubled; the SEC request budget is bounded", async () => {
  const memory = memoryStore();
  const none = await runFundCatalogSync({ readSec: syncSec({ listed: AIA_FIXTURE_PROFILES, amcs: [{ unique_id: "C0001", comp_name_th: "บลจ. กรุงสยาม จำกัด" }] }).readSec, store: memory.store, requestGapMs: 0 });
  assert.equal(none.errorCode, "aia_amc_unresolved");
  const two = await runFundCatalogSync({ readSec: syncSec({ listed: AIA_FIXTURE_PROFILES, amcs: [AIA_FIXTURE_AMC, { ...AIA_FIXTURE_AMC, unique_id: "C0901" }] }).readSec, store: memory.store, requestGapMs: 0 });
  assert.equal(two.errorCode, "aia_amc_ambiguous");
  assert.equal(memory.funds.size, 0);

  await memory.store.begin("aia", "manual");
  const skipped = await runFundCatalogSync({ readSec: syncSec({ listed: AIA_FIXTURE_PROFILES }).readSec, store: memory.store, requestGapMs: 0 });
  assert.equal(skipped.status, "skipped");

  const budget = memoryStore();
  const capped = await runFundCatalogSync({ readSec: syncSec({ listed: AIA_FIXTURE_PROFILES }).readSec, store: budget.store, requestGapMs: 0, maxSecRequests: 4 });
  assert.equal(capped.status, "failed");
  assert.equal(capped.errorCode, "sec_request_budget");
  assert.equal(capped.secRequests, 4);
});

test("SEC reader projects public fields only and reports fixed error codes", async () => {
  const reader = createSecReader("k", async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ items: [{ proj_id: "M0901_2567", secret: "x", nested: { a: 1 } }], next_cursor: "n2" }) }));
  assert.deepEqual(await reader("/v2/x"), { items: [{ proj_id: "M0901_2567" }], nextCursor: "n2" });
  const failing = createSecReader("k", async () => ({ ok: false, status: 429, text: async () => "" }));
  await assert.rejects(failing("/v2/x"), /^Error: sec_http_429$/);
});

// ---------- private VPS CLI and credentials ----------

const UAT_SYNC_URL = "postgresql://ccpun_fund_sync:pw@ep-mute-frost-aztvz394-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
const SYNC_ENV = { CCPUN_BACKGROUND_EXECUTION_PLANE: "vps", CCPUN_FUND_CATALOG_SYNC_ENABLED: "1", CCPUN_FUND_CATALOG_LANE: "web-uat", CCPUN_FUND_CATALOG_SYNC_DATABASE_URL: UAT_SYNC_URL, SEC_API_PRIMARY_KEY: "k" };

test("sync CLI runs only on the VPS plane with its own lane-bound writer credential", async () => {
  assert.equal(validateFundCatalogSync(SYNC_ENV).lane, "web-uat");
  for (const [override, code] of [
    [{ CCPUN_BACKGROUND_EXECUTION_PLANE: "cloud" }, "FUND_CATALOG_SYNC_ACTIVATION_DENIED"],
    [{ CCPUN_FUND_CATALOG_SYNC_ENABLED: "0" }, "FUND_CATALOG_SYNC_ACTIVATION_DENIED"],
    [{ NEXT_RUNTIME: "nodejs" }, "FUND_CATALOG_SYNC_ACTIVATION_DENIED"],
    [{ VERCEL_ENV: "production" }, "FUND_CATALOG_SYNC_ACTIVATION_DENIED"],
    [{ CCPUN_FUND_CATALOG_LANE: "admin-uat" }, "FUND_CATALOG_SYNC_LANE_DENIED"],
    [{ CCPUN_FUND_CATALOG_LANE: "production" }, "FUND_CATALOG_SYNC_DATABASE_DENIED"],
    [{ CCPUN_FUND_CATALOG_SYNC_DATABASE_URL: UAT_SYNC_URL.replace("ccpun_fund_sync", "ccpun_fund_runtime") }, "FUND_CATALOG_SYNC_DATABASE_DENIED"],
    [{ CCPUN_FUND_CATALOG_SYNC_DATABASE_URL: UAT_SYNC_URL.replace("ccpun_fund_sync", "ccpun_admin_runtime") }, "FUND_CATALOG_SYNC_DATABASE_DENIED"],
    [{ SEC_API_PRIMARY_KEY: "" }, "FUND_CATALOG_SYNC_SEC_KEY_MISSING"],
  ] as const) {
    assert.throws(() => validateFundCatalogSync({ ...SYNC_ENV, ...override }), new RegExp(code));
  }
  const memory = memoryStore();
  const result = await runFundCatalogSyncCli("manual", SYNC_ENV, { store: async () => memory.store, readSec: () => syncSec({ listed: AIA_FIXTURE_PROFILES }).readSec });
  assert.equal(result.lane, "web-uat");
  assert.equal(result.status, "succeeded");
});

test("connection validation binds endpoint, role, database and TLS per lane", () => {
  assert.ok(validateFundCatalogConnection(UAT_SYNC_URL, "web-uat", "ccpun_fund_sync"));
  assert.equal(validateFundCatalogConnection(UAT_SYNC_URL, "production", "ccpun_fund_sync"), null);
  assert.equal(validateFundCatalogConnection(UAT_SYNC_URL.replace("sslmode=require", "sslmode=disable"), "web-uat", "ccpun_fund_sync"), null);
  assert.equal(validateFundCatalogConnection(UAT_SYNC_URL.replace("/neondb", "/other"), "web-uat", "ccpun_fund_sync"), null);
  assert.equal(validateFundCatalogConnection(UAT_SYNC_URL.replace("ep-mute-frost-aztvz394", "ep-other"), "web-uat", "ccpun_fund_sync"), null);
});

test("Web runtime files never read the writer credential or import the writer", () => {
  const webReachable = [
    "features/investment-allocation/server/sec-v2.ts",
    "features/investment-allocation/server/fund-catalog-store.ts",
    "features/investment-allocation/server/fund-catalog-lanes.ts",
    "features/investment-allocation/server/store-fallback.ts",
    "features/investment-allocation/server/sec-projection.ts",
    "apps/web/app/api/investment-allocation/catalog/route.ts",
    "apps/web/app/api/investment-allocation/detail/route.ts",
    "apps/web/app/api/investment-allocation/funds/route.ts",
  ];
  for (const file of webReachable) {
    // Type-only imports are erased at build time and carry no runtime code.
    const source = read(file).replace(/^import type [^\n]*\n/gm, "");
    assert.doesNotMatch(source, /CCPUN_FUND_CATALOG_SYNC_DATABASE_URL|catalog-sync-store|from "\.\/catalog-sync"/, file);
  }
  const reader = read("features/investment-allocation/server/fund-catalog-store.ts");
  assert.match(reader, /^import "server-only";/);
  assert.match(reader, /"ccpun_fund_runtime"/);
  assert.doesNotMatch(reader, /"ccpun_fund_sync"/, "the Web reader only accepts the runtime role");
  assert.match(reader, /import type \{ StoredFundDetail \} from "\.\/catalog-sync";/, "type-only import from the sync module");
  assert.doesNotMatch(reader, /sync_(?:begin|upsert_fund|hide_fund|finish|visible_projects)/);
  const cli = read("scripts/investment-fund-catalog-sync.ts");
  assert.match(cli, /Private VPS process only/);
  assert.doesNotMatch(cli, /createServer|listen\(/);
});

// ---------- Web store reader (sandboxed: no "server-only" resolver in plain Node) ----------

function loadReader() {
  const source = stripTypeScriptTypes(read("features/investment-allocation/server/fund-catalog-store.ts"), { mode: "transform" })
    .replace(/^import [\s\S]*?;\n/gm, "").replace(/export /g, "");
  return runInNewContext(`${source}\n({ createFundCatalogStoreReader, mapCatalogRows, mapFundRow, resolveFundCatalogRuntime });`, {
    Date, Map, Number, JSON, Symbol, globalThis: {}, process: { env: {} }, AbortSignal, URL, randomUUID: () => "00000000-0000-4000-8000-000000000001",
    neon: () => { throw new Error("no network in tests"); },
    validateFundCatalogConnection,
    resolveDeploymentIdentity: (variables: Record<string, string | undefined>) => ({ valid: true, provider: variables.CCPUN_DEPLOYMENT_PROVIDER, role: variables.CCPUN_DEPLOYMENT_ROLE, environment: variables.CCPUN_APP_ENV }),
  });
}

test("Web reader maps read_catalog/read_fund rows, caches briefly and binds the runtime role to the Web lane", async () => {
  const api = loadReader();
  const queries: string[] = [];
  let now = 0;
  const reader = api.createFundCatalogStoreReader(async (text: string) => {
    queries.push(text);
    if (text.includes("read_catalog")) return [{ project_id: "M0901_2567", list_position: 0, profile_rows: [AIA_FIXTURE_PROFILES[0]], profile_fetched_at: "2026-10-26T01:00:00Z", amc_id: "C0900", amc_name_th: AIA_FIXTURE_AMC.comp_name_th, amc_name_en: null, catalog_fetched_at: "2026-10-26T01:00:00Z" }];
    if (text.includes("read_fund")) return [{ visible: false, hidden_reason: "merged", sec_status: "Merged", profile_rows: "[]", detail: null, profile_fetched_at: "2026-10-26T01:00:00Z", detail_fetched_at: null, amc_id: "C0900", catalog_fetched_at: "2026-10-26T01:00:00Z" }];
    return [{ claimed: true }];
  }, () => now);
  const catalog = await reader.readCatalog("aia");
  assert.equal(catalog.fetchedAt, "2026-10-26T01:00:00.000Z");
  assert.equal(catalog.funds[0].projectId, "M0901_2567");
  await reader.readCatalog("aia");
  assert.equal(queries.length, 1, "second read within the cache window does not query Neon");
  now = 3 * 60 * 1000;
  await reader.readCatalog("aia");
  assert.equal(queries.length, 2);
  const fund = await reader.readFund("aia", "M0902_2567");
  assert.equal(fund.visible, false);
  assert.equal(fund.hiddenReason, "merged");
  assert.equal(await reader.claimLiveFallback("aia:catalog", 60), true);
  assert.equal(api.mapCatalogRows([{ project_id: null, amc_id: "C0900", amc_name_th: "x", catalog_fetched_at: "2026-10-26T01:00:00Z" }]).funds.length, 0, "an empty store row maps to an empty catalog");
  assert.equal(api.mapCatalogRows([]), null);

  const webUat = { CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "web", CCPUN_APP_ENV: "web-uat", NEXT_PUBLIC_CCPUN_APP_ENV: "web-uat", CCPUN_UAT_MODE: "1",
    CCPUN_FUND_CATALOG_DATABASE_URL: UAT_SYNC_URL.replace("ccpun_fund_sync", "ccpun_fund_runtime") };
  assert.equal(api.resolveFundCatalogRuntime(webUat).lane, "web-uat");
  assert.equal(api.resolveFundCatalogRuntime({ ...webUat, CCPUN_FUND_CATALOG_DATABASE_URL: UAT_SYNC_URL }), null, "the writer credential is refused on Web");
  assert.equal(api.resolveFundCatalogRuntime({ ...webUat, CCPUN_DEPLOYMENT_ROLE: "admin" }), null);
  assert.equal(api.resolveFundCatalogRuntime({ ...webUat, CCPUN_UAT_MODE: "0" }), null);
  assert.equal(api.resolveFundCatalogRuntime({ ...webUat, CCPUN_FUND_CATALOG_DATABASE_URL: undefined }), null, "no credential keeps the existing live path");
});

// ---------- migration ----------

test("migration is additive, checksum-locked and least-privilege", () => {
  const sql = read("db/migrations/20261026_investment_fund_catalog_v1.sql");
  const body = sql.split("-- checksum-source-begin\n")[1]!.split("-- checksum-source-end")[0]!;
  const checksum = `sha256:${createHash("sha256").update(body).digest("hex")}`;
  assert.equal(sql.split(checksum).length - 1, 2, "guard and ledger both pin the exact body checksum");
  // Statements only: string literals (privilege names, comments on objects) and SQL comments removed.
  const statements = sql.replace(/'[^']*'/g, "''").replace(/--[^\n]*/g, "");
  assert.doesNotMatch(statements, /\bDROP\s|\bTRUNCATE\b|\bDELETE\s+FROM\b|\bALTER\s+TABLE\b|\bRENAME\b|\bALTER\s+ROLE\b/i, "additive only");
  const schemas = new Set([...sql.matchAll(/\b(ccpun_[a-z_]+)\.[a-z_]+/g)].map((match) => match[1]));
  assert.deepEqual([...schemas], ["ccpun_fund"], "touches only the new ccpun_fund schema");
  for (const statement of body.match(/CREATE (?:TABLE|INDEX)[^\n]*/g) ?? []) assert.match(statement, /IF NOT EXISTS/, statement);
  assert.match(sql, /CREATE ROLE ccpun_fund_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS/);
  assert.match(sql, /CREATE ROLE ccpun_fund_sync NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS/);
  assert.doesNotMatch(body, /GRANT [^;]*ON (?:TABLE|ALL TABLES|ccpun_fund\.(?!read_|claim_|sync_))/i, "no direct table grants");
  const runtimeGrant = body.match(/GRANT EXECUTE ON FUNCTION ([^;]*) TO ccpun_fund_runtime;/)![1];
  assert.doesNotMatch(runtimeGrant, /sync_/, "the Web reader cannot write fund data");
  const syncGrant = body.match(/GRANT EXECUTE ON FUNCTION ([^;]*) TO ccpun_fund_sync;/)![1];
  assert.doesNotMatch(syncGrant, /read_|claim_/);
  for (const fn of body.match(/CREATE OR REPLACE FUNCTION[\s\S]*?\$function\$/g) ?? []) assert.match(fn, /SECURITY DEFINER SET search_path = pg_catalog/, fn.slice(0, 80));
  assert.match(body, /hidden_reason text CHECK \(hidden_reason IS NULL OR hidden_reason IN \('cancelled','merged','inactive','not_listed'\)\)/);
  assert.doesNotMatch(statements, /\b(?:ip|user_agent|email|phone|visitor)\b/i, "no visitor data columns");
});

test("UI: the stored catalog shows its SEC fetch date as ข้อมูล ณ วันที่", () => {
  const builder = read("features/investment-allocation/SingleFundBuilder.tsx");
  assert.match(builder, /catalog\.origin === "store" \? investmentValue\(text\("investment\.single\.text057"\), \[label\(formatDate\(catalog\.fetchedAt\)\)\]\) : investmentValue\(text\("investment\.single\.text058"\), \[label\(formatDate\(catalog\.fetchedAt\)\)\]\)/);
  assert.equal(investmentValue(INVESTMENT_COPY_DEFAULTS["investment.single.text057"], ["31 ส.ค. 2569"]), "ข้อมูล ณ วันที่ 31 ส.ค. 2569");
  assert.equal(investmentValue(INVESTMENT_COPY_DEFAULTS["investment.single.text058"], ["31 ส.ค. 2569"]), "ตรวจข้อมูลล่าสุด 31 ส.ค. 2569");
});
