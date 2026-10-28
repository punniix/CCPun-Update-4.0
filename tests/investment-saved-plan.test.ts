import assert from "node:assert/strict";
import test from "node:test";
import { fetchRestoreData, parseSavedPlan, readSavedPlan, savePlanLocally, SAVED_PLAN_KEYS } from "../features/investment-allocation/domain/saved-plan";
import { MAX_INVESTMENT_AMOUNT } from "../features/investment-allocation/domain/calculation";
import { investmentValue } from "../lib/content/investment-copy-defaults";
import { PUBLIC_COPY_SCOPES, parsePublicCopy, publicCopyDocumentId, publicCopyInitialEntries, publicCopyText } from "../lib/content/public-copy-registry";

const choices = { project_id: "M0001_2569", class_name: "A", restore_query: "FUND-A", selected_weight_percent: 100 };
const single = (scope = "main") => ({ schema_version: 1, tool_scope: scope, journey_mode: "single_fund", investment_amount: 100000, selected_fund: { ...choices } });
const portfolio = () => ({ schema_version: 1, tool_scope: "main", methodology_version: "investment_allocation_v1", investment_amount: 100000,
  selected_funds: [{ ...choices }],
  fund_construction_allocation: ["mixed", "equity", "fixed_income", "money_market", "other"].map(key => ({ key, percent: key === "mixed" ? 100 : 0 })),
  target_asset_allocation: ["equity", "fixed_income", "cash", "other"].map(key => ({ key, percent: 0 })),
});
function memoryStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

test("same storage keys round-trip bounded choices separately for main/AIA and both modes", () => {
  const storage = memoryStorage();
  assert.equal(readSavedPlan(storage, "single", "main"), null);
  savePlanLocally(storage, "single", "main", single());
  savePlanLocally(storage, "single", "aia", { ...single("aia"), investment_amount: 200000 });
  savePlanLocally(storage, "portfolio", "main", portfolio());
  assert.equal(storage.values.size, 2);
  assert.equal(readSavedPlan(storage, "single", "main")?.amount, 100000);
  assert.equal(readSavedPlan(storage, "single", "aia")?.amount, 200000);
  assert.equal(readSavedPlan(storage, "portfolio", "main")?.funds[0].weight, 100);
  assert.equal(readSavedPlan(storage, "portfolio", "aia"), null);
});

test("unscoped old/corrupt values remain intact and are preserved when a new scoped plan is saved", () => {
  for (const old of [JSON.stringify(single()).replace(',"tool_scope":"main"', ""), "{broken"]) {
    const storage = memoryStorage({ [SAVED_PLAN_KEYS.single]: old });
    assert.throws(() => readSavedPlan(storage, "single", "main"), /saved_plan_legacy/);
    assert.equal(storage.getItem(SAVED_PLAN_KEYS.single), old);
    savePlanLocally(storage, "single", "main", single());
    assert.equal(JSON.parse(storage.getItem(SAVED_PLAN_KEYS.single)!).legacy, old);
    assert.equal(readSavedPlan(storage, "single", "main")?.amount, 100000);
  }
});

test("untrusted storage cannot restore another scope, invalid bounds/IDs/classes, duplicate funds or forged percentages", () => {
  for (const amount of [0, -1, 0.001, 1.234, NaN, Infinity, MAX_INVESTMENT_AMOUNT + 1]) assert.throws(() => parseSavedPlan({ ...single(), investment_amount: amount }, "single", "main"));
  for (const changed of [
    { ...single(), schema_version: 2 }, { ...single(), tool_scope: "aia" }, { ...single(), journey_mode: "portfolio" },
    { ...single(), selected_fund: { ...choices, project_id: "../../api/admin" } },
    { ...single(), selected_fund: { ...choices, class_name: "x".repeat(121) } },
    { ...single(), selected_fund: { ...choices, restore_query: "x\nsecret" } },
  ]) assert.throws(() => parseSavedPlan(changed, "single", "main"));
  const plan = portfolio();
  for (const changed of [
    { ...plan, selected_funds: [{ ...choices, selected_weight_percent: 99.99 }] },
    { ...plan, selected_funds: [{ ...choices, selected_weight_percent: 50 }, { ...choices, selected_weight_percent: 50 }] },
    { ...plan, fund_construction_allocation: plan.fund_construction_allocation.map(row => ({ ...row, percent: -1 })) },
    { ...plan, target_asset_allocation: [{ key: "constructor", percent: 100 }] },
  ]) assert.throws(() => parseSavedPlan(changed, "portfolio", "main"));
  assert.deepEqual(parseSavedPlan({ ...single(), risk_spectrum: 99, asset_allocation: [{ percent: 999 }], effective_allocation: "forged" }, "single", "main"), { amount: 100000, funds: [{ projectId: choices.project_id, className: "A", query: "FUND-A", weight: 100 }], construction: [], target: [] });
});

test("restore-only size bounds and native storage denial never replace old data", () => {
  const old = "x".repeat(200001);
  const storage = memoryStorage({ [SAVED_PLAN_KEYS.single]: old });
  assert.throws(() => readSavedPlan(storage, "single", "main"), /too_large/);
  assert.equal(storage.getItem(SAVED_PLAN_KEYS.single), old);
  assert.throws(() => readSavedPlan({ getItem() { throw new Error("denied"); } }, "single", "main"), /denied/);
  const denied = { getItem: storage.getItem, setItem() { throw new Error("native_quota"); } };
  assert.throws(() => savePlanLocally(denied, "single", "main", single()), /native_quota/);
  assert.equal(storage.getItem(SAVED_PLAN_KEYS.single), old);
});

test("existing Save accepts more than 50 valid funds and old values above the restore budget", () => {
  const plan = portfolio();
  plan.selected_funds = Array.from({ length: 51 }, (_, index) => ({ ...choices, project_id: `M${String(index + 1).padStart(4, "0")}_2569`, selected_weight_percent: index === 0 ? 100 : 0 }));
  const storage = memoryStorage();
  savePlanLocally(storage, "portfolio", "main", plan);
  assert.equal(JSON.parse(storage.getItem(SAVED_PLAN_KEYS.portfolio)!).plans.main.selected_funds.length, 51);
  assert.throws(() => readSavedPlan(storage, "portfolio", "main"), /restore_limit/);
  const old = "x".repeat(200001);
  const oldStorage = memoryStorage({ [SAVED_PLAN_KEYS.single]: old });
  savePlanLocally(oldStorage, "single", "main", single());
  const saved = JSON.parse(oldStorage.getItem(SAVED_PLAN_KEYS.single)!);
  assert.equal(saved.legacy, old);
  assert.equal(saved.plans.main.investment_amount, 100000);
  savePlanLocally(oldStorage, "single", "aia", single("aia"));
  const both = JSON.parse(oldStorage.getItem(SAVED_PLAN_KEYS.single)!);
  assert.equal(both.legacy, old);
  assert.deepEqual(both.plans.main, saved.plans.main);
  assert.equal(both.plans.aia.tool_scope, "aia");
});

test("investment copy uses existing strict Sanity document, fallback and placeholder contracts", () => {
  const scope = "investment";
  const entries = publicCopyInitialEntries(scope);
  const first = entries[0];
  const doc = { _id: publicCopyDocumentId(scope), _type: "publicPageCopy", scope, locale: "th", entries: [{ ...first, text: "คำที่แก้ใน CMS" }] };
  assert.equal(publicCopyText(parsePublicCopy(scope, doc))(first.key as keyof typeof PUBLIC_COPY_SCOPES.investment.defaults), "คำที่แก้ใน CMS");
  assert.deepEqual(parsePublicCopy(scope, null), PUBLIC_COPY_SCOPES.investment.defaults);
  assert.throws(() => parsePublicCopy(scope, { ...doc, scope: "ci" }), /IDENTITY/);
  assert.throws(() => parsePublicCopy(scope, { ...doc, entries: [{ ...first, text: "<script>" }] }), /ENTRY/);
  const template = entries.find(entry => entry.text.includes("{value1}"))!;
  assert.ok(template);
  assert.throws(() => parsePublicCopy(scope, { ...doc, entries: [{ ...template, text: "ทำค่าตัวเลขหาย" }] }), /PLACEHOLDER/);
});

test("restore respects only bounded Retry-After 429 responses and cancellation without loosening the API budget", async () => {
  let requests = 0;
  const waits: number[] = [];
  const retry = async () => ++requests === 1 ? new Response(null, { status: 429, headers: { "Retry-After": "6" } }) : Response.json({ ok: true });
  assert.equal((await fetchRestoreData("/api/investment-allocation/detail/", () => true, retry as typeof fetch, async ms => { waits.push(ms); })).ok, true);
  assert.deepEqual(waits, [6100]);
  assert.equal(requests, 2);
  for (const [status, after] of [[503, "6"], [429, "31"], [429, "invalid"]] as const) {
    requests = 0;
    await assert.rejects(fetchRestoreData("/api/investment-allocation/detail/", () => true, (async () => { requests++; return new Response(null, { status, headers: { "Retry-After": after } }); }) as typeof fetch, async () => { throw new Error("must not wait"); }));
    assert.equal(requests, 1);
  }
  let current = true;
  requests = 0;
  await assert.rejects(fetchRestoreData("/api/investment-allocation/detail/", () => current, (async () => { requests++; return new Response(null, { status: 429, headers: { "Retry-After": "6" } }); }) as typeof fetch, async () => { current = false; }), /cancelled/);
  assert.equal(requests, 1);
});

test("interpolation does not re-interpret placeholders inside an inserted fund name", () => {
  assert.equal(investmentValue("{value1}: {value2}%", ["Fund {value2}", 60]), "Fund {value2}: 60%");
});
