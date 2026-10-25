import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { ADMIN_PERMISSIONS, ADMIN_ROLES, hasAdminPermission } from "../../lib/admin/rbac";
import {
  authorizeFinancialPlanningRequest,
  canReadFinancialPlanning,
  canWriteFinancialPlanning,
} from "../../lib/admin/financial-planning/access";
import {
  decryptNote,
  decryptPosition,
  decryptProfile,
  encryptNote,
  encryptPosition,
  encryptProfile,
} from "../../lib/admin/financial-planning/codec";
import { getFinancialPlanningStatus, resolveFinancialPlanningDatabase } from "../../lib/admin/financial-planning/config";
import {
  crmNoteSchema,
  financialPositionSchema,
  savePlanRequestSchema,
  type FinancialPosition,
} from "../../lib/admin/financial-planning/contracts";
import { createFinancialPlanningCrypto, tryCreateFinancialPlanningCrypto } from "../../lib/admin/financial-planning/crypto";
import { bangkokToday, isPurgeCandidate, retentionUntilFor } from "../../lib/admin/financial-planning/retention";
import { createLineContentCrypto } from "../../lib/line/private-crypto";
import {
  FA_BENCHMARK_PENDING,
  FA_BENCHMARKS,
  FA_EMERGENCY_FUND_SELF_EMPLOYED,
  FA_RATIO_IDS,
  pendingBenchmarkIds,
} from "../../features/admin/financial-planning/benchmarks";
import {
  analyzeFinancialPosition,
  FA_ADVICE_DISCLAIMER,
  summarizeFinancialPosition,
} from "../../features/admin/financial-planning/calculations";
import { positionFromRows, rowsFromPosition } from "../../features/admin/financial-planning/editor-model";
import {
  amountToInput,
  formatBaht,
  formatMonths,
  formatPercent,
  parseAmountInput,
} from "../../features/admin/financial-planning/format";

const root = path.resolve(import.meta.dirname, "../..");
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");
const key = () => randomBytes(32).toString("base64");
const faEnv = () => ({ CCPUN_FA_ENCRYPTION_KEY_V1: key() });
const human = (role: (typeof ADMIN_ROLES)[number]) => ({ actorType: "human" as const, role });

function filesUnder(relative: string): string[] {
  const absolute = path.join(root, relative);
  return readdirSync(absolute).flatMap((name) => {
    const child = path.join(relative, name);
    return statSync(path.join(root, child)).isDirectory() ? filesUnder(child) : [child];
  });
}

const FEATURE_FILES = filesUnder("features/admin/financial-planning");
const LIB_FILES = filesUnder("lib/admin/financial-planning");
const ROUTE_FILES = filesUnder("apps/admin/app/api/admin/planning");
const PAGE_FILES = filesUnder("apps/admin/app/(control-plane)/dashboard/planning");

function position(partial: Partial<FinancialPosition> = {}): FinancialPosition {
  return { cashflow: [], assets: [], liabilities: [], ...partial };
}

const income = (amount: number | null, frequency: "monthly" | "yearly" = "monthly") => ({
  direction: "income" as const, label: "เงินเดือน", amount, frequency, incomeType: "40(1)" as const, expenseKind: null,
});
const expense = (amount: number | null, expenseKind: "living" | "saving" = "living") => ({
  direction: "expense" as const, label: "ค่าใช้จ่าย", amount, frequency: "monthly" as const, incomeType: null, expenseKind,
});
const asset = (value: number | null, liquidity: "liquid" | "invest" | "personal") => ({ label: "สินทรัพย์", value, liquidity, valuedOn: null });
const debt = (balance: number | null, monthlyPayment: number | null, kind: "mortgage" | "credit_card" = "credit_card") => ({
  label: "หนี้", balance, monthlyPayment, annualInterestRatePct: null, kind,
});

// ---------------------------------------------------------------- access ---

test("planning permissions belong to the owner role only", () => {
  for (const role of ADMIN_ROLES) {
    assert.equal(hasAdminPermission(role, "planning:read"), role === "owner", `${role} planning:read`);
    assert.equal(hasAdminPermission(role, "planning:write"), role === "owner", `${role} planning:write`);
  }
  assert.ok(ADMIN_PERMISSIONS.includes("planning:read"));
  assert.ok(ADMIN_PERMISSIONS.includes("planning:write"));
});

test("every non-owner role is denied reading and writing the planning room", () => {
  assert.equal(canReadFinancialPlanning(human("owner")), true);
  assert.equal(canWriteFinancialPlanning(human("owner")), true);
  for (const role of ADMIN_ROLES.filter((candidate) => candidate !== "owner")) {
    assert.equal(canReadFinancialPlanning(human(role)), false, role);
    assert.equal(canWriteFinancialPlanning(human(role)), false, role);
    for (const mutation of [true, false]) {
      assert.deepEqual(
        authorizeFinancialPlanningRequest({ identity: human(role), mutation, requestUrl: "https://admin.ccpun.com/api/admin/planning/households/", origin: "https://admin.ccpun.com" }),
        { ok: false, status: 403, error: "forbidden" },
        `${role} mutation=${mutation}`,
      );
    }
  }
  assert.equal(canReadFinancialPlanning(null), false);
  assert.equal(canReadFinancialPlanning(undefined), false);
  assert.equal(canReadFinancialPlanning({ actorType: "ai", role: "owner" } as never), false);
});

test("planning requests need a session and same-origin mutations", () => {
  const url = "https://admin.ccpun.com/api/admin/planning/households/";
  assert.deepEqual(authorizeFinancialPlanningRequest({ identity: null, mutation: true, requestUrl: url, origin: "https://admin.ccpun.com" }), { ok: false, status: 401, error: "unauthorized" });
  assert.deepEqual(authorizeFinancialPlanningRequest({ identity: human("owner"), mutation: true, requestUrl: url, origin: "https://evil.example" }), { ok: false, status: 403, error: "invalid-origin" });
  assert.deepEqual(authorizeFinancialPlanningRequest({ identity: human("owner"), mutation: true, requestUrl: url, origin: null }), { ok: false, status: 403, error: "invalid-origin" });
  assert.deepEqual(authorizeFinancialPlanningRequest({ identity: human("owner"), mutation: true, requestUrl: url, origin: "https://admin.ccpun.com" }), { ok: true });
});

test("planning API routes and pages go through the owner-only guards", () => {
  assert.equal(ROUTE_FILES.length, 4);
  for (const file of ROUTE_FILES) {
    const source = read(file);
    assert.match(source, /handlePlanningMutation\(request,/, file);
    assert.doesNotMatch(source, /export async function GET/, `${file} exposes no GET`);
    assert.doesNotMatch(source, /hasAdminPermission|getAdminIdentity/, `${file} uses the shared guard only`);
  }
  const http = read("lib/admin/financial-planning/http.ts");
  assert.match(http, /authorizeFinancialPlanningRequest\(\{[\s\S]*mutation: true/);
  assert.match(http, /FA_PRIVATE_HEADERS/);
  const pages = read("features/admin/financial-planning/PlanningPages.tsx");
  assert.equal(pages.match(/await requireFinancialPlanningOwner\(\);/g)?.length, 3);
  for (const file of PAGE_FILES) assert.match(read(file), /PlanningPages/, file);
  const guard = read("lib/admin/financial-planning/require-owner.ts");
  assert.match(guard, /canReadFinancialPlanning\(identity\)/);
});

// ---------------------------------------------------------- calculations ---

test("zero income yields unavailable income ratios instead of NaN or Infinity", () => {
  const analysis = analyzeFinancialPosition(position({
    cashflow: [expense(20_000)],
    assets: [asset(60_000, "liquid")],
    liabilities: [debt(10_000, 2_000)],
  }));
  assert.equal(analysis.summary.monthlyIncome, 0);
  assert.equal(analysis.summary.monthlySurplus, -22_000);
  for (const id of ["savings_rate", "debt_service", "housing_debt_service"] as const) {
    const ratio = analysis.ratios.find((item) => item.id === id)!;
    assert.equal(ratio.value, null, id);
    assert.equal(ratio.status, "unavailable", id);
    assert.equal(ratio.unavailableReason, "no-income", id);
    assert.equal(ratio.display, "—", id);
  }
  const emergency = analysis.ratios.find((item) => item.id === "emergency_fund")!;
  assert.ok(Math.abs(emergency.value! - 60_000 / 22_000) < 1e-9);
  for (const ratio of analysis.ratios) assert.ok(ratio.value === null || Number.isFinite(ratio.value));
});

test("an empty position calculates without throwing and every ratio is unavailable", () => {
  const analysis = analyzeFinancialPosition(position());
  assert.equal(analysis.summary.netWorth, 0);
  assert.ok(analysis.ratios.every((ratio) => ratio.status === "unavailable"));
  assert.equal(analysis.summary.complete, true);
});

test("negative net worth is reported and the investment ratio refuses to divide by it", () => {
  const analysis = analyzeFinancialPosition(position({
    cashflow: [income(50_000)],
    assets: [asset(100_000, "invest"), asset(20_000, "liquid")],
    liabilities: [debt(500_000, 15_000)],
  }));
  assert.equal(analysis.summary.netWorth, -380_000);
  assert.equal(formatBaht(analysis.summary.netWorth), "-380,000");
  const investment = analysis.ratios.find((item) => item.id === "investment_to_net_worth")!;
  assert.equal(investment.value, null);
  assert.equal(investment.unavailableReason, "net-worth-not-positive");
  const debtToAsset = analysis.ratios.find((item) => item.id === "debt_to_asset")!;
  assert.ok(debtToAsset.value! > 4);
  assert.equal(debtToAsset.status, "adjust");
});

test("debt without any recorded asset is flagged rather than hidden", () => {
  const analysis = analyzeFinancialPosition(position({ cashflow: [income(30_000)], liabilities: [debt(50_000, 3_000)] }));
  const debtToAsset = analysis.ratios.find((item) => item.id === "debt_to_asset")!;
  assert.equal(debtToAsset.value, null);
  assert.equal(debtToAsset.status, "adjust");
  assert.equal(debtToAsset.unavailableReason, "no-assets");
});

test("missing amounts are excluded, counted and flag the ratios that depend on them", () => {
  const analysis = analyzeFinancialPosition(position({
    cashflow: [income(40_000), income(null), expense(10_000), expense(null)],
    assets: [asset(null, "liquid"), asset(90_000, "liquid")],
    liabilities: [debt(100_000, null)],
  }));
  const { summary } = analysis;
  assert.equal(summary.monthlyIncome, 40_000);
  assert.equal(summary.monthlyExpenseTotal, 10_000);
  assert.deepEqual(summary.missing, { income: 1, expense: 1, assets: 1, liabilities: 0, debtPayments: 1 });
  assert.equal(summary.complete, false);
  assert.ok(analysis.ratios.find((item) => item.id === "savings_rate")!.incompleteInputs);
  assert.ok(analysis.ratios.find((item) => item.id === "debt_service")!.incompleteInputs);
  assert.equal(analysis.ratios.find((item) => item.id === "debt_to_asset")!.incompleteInputs, true);
});

test("yearly amounts become monthly and debt payments are pulled into expenses once", () => {
  const summary = summarizeFinancialPosition(position({
    cashflow: [income(60_000), income(120_000, "yearly"), expense(20_000), expense(5_000, "saving")],
    liabilities: [debt(2_400_000, 18_000, "mortgage"), debt(25_000, 2_000)],
  }));
  assert.equal(summary.monthlyIncome, 70_000);
  assert.equal(summary.monthlyDebtPayments, 20_000);
  assert.equal(summary.monthlyMortgagePayments, 18_000);
  assert.equal(summary.monthlyExpenseTotal, 45_000);
  assert.equal(summary.monthlySurplus, 25_000);
  assert.equal(summary.monthlySavingContributions, 5_000);
});

test("ratio statuses follow the cited benchmark bands", () => {
  const analysis = analyzeFinancialPosition(position({
    cashflow: [income(100_000), expense(40_000)],
    assets: [asset(200_000, "liquid"), asset(1_000_000, "invest"), asset(3_000_000, "personal")],
    liabilities: [debt(2_000_000, 28_000, "mortgage"), debt(10_000, 12_000)],
  }));
  const status = Object.fromEntries(analysis.ratios.map((ratio) => [ratio.id, ratio.status]));
  assert.equal(status.debt_service, "watch"); // 40% sits inside SET's 35–45% range
  assert.equal(status.housing_debt_service, "watch"); // 28% sits inside 25–30%
  assert.equal(status.savings_rate, "good"); // (100k − 80k) ÷ 100k = 20%
  assert.equal(status.emergency_fund, "adjust"); // 200k ÷ 80k = 2.5 months, below 3
  assert.equal(status.debt_to_asset, "good"); // 2.01M ÷ 4.2M ≈ 48%
  assert.equal(status.investment_to_net_worth, "adjust"); // 1M ÷ 2.19M ≈ 46%
});

test("self-employed households use the top of the emergency fund range", () => {
  const input = position({ cashflow: [income(50_000), expense(20_000)], assets: [asset(80_000, "liquid")] });
  const salaried = analyzeFinancialPosition(input, "salaried").ratios.find((item) => item.id === "emergency_fund")!;
  const selfEmployed = analyzeFinancialPosition(input, "self_employed").ratios.find((item) => item.id === "emergency_fund")!;
  assert.equal(salaried.status, "good"); // 4 months ≥ 3
  assert.equal(selfEmployed.status, "watch"); // 4 months is inside 3–6
  assert.equal(formatMonths(selfEmployed.value), "4.0 เดือน");
});

test("every calculation output carries the review disclaimer", () => {
  const analysis = analyzeFinancialPosition(position({ cashflow: [income(10_000)] }));
  assert.equal(analysis.disclaimer, FA_ADVICE_DISCLAIMER);
  assert.match(FA_ADVICE_DISCLAIMER, /ยังไม่ใช่คำแนะนำเฉพาะบุคคลจนกว่าปั้นจะตรวจทาน/);
  assert.ok(analysis.ratios.every((ratio) => ratio.benchmarkConfirmation === FA_BENCHMARK_PENDING));
});

test("calculations are pure: same input, same output, input untouched", () => {
  const input = position({ cashflow: [income(45_000), expense(30_000)], assets: [asset(100_000, "liquid")] });
  const snapshot = JSON.stringify(input);
  assert.deepEqual(analyzeFinancialPosition(input), analyzeFinancialPosition(input));
  assert.equal(JSON.stringify(input), snapshot);
  const source = read("features/admin/financial-planning/calculations.ts");
  assert.doesNotMatch(source, /Date\.now|new Date|Math\.random|process\.env|fetch\(|console\./);
});

// ------------------------------------------------------------ formatting ---

test("Thai number formatting and amount parsing", () => {
  assert.equal(formatBaht(1_234_567.4), "1,234,567");
  assert.equal(formatBaht(-0.2), "0");
  assert.equal(formatBaht(Number.NaN), "—");
  assert.equal(formatPercent(0.125), "12.5%");
  assert.equal(formatPercent(null), "—");
  assert.deepEqual(parseAmountInput("1,200,000"), { ok: true, value: 1_200_000 });
  assert.deepEqual(parseAmountInput(" 85,000 บาท "), { ok: true, value: 85_000 });
  assert.deepEqual(parseAmountInput("๑๒,๕๐๐.๕"), { ok: true, value: 12_500.5 });
  assert.deepEqual(parseAmountInput(""), { ok: true, value: null });
  assert.deepEqual(parseAmountInput("-500"), { ok: false });
  assert.deepEqual(parseAmountInput("12abc"), { ok: false });
  assert.equal(amountToInput(1_250_000.5), "1,250,000.5");
  assert.equal(amountToInput(null), "");
});

test("editor rows round-trip and invalid fields are reported, never guessed", () => {
  let counter = 0;
  const original = position({
    cashflow: [income(85_000), expense(25_000)],
    assets: [{ label: "เงินฝาก", value: 180_000, liquidity: "liquid", valuedOn: "2026-10-01" }],
    liabilities: [{ label: "บ้าน", balance: 2_400_000, monthlyPayment: 18_000, annualInterestRatePct: 3.5, kind: "mortgage" }],
  });
  const rows = rowsFromPosition(original, () => `k${++counter}`);
  const back = positionFromRows(rows);
  assert.equal(back.ok, true);
  assert.deepEqual(back.position, original);
  rows.liabilities[0].rate = "150";
  rows.income[0].amount = "abc";
  const broken = positionFromRows(rows);
  assert.equal(broken.ok, false);
  if (!broken.ok) assert.deepEqual(broken.invalidKeys.sort(), [`${rows.income[0].key}:amount`, `${rows.liabilities[0].key}:rate`].sort());
});

// ------------------------------------------------------------ benchmarks ---

test("every ratio benchmark cites a source and awaits ปั้น's confirmation", () => {
  assert.equal(FA_BENCHMARK_PENDING, "รอปั้นยืนยันตัวเลข");
  for (const id of FA_RATIO_IDS) {
    const benchmark = FA_BENCHMARKS[id];
    assert.equal(benchmark.confirmation, FA_BENCHMARK_PENDING, id);
    assert.ok(benchmark.sources.length > 0, id);
    for (const source of benchmark.sources) {
      assert.match(source.url, /^https:\/\//, id);
      assert.ok(source.quote.length > 10, id);
      assert.match(source.accessedOn, /^\d{4}-\d{2}-\d{2}$/, id);
    }
    assert.match(benchmark.curriculumNote, /CFP/, id);
  }
  assert.equal(FA_EMERGENCY_FUND_SELF_EMPLOYED.confirmation, FA_BENCHMARK_PENDING);
  assert.deepEqual(pendingBenchmarkIds(), [...FA_RATIO_IDS]);
  for (const file of FEATURE_FILES.filter((candidate) => !candidate.endsWith("benchmarks.ts"))) {
    assert.doesNotMatch(read(file), /goodMin:|goodMax:|watchMin:|watchMax:/, `${file} must read thresholds from benchmarks.ts`);
  }
});

// ------------------------------------------------------- encryption, DB ---

test("planning data is encrypted, bound to its household and row, and unreadable by LINE keys", () => {
  const env = faEnv();
  const crypto = createFinancialPlanningCrypto(env);
  const householdId = randomUUID();
  const profile = { displayName: "ครอบครัวทดสอบ", employment: "salaried" as const, dependentsCount: 2 };
  const encryptedProfile = encryptProfile(crypto, householdId, profile);
  assert.ok(!Buffer.from(encryptedProfile.ciphertext_b64, "base64").toString("utf8").includes("ครอบครัวทดสอบ"));
  assert.deepEqual(decryptProfile(crypto, householdId, encryptedProfile), profile);
  assert.equal(decryptProfile(crypto, randomUUID(), encryptedProfile), null, "another household cannot read it");

  let n = 0;
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  const plan = position({ cashflow: [income(85_000)], assets: [asset(10_000, "liquid")], liabilities: [debt(5_000, 500)] });
  const items = encryptPosition(crypto, householdId, plan, () => ids[n++]);
  const rows = {
    cashflow: items.cashflow.map(({ id, ...columns }) => ({ ...columns, item_id: id })),
    assets: items.assets.map(({ id, ...columns }) => ({ ...columns, item_id: id })),
    liabilities: items.liabilities.map(({ id, ...columns }) => ({ ...columns, item_id: id })),
  };
  assert.deepEqual(decryptPosition(crypto, householdId, rows), { position: plan, unreadableItems: 0 });
  const swapped = { ...rows, cashflow: [{ ...rows.cashflow[0], item_id: rows.assets[0].item_id }] };
  assert.equal(decryptPosition(crypto, householdId, swapped).unreadableItems, 1, "a ciphertext moved to another row fails");

  const noteId = randomUUID();
  const note = crmNoteSchema.parse({ text: "อยากเกษียณอายุ 55", tags: ["goal", "goal"], nextMeetingOn: "2026-11-15", followUp: null });
  assert.deepEqual(note.tags, ["goal"]);
  const encryptedNote = encryptNote(crypto, householdId, noteId, note);
  assert.deepEqual(decryptNote(crypto, householdId, noteId, encryptedNote), note);
  assert.equal(decryptNote(crypto, householdId, randomUUID(), encryptedNote), null);

  const line = createLineContentCrypto({ CCPUN_LINE_ENCRYPTION_KEY_V1: env.CCPUN_FA_ENCRYPTION_KEY_V1 });
  assert.throws(() => line.decrypt({
    keyVersion: 1, ciphertextB64: encryptedProfile.ciphertext_b64, nonceB64: encryptedProfile.nonce_b64, authTagB64: encryptedProfile.auth_tag_b64,
  }, `household:${householdId}:profile`), "LINE crypto must not decrypt planning data even with the same key bytes");
});

test("crypto and database config fail closed", () => {
  assert.equal(tryCreateFinancialPlanningCrypto({}), null);
  assert.equal(tryCreateFinancialPlanningCrypto({ CCPUN_FA_ENCRYPTION_KEY_V1: "short" }), null);
  const same = key();
  assert.equal(tryCreateFinancialPlanningCrypto({ CCPUN_FA_ENCRYPTION_KEY_V1: same, CCPUN_FA_ENCRYPTION_KEY_V2: same }), null);
  assert.equal(tryCreateFinancialPlanningCrypto({ CCPUN_FA_ENCRYPTION_KEY_V1: key(), CCPUN_FA_ACTIVE_ENCRYPTION_KEY_VERSION: "2" }), null);
  assert.equal(resolveFinancialPlanningDatabase({}).state, "missing");
  assert.equal(resolveFinancialPlanningDatabase({ CCPUN_FA_DATABASE_URL: "mysql://x" }).state, "invalid");
  const url = "postgresql://ccpun_fa_runtime@example.invalid/fa";
  assert.equal(resolveFinancialPlanningDatabase({ CCPUN_FA_DATABASE_URL: url, CCPUN_ADMIN_DATABASE_URL: url }).state, "shared-with-admin");
  assert.equal(resolveFinancialPlanningDatabase({ CCPUN_FA_DATABASE_URL: url }).state, "ready");
  assert.deepEqual(getFinancialPlanningStatus({ CCPUN_FA_DATABASE_URL: url, ...faEnv() }), { database: "ready", cryptoReady: true, ready: true });
  assert.equal(read("lib/admin/financial-planning/store.ts").includes("CCPUN_ADMIN_DATABASE_URL"), false);
});

test("contracts store numbers only and reject documents, IDs and negative amounts", () => {
  assert.equal(financialPositionSchema.safeParse(position({ cashflow: [income(-1)] })).success, false);
  assert.equal(financialPositionSchema.safeParse({ ...position(), attachments: [] }).success, false);
  assert.equal(savePlanRequestSchema.safeParse({
    expectedRevision: 1,
    profile: { displayName: "ก", employment: "salaried", dependentsCount: null, nationalId: "1234567890123" },
    position: position(),
  }).success, false);
  const code = read("lib/admin/financial-planning/contracts.ts").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  assert.doesNotMatch(code, /\bpdf\b|upload|\bfiles?\b|attachment|nationalId|accountNumber|z\.instanceof/i);
});

test("retention keeps data two years after the relationship ends and never deletes", () => {
  assert.equal(retentionUntilFor("2026-10-25"), "2028-10-25");
  assert.equal(retentionUntilFor("2024-02-29"), "2026-03-01");
  assert.throws(() => retentionUntilFor("25/10/2026"));
  const former = { clientStatus: "former" as const, relationshipEndedOn: "2024-01-01", retentionUntil: "2026-01-01" };
  assert.equal(isPurgeCandidate(former, "2026-01-01"), false);
  assert.equal(isPurgeCandidate(former, "2026-01-02"), true);
  assert.equal(isPurgeCandidate({ clientStatus: "active", relationshipEndedOn: null, retentionUntil: null }, "2099-01-01"), false);
  assert.equal(bangkokToday(new Date("2026-10-24T17:30:00Z")), "2026-10-25");
  for (const file of [...LIB_FILES, ...FEATURE_FILES, ...ROUTE_FILES]) {
    assert.doesNotMatch(read(file), /DELETE FROM|export async function DELETE|purgeHousehold|deleteHousehold/, file);
  }
});

test("migration is checksum-locked, least privilege and keeps notes append-only", () => {
  const migration = read("db/migrations/20261025_fa_room_v1.sql");
  const body = migration.split("-- checksum-source-begin\n")[1]?.split("-- checksum-source-end")[0];
  assert.ok(body);
  const checksum = createHash("sha256").update(body).digest("hex");
  assert.equal(migration.split(`sha256:${checksum}`).length - 1, 2);
  assert.match(migration, /BEGIN;[\s\S]*COMMIT;\s*$/);
  assert.match(migration, /excessive privileges or memberships/);
  assert.match(migration, /another application data plane/);
  const grants = migration.match(/^GRANT [^\n]+$/gm) ?? [];
  assert.ok(grants.length >= 6);
  for (const grant of grants) {
    assert.doesNotMatch(grant, /DELETE|TRUNCATE|ALL PRIVILEGES/, grant);
    if (/crm_note/.test(grant)) assert.doesNotMatch(grant, /UPDATE/, grant);
    if (/cashflow_item|asset|liability/.test(grant)) assert.match(grant, /^GRANT SELECT ON/, grant);
  }
  assert.match(migration, /GRANT UPDATE \(client_status, relationship_ended_on, retention_until, updated_at\) ON ccpun_fa\.household/);
  assert.match(migration, /retention_until >= \(relationship_ended_on \+ interval '2 years'\)::date/);
  assert.match(migration, /SECURITY DEFINER SET search_path = pg_catalog/);
  const readback = read("db/migrations/20261025_fa_room_v1_readback.sql");
  assert.doesNotMatch(readback.replace(/^--[^\n]*$/gm, ""), /ciphertext|nonce|auth_tag/i);
});

// ------------------------------------------------- privacy and copy rules ---

test("planning code never sends client data to analytics, logs, storage or outside hosts", () => {
  for (const file of [...FEATURE_FILES, ...LIB_FILES, ...ROUTE_FILES, ...PAGE_FILES]) {
    const source = read(file);
    assert.doesNotMatch(source, /console\.|trackEvent|gtag|fbq|dataLayer|lib\/analytics|localStorage|sessionStorage|indexedDB/, file);
    assert.doesNotMatch(source, /local-ai|openai|anthropic|gemini|sample\(/i, `${file} must not call an AI provider`);
    for (const target of source.match(/fetch\(([^,)]+)/g) ?? []) {
      assert.match(target, /fetch\(`?["'`]?\/api\/admin\/planning\//, `${file}: ${target}`);
    }
  }
});

test("Thai copy has no free, guarantee or superlative wording", () => {
  for (const file of [...FEATURE_FILES, ...PAGE_FILES]) {
    const source = read(file);
    assert.doesNotMatch(source, /ฟรี|การันตี|รับประกัน|ดีที่สุด|ที่สุด|แน่นอน|ไม่มีความเสี่ยง/, file);
  }
});
